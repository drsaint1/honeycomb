
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount, Transfer, transfer, Burn, burn},
};

declare_id!("4CnqZSJakSuNEutooa7T7mBpQRkDWx3SD1Lw5YsqQ2hi"); // Replace with your actual program ID

#[program]
pub mod speedy_token {
    use super::*;

    // Initialize the $SPEEDY token mint and game vault
    pub fn initialize_token(
        ctx: Context<InitializeToken>,
        _decimals: u8,
    ) -> Result<()> {
        let game_state = &mut ctx.accounts.game_state;
        game_state.authority = ctx.accounts.authority.key();
        game_state.token_mint = ctx.accounts.token_mint.key();
        game_state.vault = ctx.accounts.vault.key();
        game_state.total_distributed = 0;
        game_state.bump = ctx.bumps.game_state;
        game_state.is_initialized = true;

        // Set initial token rates (in smallest units with 6 decimals)
        game_state.token_rates = TokenRates {
            race_completion: 100_000_000,        // 100 tokens (100 * 10^6)
            race_win: 50_000_000,               // 50 tokens  
            distance_per_100m: 500_000,         // 0.5 tokens
            obstacle_avoided: 200_000,          // 0.2 tokens
            bonus_collected: 500_000,           // 0.5 tokens
            daily_challenge_easy: 50_000_000,   // 50 tokens
            daily_challenge_medium: 100_000_000, // 100 tokens
            daily_challenge_hard: 200_000_000,  // 200 tokens
            tournament_participation: 100_000_000, // 100 tokens
            tournament_winner: 1_000_000_000,   // 1000 tokens
            welcome_bonus: 100_000_000,         // 100 tokens
            staking_per_hour_common: 1_000_000, // 1 token
            staking_per_hour_rare: 3_000_000,   // 3 tokens
            staking_per_hour_epic: 10_000_000,  // 10 tokens
            staking_per_hour_legendary: 25_000_000, // 25 tokens
        };

        msg!("$SPEEDY Token initialized successfully!");
        Ok(())
    }

