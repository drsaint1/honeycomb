import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, web3, setProvider } from "@coral-xyz/anchor";
import { SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAccount
} from "@solana/spl-token";
// Adjust these paths to where your IDL and TS types are located
import idl from "../target/idl/speedy_token.json";
import type { SpeedyToken } from "../target/types/speedy_token";

const main = async () => {
  // Set up the provider using the modern approach
  const provider = AnchorProvider.env();
  setProvider(provider);

  // Create a Program instance using the IDL and the full provider
  const program = new Program(idl as SpeedyToken, provider);

  console.log("Program ID:", program.programId.toString());
  console.log("Wallet (Mint Authority):", provider.wallet.publicKey.toString());

  // Generate a new keypair for the token mint
  // Note: Token will be called "SPEEDY" as defined in your contract and frontend
  const tokenMint = web3.Keypair.generate();

  // Derive the PDA for the game state using seed "game_state"
  const [gameState] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("game_state")],
    program.programId
  );

  // Get vault token account (associated token account controlled by game state PDA)
  const vault = await getAssociatedTokenAddress(
    tokenMint.publicKey,
    gameState,
    true // allowOwnerOffCurve = true for PDA owners
  );

  // Get authority's token account for personal use and funding the vault
  const authorityTokenAccount = await getAssociatedTokenAddress(
    tokenMint.publicKey,
    provider.wallet.publicKey
  );

  // Print the derived addresses
  console.log("Token Mint:", tokenMint.publicKey.toString());
  console.log("Game State PDA:", gameState.toString());
  console.log("Vault Account:", vault.toString());
  console.log("Authority Token Account:", authorityTokenAccount.toString());

  console.log("\n=== Step 1: Initializing $SPEEDY token ===");

  // Call the initializeToken instruction with modern syntax
  const tx = await program.methods
    .initializeToken(6) // 6 decimals
    .accountsStrict({
      authority: provider.wallet.publicKey,
      tokenMint: tokenMint.publicKey,
      gameState: gameState,
      vault: vault,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: web3.SYSVAR_RENT_PUBKEY,
    })
    .signers([tokenMint])
    .rpc();

  console.log("Initialize token transaction signature:", tx);
  console.log("✅ $SPEEDY Token initialized successfully!");

  // Step 2: Create authority's token account and mint initial supply
  console.log("\n=== Step 2: Setting up authority token account and minting supply ===");
  
  const initialSupply = 1_000_000_000_000; // 1 million tokens (with 6 decimals)
  console.log(`Setting up authority token account and minting ${initialSupply / 1_000_000} SPEEDY tokens...`);

  try {
    // Create the authority's associated token account first, then mint
    const mintTx = new web3.Transaction();
    
    // Add instruction to create associated token account if it doesn't exist
    mintTx.add(
      createAssociatedTokenAccountInstruction(
        provider.wallet.publicKey,  // payer
        authorityTokenAccount,      // ata
        provider.wallet.publicKey,  // owner
        tokenMint.publicKey        // mint
      )
    );
    
    // Add mint instruction - mint to the authority's token account
    mintTx.add(
      createMintToInstruction(
        tokenMint.publicKey,       // mint
        authorityTokenAccount,     // destination (authority's token account)
        provider.wallet.publicKey, // mint authority (your wallet)
        initialSupply             // amount
      )
    );

    // Send and confirm transaction
    const signature = await provider.sendAndConfirm(mintTx);
    console.log("Mint transaction signature:", signature);
    console.log("✅ Initial supply minted successfully!");

    // Check balance
    const authorityBalance = await getAccount(provider.connection, authorityTokenAccount);
    console.log(`Authority token balance: ${Number(authorityBalance.amount) / 1_000_000} SPEEDY`);

  } catch (error) {
    console.log("❌ Failed to mint tokens");
    console.log("Error:", error.message);
    console.log("Make sure the token mint was created successfully in step 1");
  }

  // Step 3: Fund the vault with tokens for rewards
  console.log("\n=== Step 3: Funding the vault ===");
  
  const vaultFundAmount = 500_000_000_000; // 500,000 tokens for rewards
  console.log(`Funding vault with ${vaultFundAmount / 1_000_000} SPEEDY tokens...`);

  try {
    const fundTx = await program.methods
      .fundVault(new anchor.BN(vaultFundAmount))
      .accountsStrict({
        authority: provider.wallet.publicKey,
        gameState: gameState,
        authorityTokenAccount: authorityTokenAccount,
        vault: vault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("Fund vault transaction signature:", fundTx);
    console.log("✅ Vault funded successfully!");

    // Check vault balance
    const vaultBalance = await getAccount(provider.connection, vault);
    console.log(`Vault token balance: ${Number(vaultBalance.amount) / 1_000_000} SPEEDY`);

  } catch (error) {
    console.log("Note: Vault funding failed - make sure authority has tokens");
    console.log("Error:", error.message);
  }

  // Display environment variables for frontend integration
  console.log("\n=== Environment Variables for Frontend ===");
  console.log(`VITE_SPEEDY_CONTRACT_ID=${program.programId.toString()}`);
  console.log(`VITE_SPEEDY_TOKEN_MINT=${tokenMint.publicKey.toString()}`);
  console.log(`VITE_SPEEDY_GAME_STATE=${gameState.toString()}`);
  console.log(`VITE_SPEEDY_VAULT=${vault.toString()}`);

  // Step 4: Test awarding tokens to a player (example)
  console.log("\n=== Step 4: Testing Token Award ===");
  
  // Get player's associated token account
  const playerTokenAccount = await getAssociatedTokenAddress(
    tokenMint.publicKey,
    provider.wallet.publicKey
  );

  // Example race stats for testing
  const raceStats = {
    raceId: new anchor.BN(1),
    completed: true,
    won: true,
    distance: new anchor.BN(1000), // 1000 meters
    obstaclesAvoided: new anchor.BN(5),
    bonusBoxesCollected: new anchor.BN(3),
    lapTime: new anchor.BN(60000), // 60 seconds in milliseconds
    score: new anchor.BN(850)
  };

  try {
    const awardTx = await program.methods
      .awardRaceTokens(raceStats)
      .accountsStrict({
        player: provider.wallet.publicKey,
        gameState: gameState,
        tokenMint: tokenMint.publicKey,
        vault: vault,
        playerTokenAccount: playerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    console.log("Award tokens transaction signature:", awardTx);
    console.log("✅ Test tokens awarded successfully!");

    // Check player balance
    const playerBalance = await getAccount(provider.connection, playerTokenAccount);
    console.log(`Player token balance: ${Number(playerBalance.amount) / 1_000_000} SPEEDY`);

  } catch (error) {
    console.log("Note: Award tokens test failed");
    console.log("Error:", error.message);
  }

  // Step 5: Test welcome bonus award
  console.log("\n=== Step 5: Testing Welcome Bonus ===");
  
  try {
    const welcomeTx = await program.methods
      .awardWelcomeBonus()
      .accountsStrict({
        player: provider.wallet.publicKey,
        gameState: gameState,
        tokenMint: tokenMint.publicKey,
        vault: vault,
        playerTokenAccount: playerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    console.log("Welcome bonus transaction signature:", welcomeTx);
    console.log("✅ Welcome bonus awarded successfully!");

    // Check updated player balance
    const playerBalance = await getAccount(provider.connection, playerTokenAccount);
    console.log(`Player token balance after welcome bonus: ${Number(playerBalance.amount) / 1_000_000} SPEEDY`);

  } catch (error) {
    console.log("Note: Welcome bonus test failed");
    console.log("Error:", error.message);
  }

  // Step 6: Test challenge tokens
  console.log("\n=== Step 6: Testing Challenge Reward ===");
  
  try {
    const challengeTx = await program.methods
      .awardChallengeTokens({ hard: {} }, new anchor.BN(123)) // Hard difficulty challenge
      .accountsStrict({
        player: provider.wallet.publicKey,
        gameState: gameState,
        tokenMint: tokenMint.publicKey,
        vault: vault,
        playerTokenAccount: playerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    console.log("Challenge reward transaction signature:", challengeTx);
    console.log("✅ Challenge reward awarded successfully!");

    // Check final player balance
    const playerBalance = await getAccount(provider.connection, playerTokenAccount);
    console.log(`Player final token balance: ${Number(playerBalance.amount) / 1_000_000} SPEEDY`);

  } catch (error) {
    console.log("Note: Challenge reward test failed");
    console.log("Error:", error.message);
  }

  // Display final balances
  console.log("\n=== Final Account Balances ===");
  
  try {
    const vaultBalance = await getAccount(provider.connection, vault);
    console.log(`Vault Balance: ${Number(vaultBalance.amount) / 1_000_000} SPEEDY`);

    const playerBalance = await getAccount(provider.connection, playerTokenAccount);
    console.log(`Player Balance: ${Number(playerBalance.amount) / 1_000_000} SPEEDY`);

    const authorityBalance = await getAccount(provider.connection, authorityTokenAccount);
    console.log(`Authority Balance: ${Number(authorityBalance.amount) / 1_000_000} SPEEDY`);

  } catch (error) {
    console.log("Note: Could not fetch all balances");
    console.log("Error:", error.message);
  }

  console.log("\n=== Deployment Summary ===");
  console.log("🎮 Speedy Token Program deployed and initialized with vault system!");
  console.log("💰 Vault system allows controlled token distribution from pre-funded reserves");
  console.log("🔑 Your wallet is the mint authority and can mint more tokens as needed");
  console.log("📝 Save the environment variables above for your frontend");
  console.log("🚀 Ready to integrate with your racing game!");

  console.log("\n=== Next Steps ===");
  console.log("1. Save the environment variables to your frontend .env file");
  console.log("2. Fund the vault with more tokens using the fundVault function when needed");
  console.log("3. Monitor vault balance and refill as rewards are distributed");
  console.log("4. Tokens spent by players are now burned to create deflationary pressure");
};

main()
  .then(() => console.log("\n🎉 All initialization completed successfully!"))
  .catch((err) => {
    console.error("❌ Error during initialization:", err);
    process.exit(1);
  });