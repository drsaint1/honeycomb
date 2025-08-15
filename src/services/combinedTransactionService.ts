// combinedTransactionService.ts - Single wallet approval for SPEEDY tokens + Honeycomb stats
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { createEdgeClient } from "@honeycomb-protocol/edge-client";
import { sendClientTransactions } from "@honeycomb-protocol/edge-client/client/walletHelpers";
import { getOrCreateAccessToken } from "../utils/accessToken";

// SPEEDY Token Configuration
const SPEEDY_CONFIG = {
  CONTRACT_ID:
    import.meta.env.VITE_SPEEDY_CONTRACT_ID ||
    "7QvWGfiRHdi3YxKg2wZjSibNaenrSy3YXTXqEub5FUtu",
  TOKEN_MINT:
    import.meta.env.VITE_SPEEDY_TOKEN_MINT ||
    "ANbzjp3diuyUcrsQmyvRPRGrR9ckgTiPsxTLcfFPTSC2",
  GAME_STATE:
    import.meta.env.VITE_SPEEDY_GAME_STATE ||
    "AQumz5R9TTNAGJiN4WA6eUfGJH93d9wFuA8tocAYLXAy",
  VAULT:
    import.meta.env.VITE_SPEEDY_VAULT ||
    "vault_address_here",
  RPC_URL:
    import.meta.env.VITE_PUBLIC_HONEYCOMB_RPC_URL ||
    "https://rpc.test.honeycombprotocol.com",
};

// Honeycomb Configuration
const HONEYCOMB_CONFIG = {
  API_URL:
    import.meta.env.VITE_PUBLIC_HONEYCOMB_API_URL ||
    "https://edge.test.honeycombprotocol.com/",
  PROJECT_ADDRESS:
    import.meta.env.VITE_PUBLIC_HONEYCOMB_PROJECT_ADDRESS ||
    "5hJ1ixXYG3b94JbPPfN6uZQHS1NvKmw4LPpVVc2UbkuT",
};

export interface RaceStats {
  raceId: number;
  completed: boolean;
  won: boolean;
  distance: number;
  obstaclesAvoided: number;
  bonusBoxesCollected: number;
  lapTime: number;
  score: number;
}

export interface GameStats {
  score: number;
  distance: number;
  obstaclesAvoided: number;
  bonusBoxesCollected: number;
  lapTime: number;
  gameCompleted: boolean;
}

export interface CombinedTransactionResult {
  success: boolean;
  speedyTokensEarned: number;
  honeycombStatsUpdated: boolean;
  transactionSignature?: string;
  error?: string;
}

class CombinedTransactionService {
  private connection: Connection;
  private client: any;

  constructor() {
    this.connection = new Connection(SPEEDY_CONFIG.RPC_URL, "confirmed");
    this.client = createEdgeClient(HONEYCOMB_CONFIG.API_URL, true);
  }

  /**
   * Create SPEEDY token instruction
   */
  private createSpeedyTokenInstruction(
    raceStats: RaceStats,
    playerPubkey: PublicKey,
    gameStatePubkey: PublicKey,
    tokenMintPubkey: PublicKey,
    vaultPubkey: PublicKey,
    playerTokenAccount: PublicKey
  ): TransactionInstruction {
    // Discriminator for award_race_tokens function
    const discriminator = Buffer.from([67, 13, 10, 70, 239, 18, 103, 41]);

    // Process stats with validation
    const processedStats = {
      raceId: Math.max(1, Math.min(raceStats.raceId, 999999)),
      completed: true,
      won: raceStats.won,
      distance: Math.max(100, Math.min(raceStats.distance, 10000)),
      obstaclesAvoided: Math.max(0, Math.min(raceStats.obstaclesAvoided, 20)),
      bonusBoxesCollected: Math.max(0, Math.min(raceStats.bonusBoxesCollected, 10)),
      lapTime: Math.max(1, Math.min(raceStats.lapTime, 3600)),
      score: Math.max(100, Math.min(raceStats.score, 1000000)),
    };

    // Create buffer for RaceStats struct (50 bytes total)
    const raceStatsBuffer = Buffer.alloc(50);
    let offset = 0;

    // race_id: u64
    raceStatsBuffer.writeBigUInt64LE(BigInt(processedStats.raceId), offset);
    offset += 8;

    // completed: bool
    raceStatsBuffer.writeUInt8(processedStats.completed ? 1 : 0, offset);
    offset += 1;

    // won: bool
    raceStatsBuffer.writeUInt8(processedStats.won ? 1 : 0, offset);
    offset += 1;

    // distance: u64
    raceStatsBuffer.writeBigUInt64LE(BigInt(processedStats.distance), offset);
    offset += 8;

    // obstacles_avoided: u64
    raceStatsBuffer.writeBigUInt64LE(BigInt(processedStats.obstaclesAvoided), offset);
    offset += 8;

    // bonus_boxes_collected: u64
    raceStatsBuffer.writeBigUInt64LE(BigInt(processedStats.bonusBoxesCollected), offset);
    offset += 8;

    // lap_time: u64
    raceStatsBuffer.writeBigUInt64LE(BigInt(processedStats.lapTime), offset);
    offset += 8;

    // score: u64
    raceStatsBuffer.writeBigUInt64LE(BigInt(processedStats.score), offset);

    const instructionData = Buffer.concat([discriminator, raceStatsBuffer]);

    const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
    const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

    return new TransactionInstruction({
      programId: new PublicKey(SPEEDY_CONFIG.CONTRACT_ID),
      keys: [
        { pubkey: playerPubkey, isSigner: true, isWritable: true },
        { pubkey: gameStatePubkey, isSigner: false, isWritable: true },
        { pubkey: tokenMintPubkey, isSigner: false, isWritable: true },
        { pubkey: vaultPubkey, isSigner: false, isWritable: true },
        { pubkey: playerTokenAccount, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: new PublicKey("11111111111111111111111111111111"), isSigner: false, isWritable: false },
        { pubkey: new PublicKey("SysvarRent111111111111111111111111111111111"), isSigner: false, isWritable: false },
      ],
      data: instructionData,
    });
  }

