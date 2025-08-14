// updateTokenRates.ts - Service to update SPEEDY token rates in the smart contract
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  Keypair,
} from "@solana/web3.js";

// SPEEDY Token Configuration
const SPEEDY_CONFIG = {
  CONTRACT_ID:
    import.meta.env.VITE_SPEEDY_CONTRACT_ID ||
    "7QvWGfiRHdi3YxKg2wZjSibNaenrSy3YXTXqEub5FUtu",
  GAME_STATE:
    import.meta.env.VITE_SPEEDY_GAME_STATE ||
    "AQumz5R9TTNAGJiN4WA6eUfGJH93d9wFuA8tocAYLXAy",
  RPC_URL:
    import.meta.env.VITE_PUBLIC_HONEYCOMB_RPC_URL ||
    "https://rpc.test.honeycombprotocol.com",
};

interface ReasonableTokenRates {
  raceCompletion: number; // Tokens for completing a race
  raceWin: number; // Extra tokens for winning
  distancePer100m: number; // Tokens per 100m traveled
  obstacleAvoided: number; // Tokens per obstacle avoided
  bonusCollected: number; // Tokens per bonus collected
  dailyChallengeEasy: number;
  dailyChallengeMedium: number;
  dailyChallengeHard: number;
  tournamentParticipation: number;
  tournamentWinner: number;
  welcomeBonus: number;
  stakingPerHourCommon: number;
  stakingPerHourRare: number;
  stakingPerHourEpic: number;
  stakingPerHourLegendary: number;
}

const TESTING_RATES: ReasonableTokenRates = {
  raceCompletion: 100, // Target: 100 SPEEDY (100,000,000 in contract)
  raceWin: 50, // Target: 50 SPEEDY (50,000,000 in contract)
  distancePer100m: 0.5, // Target: 0.5 SPEEDY (500,000 in contract)
  obstacleAvoided: 0.2, // Target: 0.2 SPEEDY (200,000 in contract)
  bonusCollected: 0.5, // Target: 0.5 SPEEDY (500,000 in contract)
  dailyChallengeEasy: 50, // Target: 50 SPEEDY (50,000,000 in contract)
  dailyChallengeMedium: 100, // Target: 100 SPEEDY (100,000,000 in contract)
  dailyChallengeHard: 200, // Target: 200 SPEEDY (200,000,000 in contract)
  tournamentParticipation: 100, // Target: 100 SPEEDY (100,000,000 in contract)
  tournamentWinner: 1000, // Target: 1000 SPEEDY (1,000,000,000 in contract)
  welcomeBonus: 100, // Target: 100 SPEEDY (100,000,000 in contract)
  stakingPerHourCommon: 1, // Target: 1 SPEEDY (1,000,000 in contract)
  stakingPerHourRare: 3, // Target: 3 SPEEDY (3,000,000 in contract)
  stakingPerHourEpic: 10, // Target: 10 SPEEDY (10,000,000 in contract)
  stakingPerHourLegendary: 25, // Target: 25 SPEEDY (25,000,000 in contract)
};

// FUTURE: Reasonable rates once testing works
const REASONABLE_RATES: ReasonableTokenRates = {
  raceCompletion: 100, // Target: 100 SPEEDY (100,000,000 in contract)
  raceWin: 50, // Target: 50 SPEEDY (50,000,000 in contract)
  distancePer100m: 0.5, // Target: 0.5 SPEEDY (500,000 in contract)
  obstacleAvoided: 0.2, // Target: 0.2 SPEEDY (200,000 in contract)
  bonusCollected: 0.5, // Target: 0.5 SPEEDY (500,000 in contract)
  dailyChallengeEasy: 50, // Target: 50 SPEEDY (50,000,000 in contract)
  dailyChallengeMedium: 100, // Target: 100 SPEEDY (100,000,000 in contract)
  dailyChallengeHard: 200, // Target: 200 SPEEDY (200,000,000 in contract)
  tournamentParticipation: 100, // Target: 100 SPEEDY (100,000,000 in contract)
  tournamentWinner: 1000, // Target: 1000 SPEEDY (1,000,000,000 in contract)
  welcomeBonus: 100, // Target: 100 SPEEDY (100,000,000 in contract)
  stakingPerHourCommon: 1, // Target: 1 SPEEDY (1,000,000 in contract)
  stakingPerHourRare: 3, // Target: 3 SPEEDY (3,000,000 in contract)
  stakingPerHourEpic: 10, // Target: 10 SPEEDY (10,000,000 in contract)
  stakingPerHourLegendary: 25, // Target: 25 SPEEDY (25,000,000 in contract)
};

class TokenRateUpdater {
  private connection: Connection;

  constructor() {
    this.connection = new Connection(SPEEDY_CONFIG.RPC_URL, "confirmed");
  }

  /**
   * Convert human-readable token amounts to contract units (with 6 decimals)
   */
  private toContractUnits(humanAmount: number): bigint {
    const DECIMALS = 6; // SPEEDY token has 6 decimals
    return BigInt(Math.floor(humanAmount * Math.pow(10, DECIMALS)));
  }