    // Fund the vault with tokens (admin only)
    pub fn fund_vault(
        ctx: Context<FundVault>,
        amount: u64,
    ) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.game_state.authority,
            ErrorCode::Unauthorized
        );

        // Transfer tokens from authority's token account to vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.authority_token_account.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        transfer(cpi_ctx, amount)?;

        msg!("Vault funded with {} $SPEEDY tokens", amount);
        Ok(())
    }

    // Award tokens for race completion
    pub fn award_race_tokens(
        ctx: Context<AwardTokens>,
        race_stats: RaceStats,
    ) -> Result<()> {
        let game_state = &ctx.accounts.game_state;
        let mut total_reward = 0u64;

        // Calculate rewards based on race performance
        if race_stats.completed {
            total_reward = total_reward.checked_add(game_state.token_rates.race_completion)
                .ok_or(ErrorCode::InvalidRewardAmount)?;
        }

        if race_stats.won {
            total_reward = total_reward.checked_add(game_state.token_rates.race_win)
                .ok_or(ErrorCode::InvalidRewardAmount)?;
        }

        // Distance bonus (per 100m) - using checked arithmetic
        let distance_hundreds = race_stats.distance.checked_div(100).unwrap_or(0);
        let distance_bonus = distance_hundreds.checked_mul(game_state.token_rates.distance_per_100m)
            .ok_or(ErrorCode::InvalidRewardAmount)?;
        total_reward = total_reward.checked_add(distance_bonus)
            .ok_or(ErrorCode::InvalidRewardAmount)?;

        // Obstacle avoidance bonus - using checked arithmetic  
        let obstacle_bonus = race_stats.obstacles_avoided.checked_mul(game_state.token_rates.obstacle_avoided)
            .ok_or(ErrorCode::InvalidRewardAmount)?;
        total_reward = total_reward.checked_add(obstacle_bonus)
            .ok_or(ErrorCode::InvalidRewardAmount)?;

        // Bonus collection reward - using checked arithmetic
        let bonus_reward = race_stats.bonus_boxes_collected.checked_mul(game_state.token_rates.bonus_collected)
            .ok_or(ErrorCode::InvalidRewardAmount)?;
        total_reward = total_reward.checked_add(bonus_reward)
            .ok_or(ErrorCode::InvalidRewardAmount)?;

        // Check if vault has sufficient balance
        require!(
            ctx.accounts.vault.amount >= total_reward,
            ErrorCode::InsufficientVaultBalance
        );

        // Transfer tokens from vault to player
        transfer_tokens_from_vault(
            ctx.accounts.game_state.to_account_info(),
            ctx.accounts.vault.to_account_info(),
            ctx.accounts.player_token_account.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            total_reward,
            ctx.accounts.game_state.bump,
        )?;

        // Update game statistics - using checked arithmetic
        let game_state = &mut ctx.accounts.game_state;
        game_state.total_distributed = game_state.total_distributed.checked_add(total_reward)
            .ok_or(ErrorCode::InvalidRewardAmount)?;

        // Log transaction
        emit!(TokenReward {
            player: ctx.accounts.player.key(),
            amount: total_reward,
            reward_type: RewardType::RaceCompletion,
            race_id: race_stats.race_id,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Awarded {} $SPEEDY tokens for race completion", total_reward);
        Ok(())
    }

    // Award tokens for daily challenge completion
    pub fn award_challenge_tokens(
        ctx: Context<AwardTokens>,
        challenge_difficulty: ChallengeDifficulty,
        challenge_id: u64,
    ) -> Result<()> {
        let game_state = &ctx.accounts.game_state;
        
        let reward_amount = match challenge_difficulty {
            ChallengeDifficulty::Easy => game_state.token_rates.daily_challenge_easy,
            ChallengeDifficulty::Medium => game_state.token_rates.daily_challenge_medium,
            ChallengeDifficulty::Hard => game_state.token_rates.daily_challenge_hard,
        };

        // Check if vault has sufficient balance
        require!(
            ctx.accounts.vault.amount >= reward_amount,
            ErrorCode::InsufficientVaultBalance
        );

        // Transfer tokens from vault to player
        transfer_tokens_from_vault(
            ctx.accounts.game_state.to_account_info(),
            ctx.accounts.vault.to_account_info(),
            ctx.accounts.player_token_account.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            reward_amount,
            ctx.accounts.game_state.bump,
        )?;

        // Update statistics - using checked arithmetic
        let game_state = &mut ctx.accounts.game_state;
        game_state.total_distributed = game_state.total_distributed.checked_add(reward_amount)
            .ok_or(ErrorCode::InvalidRewardAmount)?;

        emit!(TokenReward {
            player: ctx.accounts.player.key(),
            amount: reward_amount,
            reward_type: RewardType::DailyChallenge,
            race_id: challenge_id,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Awarded {} $SPEEDY tokens for challenge completion", reward_amount);
        Ok(())
    }

    // Award tokens for tournament participation/winning
    pub fn award_tournament_tokens(
        ctx: Context<AwardTokens>,
        placement: TournamentPlacement,
        tournament_id: u64,
    ) -> Result<()> {
        let game_state = &ctx.accounts.game_state;
        
        let reward_amount = match placement {
            TournamentPlacement::Participation => game_state.token_rates.tournament_participation,
            TournamentPlacement::Winner => game_state.token_rates.tournament_winner,
        };

        // Check if vault has sufficient balance
        require!(
            ctx.accounts.vault.amount >= reward_amount,
            ErrorCode::InsufficientVaultBalance
        );

        transfer_tokens_from_vault(
            ctx.accounts.game_state.to_account_info(),
            ctx.accounts.vault.to_account_info(),
            ctx.accounts.player_token_account.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            reward_amount,
            ctx.accounts.game_state.bump,
        )?;

        let game_state = &mut ctx.accounts.game_state;
        game_state.total_distributed = game_state.total_distributed.checked_add(reward_amount)
            .ok_or(ErrorCode::InvalidRewardAmount)?;

        emit!(TokenReward {
            player: ctx.accounts.player.key(),
            amount: reward_amount,
            reward_type: RewardType::Tournament,
            race_id: tournament_id,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Awarded {} $SPEEDY tokens for tournament {}", reward_amount, placement as u8);
        Ok(())
    }

    // Award welcome bonus for new players
    pub fn award_welcome_bonus(
        ctx: Context<AwardTokens>,
    ) -> Result<()> {
        let game_state = &ctx.accounts.game_state;
        let reward_amount = game_state.token_rates.welcome_bonus;

        // Check if vault has sufficient balance
        require!(
            ctx.accounts.vault.amount >= reward_amount,
            ErrorCode::InsufficientVaultBalance
        );

        transfer_tokens_from_vault(
            ctx.accounts.game_state.to_account_info(),
            ctx.accounts.vault.to_account_info(),
            ctx.accounts.player_token_account.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            reward_amount,
            ctx.accounts.game_state.bump,
        )?;

        let game_state = &mut ctx.accounts.game_state;
        game_state.total_distributed = game_state.total_distributed.checked_add(reward_amount)
            .ok_or(ErrorCode::InvalidRewardAmount)?;

        emit!(TokenReward {
            player: ctx.accounts.player.key(),
            amount: reward_amount,
            reward_type: RewardType::WelcomeBonus,
            race_id: 0,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Awarded {} $SPEEDY welcome bonus to new player", reward_amount);
        Ok(())
    }

    // Award staking rewards
    pub fn award_staking_tokens(
        ctx: Context<AwardTokens>,
        car_rarity: CarRarity,
        hours_staked: u64,
        car_id: u64,
    ) -> Result<()> {
        let game_state = &ctx.accounts.game_state;
        
        let hourly_rate = match car_rarity {
            CarRarity::Common => game_state.token_rates.staking_per_hour_common,
            CarRarity::Rare => game_state.token_rates.staking_per_hour_rare,
            CarRarity::Epic => game_state.token_rates.staking_per_hour_epic,
            CarRarity::Legendary => game_state.token_rates.staking_per_hour_legendary,
        };

        let reward_amount = hourly_rate.checked_mul(hours_staked)
            .ok_or(ErrorCode::InvalidRewardAmount)?;

        // Check if vault has sufficient balance
        require!(
            ctx.accounts.vault.amount >= reward_amount,
            ErrorCode::InsufficientVaultBalance
        );

        transfer_tokens_from_vault(
            ctx.accounts.game_state.to_account_info(),
            ctx.accounts.vault.to_account_info(),
            ctx.accounts.player_token_account.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            reward_amount,
            ctx.accounts.game_state.bump,
        )?;

        let game_state = &mut ctx.accounts.game_state;
        game_state.total_distributed = game_state.total_distributed.checked_add(reward_amount)
            .ok_or(ErrorCode::InvalidRewardAmount)?;

        emit!(TokenReward {
            player: ctx.accounts.player.key(),
            amount: reward_amount,
            reward_type: RewardType::Staking,
            race_id: car_id,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Awarded {} $SPEEDY tokens for staking {} car for {} hours", reward_amount, car_rarity as u8, hours_staked);
        Ok(())
    }

    // Spend tokens (for tournaments, upgrades, etc.) - Burns tokens to create deflationary pressure
    pub fn spend_tokens(
        ctx: Context<SpendTokens>,
        amount: u64,
        spend_type: SpendType,
    ) -> Result<()> {
        // Burn tokens from player's account
        let cpi_accounts = Burn {
            mint: ctx.accounts.token_mint.to_account_info(),
            from: ctx.accounts.player_token_account.to_account_info(),
            authority: ctx.accounts.player.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        burn(cpi_ctx, amount)?;

        emit!(TokenSpend {
            player: ctx.accounts.player.key(),
            amount,
            spend_type,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Player burned {} $SPEEDY tokens for {}", amount, spend_type as u8);
        Ok(())
    }

    // Update token rates (admin only)
    pub fn update_token_rates(
        ctx: Context<UpdateGameState>,
        new_rates: TokenRates,
    ) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.game_state.authority,
            ErrorCode::Unauthorized
        );

        ctx.accounts.game_state.token_rates = new_rates;
        msg!("Token rates updated successfully");
        Ok(())
    }
}

// Helper function to transfer tokens from vault
fn transfer_tokens_from_vault<'info>(
    game_state: AccountInfo<'info>,
    vault: AccountInfo<'info>,
    player_token_account: AccountInfo<'info>,
    token_program: AccountInfo<'info>,
    amount: u64,
    bump: u8,
) -> Result<()> {
    let authority_seeds = &[
        b"game_state".as_ref(),
        &[bump],
    ];
    let signer = &[&authority_seeds[..]];

    let cpi_accounts = Transfer {
        from: vault,
        to: player_token_account,
        authority: game_state,
    };
    let cpi_program = token_program;
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);

    transfer(cpi_ctx, amount)?;
    Ok(())
}

// Account Structures
#[derive(Accounts)]
#[instruction(decimals: u8)]
pub struct InitializeToken<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        mint::decimals = decimals,
        mint::authority = authority, // Authority is the mint authority, not game_state
    )]
    pub token_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        space = 8 + GameState::LEN,
        seeds = [b"game_state"],
        bump,
    )]
    pub game_state: Account<'info, GameState>,

    #[account(
        init,
        payer = authority,
        associated_token::mint = token_mint,
        associated_token::authority = game_state, // Vault is controlled by game_state PDA
    )]
    pub vault: Account<'info, TokenAccount>,


    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct FundVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"game_state"],
        bump = game_state.bump,
    )]
    pub game_state: Account<'info, GameState>,

    #[account(
        mut,
        associated_token::mint = game_state.token_mint,
        associated_token::authority = authority,
    )]
    pub authority_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        address = game_state.vault,
    )]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AwardTokens<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    #[account(
        mut,
        seeds = [b"game_state"],
        bump = game_state.bump,
    )]
    pub game_state: Account<'info, GameState>,

    #[account(
        mut,
        address = game_state.token_mint,
    )]
    pub token_mint: Account<'info, Mint>,

    #[account(
        mut,
        address = game_state.vault,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = player,
        associated_token::mint = token_mint,
        associated_token::authority = player,
    )]
    pub player_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct SpendTokens<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    #[account(
        seeds = [b"game_state"],
        bump = game_state.bump,
    )]
    pub game_state: Account<'info, GameState>,

    #[account(
        mut,
        address = game_state.token_mint,
    )]
    pub token_mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = player,
    )]
    pub player_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UpdateGameState<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"game_state"],
        bump = game_state.bump,
    )]
    pub game_state: Account<'info, GameState>,
}