  /**
   * Get Honeycomb transaction instructions
   */
  private async getHoneycombInstructions(
    gameStats: GameStats,
    playerProfile: any,
    honeycombProfile: any,
    honeycombProject: any,
    wallet: any
  ): Promise<any> {
    try {
      if (honeycombProfile?.address === "pending-user-creation") {
        return null;
      }
      
      // Get access token with proper wallet parameters
      const accessToken = await getOrCreateAccessToken(
        wallet.publicKey.toString(),
        wallet.signMessage?.bind(wallet) || wallet.adapter.signMessage?.bind(wallet.adapter) || wallet.adapter.signMessage
      );
      
      // Calculate XP gained for local profile update
      const xpGained = this.calculateXpGain(gameStats);
      
      // Prepare custom data updates
      const updatedProfile = {
        ...playerProfile,
        gamesPlayed: playerProfile.gamesPlayed + 1,
        totalXp: playerProfile.totalXp + xpGained,
        totalDistance: playerProfile.totalDistance + gameStats.distance,
        totalObstaclesAvoided: playerProfile.totalObstaclesAvoided + gameStats.obstaclesAvoided,
        totalBonusBoxesCollected: playerProfile.totalBonusBoxesCollected + gameStats.bonusBoxesCollected,
        lastPlayedAt: Date.now(),
      };

      if (gameStats.score > updatedProfile.highScore) {
        updatedProfile.highScore = gameStats.score;
      }

      if (gameStats.lapTime > 0 && (updatedProfile.bestLapTime === 0 || gameStats.lapTime < updatedProfile.bestLapTime)) {
        updatedProfile.bestLapTime = gameStats.lapTime;
      }

      const customDataUpdates = {
        gamesPlayed: updatedProfile.gamesPlayed.toString(),
        highScore: updatedProfile.highScore.toString(),
        totalDistance: updatedProfile.totalDistance.toString(),
        bestLapTime: updatedProfile.bestLapTime.toString(),
        totalObstaclesAvoided: updatedProfile.totalObstaclesAvoided.toString(),
        totalBonusBoxesCollected: updatedProfile.totalBonusBoxesCollected.toString(),
      };

      // Create Honeycomb transaction using correct API format
      const {
        createUpdateProfileTransaction: txResponse
      } = await this.client.createUpdateProfileTransaction({
        payer: wallet.publicKey.toString(),
        profile: honeycombProfile.address,
        customData: {
          add: Object.entries(customDataUpdates).reduce((acc, [key, value]) => {
            acc[key] = [value.toString()];
            return acc;
          }, {} as Record<string, string[]>)
        },
      }, {
        fetchOptions: {
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
      });

      return txResponse;
    } catch (error) {
      console.error("❌ Failed to create Honeycomb transaction:", error);
      return null;
    }
  }

  /**
   * Calculate XP gain from game stats
   */
  private calculateXpGain(gameStats: GameStats): number {
    let xp = 10; // Base XP

    // Score-based XP
    xp += Math.floor(gameStats.score / 500) * 5;

    // Distance-based XP
    xp += Math.floor(gameStats.distance / 1000) * 10;

    // Bonus XP for performance
    if (gameStats.obstaclesAvoided > 5) xp += 10;
    if (gameStats.bonusBoxesCollected > 3) xp += 15;
    if (gameStats.lapTime > 0 && gameStats.lapTime < 60) xp += 15;

    return Math.max(10, xp);
  }

  /**
   * Estimate SPEEDY tokens from race stats
   */
  private estimateSpeedyTokens(raceStats: RaceStats): number {
    // Using current reasonable rates
    const RATES = {
      raceCompletion: 100,
      raceWin: 50,
      distancePer100m: 0.5,
      obstacleAvoided: 0.2,
      bonusCollected: 0.5,
    };

    let total = 0;

    if (raceStats.completed) {
      total += RATES.raceCompletion;
    }

    if (raceStats.won) {
      total += RATES.raceWin;
    }

    // Distance bonus (per 100m)
    const distanceHundreds = Math.floor(raceStats.distance / 100);
    total += distanceHundreds * RATES.distancePer100m;

    // Obstacles and bonuses
    total += raceStats.obstaclesAvoided * RATES.obstacleAvoided;
    total += raceStats.bonusBoxesCollected * RATES.bonusCollected;

    return total;
  }

  /**
   * Execute combined transaction for SPEEDY tokens + Honeycomb stats
   */
  async executeCombinedTransaction(
    wallet: any,
    raceStats: RaceStats,
    gameStats: GameStats,
    playerProfile: any,
    honeycombProfile: any,
    honeycombProject: any
  ): Promise<CombinedTransactionResult> {
    if (!wallet?.publicKey || !wallet?.signAllTransactions) {
      return {
        success: false,
        speedyTokensEarned: 0,
        honeycombStatsUpdated: false,
        error: "Wallet not connected or missing required methods",
      };
    }

    try {

      const playerPubkey = new PublicKey(wallet.publicKey.toString());
      const gameStatePubkey = new PublicKey(SPEEDY_CONFIG.GAME_STATE);
      const tokenMintPubkey = new PublicKey(SPEEDY_CONFIG.TOKEN_MINT);
      const vaultPubkey = new PublicKey(SPEEDY_CONFIG.VAULT);

      // Find player's associated token account
      const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
      const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

      const [playerTokenAccount] = await PublicKey.findProgramAddressSync(
        [
          playerPubkey.toBuffer(),
          TOKEN_PROGRAM_ID.toBuffer(),
          tokenMintPubkey.toBuffer(),
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      // Create SPEEDY token instruction
      const speedyInstruction = this.createSpeedyTokenInstruction(
        raceStats,
        playerPubkey,
        gameStatePubkey,
        tokenMintPubkey,
        vaultPubkey,
        playerTokenAccount
      );


      // Get Honeycomb transaction
      const honeycombTxResponse = await this.getHoneycombInstructions(
        gameStats,
        playerProfile,
        honeycombProfile,
        honeycombProject,
        wallet
      );

      if (!honeycombTxResponse) {
        throw new Error("Failed to create Honeycomb transaction");
      }

      console.log("✅ Honeycomb transaction instructions created");
      console.log("🔍 Honeycomb transaction response structure:", {
        hasTransactions: !!honeycombTxResponse.transactions,
        transactionsLength: honeycombTxResponse.transactions?.length,
        responseKeys: Object.keys(honeycombTxResponse),
        responseValues: Object.keys(honeycombTxResponse).map(key => ({
          key,
          type: typeof honeycombTxResponse[key],
          isArray: Array.isArray(honeycombTxResponse[key])
        })),
        fullResponse: honeycombTxResponse
      });

      // Create wallet object for Honeycomb
      const walletForTransaction = {
        adapter: wallet.adapter,
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions,
        connected: true,
      };

      // Send separate transactions: Honeycomb + SPEEDY tokens
      const honeycombSignatures = await sendClientTransactions(
        this.client,
        walletForTransaction,
        honeycombTxResponse
      );

      if (!honeycombSignatures || honeycombSignatures.length === 0) {
        throw new Error("Honeycomb transaction failed");
      }

      // Send SPEEDY token transaction
      const speedyTransaction = new Transaction().add(speedyInstruction);
      const { blockhash } = await this.connection.getLatestBlockhash();
      speedyTransaction.recentBlockhash = blockhash;
      speedyTransaction.feePayer = new PublicKey(wallet.publicKey.toString());

      const signedSpeedyTx = await walletForTransaction.signTransaction(speedyTransaction);
      const speedySignature = await this.connection.sendRawTransaction(
        signedSpeedyTx.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: "confirmed",
          maxRetries: 3,
        }
      );

      await this.connection.confirmTransaction(speedySignature, "confirmed");

      const signatures = [honeycombSignatures[0], speedySignature];

      if (signatures && signatures.length >= 2) {
        const estimatedTokens = this.estimateSpeedyTokens(raceStats);
        
        return {
          success: true,
          speedyTokensEarned: estimatedTokens,
          honeycombStatsUpdated: true,
          transactionSignature: typeof signatures[1] === 'string' ? signatures[1] : (signatures[1] as any).signature || 'unknown',
        };
      }

      throw new Error("Transaction failed - no signatures returned");

    } catch (error: any) {
      console.error("❌ Combined transaction failed:", error);
      
      return {
        success: false,
        speedyTokensEarned: 0,
        honeycombStatsUpdated: false,
        error: error.message || "Combined transaction failed",
      };
    }
  }
}

// Create singleton instance
export const combinedTransactionService = new CombinedTransactionService();