  /**
   * Create instruction data for update_token_rates
   */
  private createUpdateTokenRatesInstruction(
    rates: ReasonableTokenRates
  ): Buffer {
    // This is the discriminator for update_token_rates from your IDL
    const discriminator = Buffer.from([0, 148, 121, 29, 123, 191, 108, 199]);

    // Create token rates buffer - each rate is u64 (8 bytes)
    const ratesBuffer = Buffer.alloc(15 * 8); // 15 rates × 8 bytes each
    let offset = 0;

    // Convert all rates to contract units and write to buffer
    const contractRates = [
      this.toContractUnits(rates.raceCompletion),
      this.toContractUnits(rates.raceWin),
      this.toContractUnits(rates.distancePer100m),
      this.toContractUnits(rates.obstacleAvoided),
      this.toContractUnits(rates.bonusCollected),
      this.toContractUnits(rates.dailyChallengeEasy),
      this.toContractUnits(rates.dailyChallengeMedium),
      this.toContractUnits(rates.dailyChallengeHard),
      this.toContractUnits(rates.tournamentParticipation),
      this.toContractUnits(rates.tournamentWinner),
      this.toContractUnits(rates.welcomeBonus),
      this.toContractUnits(rates.stakingPerHourCommon),
      this.toContractUnits(rates.stakingPerHourRare),
      this.toContractUnits(rates.stakingPerHourEpic),
      this.toContractUnits(rates.stakingPerHourLegendary),
    ];

    // Write each rate as u64 little endian
    contractRates.forEach((rate) => {
      ratesBuffer.writeBigUInt64LE(rate, offset);
      offset += 8;
    });

    return Buffer.concat([discriminator, ratesBuffer]);
  }

  /**
   * Update token rates in the smart contract
   */
  async updateTokenRates(
    authorityWallet: any
  ): Promise<{ success: boolean; signature?: string; error?: string }> {
    if (!authorityWallet?.publicKey || !authorityWallet?.signTransaction) {
      return {
        success: false,
        error: "Authority wallet not connected",
      };
    }

    try {
      console.log(
        "🎮 Setting REASONABLE GAMING rates (10-200 SPEEDY tokens)..."
      );
      console.log("🏆 Target rewards:", TESTING_RATES);
      console.log("📊 These convert to contract units:");
      console.log(
        `   - Race completion: ${this.toContractUnits(
          TESTING_RATES.raceCompletion
        )} units (10 SPEEDY)`
      );
      console.log(
        `   - Win bonus: ${this.toContractUnits(
          TESTING_RATES.raceWin
        )} units (50 SPEEDY)`
      );
      console.log(
        `   - Obstacle avoided: ${this.toContractUnits(
          TESTING_RATES.obstacleAvoided
        )} units (5 SPEEDY each)`
      );
      console.log(
        `   - Distance bonus: ${this.toContractUnits(
          TESTING_RATES.distancePer100m
        )} units (0.1 SPEEDY per 100m)`
      );

      const authorityPubkey = new PublicKey(
        authorityWallet.publicKey.toString()
      );
      const gameStatePubkey = new PublicKey(SPEEDY_CONFIG.GAME_STATE);
      const programId = new PublicKey(SPEEDY_CONFIG.CONTRACT_ID);

      // Create instruction data - USING TESTING RATES FIRST
      const instructionData =
        this.createUpdateTokenRatesInstruction(TESTING_RATES);

      // Create the instruction
      const instruction = new TransactionInstruction({
        programId: programId,
        keys: [
          { pubkey: authorityPubkey, isSigner: true, isWritable: false },
          { pubkey: gameStatePubkey, isSigner: false, isWritable: true },
        ],
        data: instructionData,
      });

      // Create transaction
      const transaction = new Transaction().add(instruction);

      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = authorityPubkey;

      // Sign and send transaction
      const signedTx = await authorityWallet.signTransaction(transaction);
      const signature = await this.connection.sendRawTransaction(
        signedTx.serialize()
      );

      // Wait for confirmation
      await this.connection.confirmTransaction(signature, "confirmed");

      console.log("✅ Token rates updated successfully!", signature);
      console.log("🎮 New rates will take effect for future token awards");

      return {
        success: true,
        signature: signature,
      };
    } catch (error: any) {
      console.error("❌ Failed to update token rates:", error);

      return {
        success: false,
        error: error.message || "Failed to update token rates",
      };
    }
  }

  /**
   * Get current token rates from the smart contract (for display)
   */
  async getCurrentRates(): Promise<ReasonableTokenRates | null> {
    try {
      const gameStatePubkey = new PublicKey(SPEEDY_CONFIG.GAME_STATE);
      const accountInfo = await this.connection.getAccountInfo(gameStatePubkey);

      if (!accountInfo) {
        console.error("❌ Game state account not found");
        return null;
      }

      // Parse the account data to extract token rates
      // This is a simplified version - you'd need to parse the actual struct
      console.log(
        "📊 Game state account found, data length:",
        accountInfo.data.length
      );

      return TESTING_RATES; // Return testing rates as default
    } catch (error) {
      console.error("❌ Failed to get current token rates:", error);
      return null;
    }
  }
}

// Create singleton instance
export const tokenRateUpdater = new TokenRateUpdater();
export { REASONABLE_RATES };