// Data Structures
#[account]
pub struct GameState {
    pub authority: Pubkey,
    pub token_mint: Pubkey,
    pub vault: Pubkey,        // Vault that holds tokens for rewards
    pub total_distributed: u64,
    pub token_rates: TokenRates,
    pub bump: u8,
    pub is_initialized: bool,
}

impl GameState {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 8 + TokenRates::LEN + 1 + 1; // Added 8 bytes for discriminator
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct TokenRates {
    pub race_completion: u64,
    pub race_win: u64,
    pub distance_per_100m: u64,
    pub obstacle_avoided: u64,
    pub bonus_collected: u64,
    pub daily_challenge_easy: u64,
    pub daily_challenge_medium: u64,
    pub daily_challenge_hard: u64,
    pub tournament_participation: u64,
    pub tournament_winner: u64,
    pub welcome_bonus: u64,
    pub staking_per_hour_common: u64,
    pub staking_per_hour_rare: u64,
    pub staking_per_hour_epic: u64,
    pub staking_per_hour_legendary: u64,
}

impl TokenRates {
    pub const LEN: usize = 8 * 15; // 15 u64 fields
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RaceStats {
    pub race_id: u64,
    pub completed: bool,
    pub won: bool,
    pub distance: u64,
    pub obstacles_avoided: u64,
    pub bonus_boxes_collected: u64,
    pub lap_time: u64,
    pub score: u64,
}

// Enums
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub enum ChallengeDifficulty {
    Easy,
    Medium,
    Hard,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub enum TournamentPlacement {
    Participation,
    Winner,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub enum CarRarity {
    Common,
    Rare,
    Epic,
    Legendary,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub enum RewardType {
    RaceCompletion,
    DailyChallenge,
    Tournament,
    WelcomeBonus,
    Staking,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub enum SpendType {
    TournamentEntry,
    CarUpgrade,
    CarCustomization,
    StakingBoost,
}

// Events
#[event]
pub struct TokenReward {
    pub player: Pubkey,
    pub amount: u64,
    pub reward_type: RewardType,
    pub race_id: u64,
    pub timestamp: i64,
}

#[event]
pub struct TokenSpend {
    pub player: Pubkey,
    pub amount: u64,
    pub spend_type: SpendType,
    pub timestamp: i64,
}

// Error Codes
#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Insufficient token balance")]
    InsufficientBalance,
    #[msg("Invalid reward amount")]
    InvalidRewardAmount,
    #[msg("Game state not initialized")]
    GameStateNotInitialized,
    #[msg("Insufficient vault balance")]
    InsufficientVaultBalance,
}