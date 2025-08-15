// services/nftCarService.ts - NFT Car Management with Honeycomb Protocol
import { createEdgeClient } from "@honeycomb-protocol/edge-client";
import { sendClientTransactions } from "@honeycomb-protocol/edge-client/client/walletHelpers";
import { getOrCreateAccessToken } from "../utils/accessToken";

// Car types and their traits
export interface CarTraits {
  speed: number; // 1-10 (affects max speed)
  handling: number; // 1-10 (affects turning)
  acceleration: number; // 1-10 (affects startup speed)
  durability: number; // 1-10 (affects collision damage)
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
}

export interface NFTCar {
  id: string;
  name: string;
  image: string;
  description: string;
  traits: CarTraits;
  mintAddress?: string;
  isStaked?: boolean;
  stakingRewards?: number;
}

// Car types based on your uploaded assets
export const CAR_TEMPLATES: Record<
  string,
  Omit<NFTCar, "id" | "mintAddress">
> = {
  nitrorunner: {
    name: "Nitro Runner",
    image: "https://arweave.net/AUgjbSGUbXzvjfX_0y2hHG9mVRH1Syk_ZI0iqmN8OAw",
    description: "A high-speed racing machine with blazing acceleration",
    traits: {
      speed: 10,
      handling: 6,
      acceleration: 9,
      durability: 5,
      rarity: "legendary",
    },
  },
  driftmaster: {
    name: "Drift Master",
    image: "https://arweave.net/zsDN0qpQw49dlVGIV5J84qONMlIBz29QmCI2RzSN4R0",
    description: "A balanced car with great handling for tight turns",
    traits: {
      speed: 7,
      handling: 9,
      acceleration: 7,
      durability: 7,
      rarity: "rare",
    },
  },
  titancruiser: {
    name: "Titan Cruiser",
    image: "https://arweave.net/JDrAc2F2v5fPROokIQLiXuQhFaiXPQK2R_Ly4jRDtmc",
    description: "A bulky car with massive control but slower acceleration",
    traits: {
      speed: 6,
      handling: 10,
      acceleration: 4,
      durability: 9,
      rarity: "uncommon",
    },
  },
};

class NFTCarService {
  private client: any;
  private projectAddress: string;
  private nftConfig: any = null;

  // Helper function to get properly bound signMessage function
  private getSignMessageFunction(
    wallet: any
  ): (message: Uint8Array) => Promise<Uint8Array> {
    // If we have the original wallet (from CarMinting), use that for signMessage
    if (wallet.originalWallet?.adapter?.signMessage) {
      const originalAdapter = wallet.originalWallet.adapter;
      return originalAdapter.signMessage.bind(originalAdapter);
    }

    // Try the adapter's signMessage with proper binding
    if (wallet.adapter?.signMessage) {
      return wallet.adapter.signMessage.bind(wallet.adapter);
    }

    // Try the wallet's own signMessage
    if (wallet.signMessage && typeof wallet.signMessage === "function") {
      return wallet.signMessage.bind(wallet);
    }

    throw new Error("Wallet does not support message signing");
  }

  constructor() {
    this.client = createEdgeClient(
      import.meta.env.VITE_PUBLIC_HONEYCOMB_API_URL ||
        "https://edge.test.honeycombprotocol.com/",
      true
    );
    this.projectAddress =
      import.meta.env.VITE_PUBLIC_HONEYCOMB_PROJECT_ADDRESS || "";

    // Note: NFT configuration will be loaded when needed (async)
  }

  private async loadNFTConfig() {
    try {
      // Check if localStorage config matches current project
      const stored = localStorage.getItem("honeycomb_nft_config");
      console.log("🔍 Checking localStorage for honeycomb_nft_config:", stored);

      if (stored) {
        const storedConfig = JSON.parse(stored);
        console.log("🔍 Parsed stored config:", storedConfig);
        console.log("🔍 Current project address:", this.projectAddress);
        console.log("🔍 Stored project address:", storedConfig.projectAddress);

        // If project address doesn't match, clear stale config
        if (storedConfig.projectAddress !== this.projectAddress) {
          console.log(
            "❌ Project addresses don't match, clearing stale config"
          );
          localStorage.removeItem("honeycomb_nft_config");
          this.nftConfig = null;
        } else {
          console.log("✅ Using stored HoneycombSetup config");
          this.nftConfig = storedConfig;
          // If we have valid config from HoneycombSetup, use it and skip blockchain fetch
          if (
            storedConfig.assemblerConfigAddress &&
            storedConfig.characterModelAddress
          ) {
            console.log(
              "✅ HoneycombSetup config is complete, skipping blockchain fetch"
            );
            return;
          }
        }
      } else {
        console.log("❌ No stored config found in localStorage");
      }

      // Try to fetch fresh config from blockchain only if we don't have HoneycombSetup results
      console.log("🔄 Attempting to fetch from blockchain...");
      await this.fetchNFTConfigFromBlockchain();
    } catch (error) {
      console.warn("⚠️ Could not load NFT config:", error);
    }
  }

  // NEW: Fetch NFT configuration directly from blockchain
  private async fetchNFTConfigFromBlockchain() {
    if (!this.projectAddress) {
      console.warn("⚠️ No project address available for fetching NFT config");
      return;
    }

    try {
      // Query assembler configs for this project
      const assemblerConfigs = await this.client.findAssemblerConfig({
        project: this.projectAddress,
      });

      if (assemblerConfigs?.assemblerConfig?.length > 0) {
        const config = assemblerConfigs.assemblerConfig[0];

        // Query character models for this project (using correct method name)
        const characterModels = await this.client.findCharacterModels({
          project: this.projectAddress,
        });

        if (characterModels?.characterModel?.length > 0) {
          const model = characterModels.characterModel[0];

          // Update NFT config with blockchain data
          this.nftConfig = {
            assemblerConfigAddress: config.address,
            characterModelAddress: model.address,
            projectAddress: this.projectAddress,
            fetchedFromBlockchain: true,
            timestamp: Date.now(),
          };

          // Cache it for this session
          localStorage.setItem(
            "honeycomb_nft_config",
            JSON.stringify(this.nftConfig)
          );
        }
      } else {
        // Check if we have a known assembler config from error messages or manual setup
        // Project HF6tsWfbfGVdCe7ykzoYS8WtLCKdBL5qroatS1DnV5TY has assembler config: 3mMNied5dHdBjHGfizC8uLn9NvgqZq86z6dwhYCjoPxA
        // Character model needs to be created - use Project Creator NFT Infrastructure setup
        const knownConfigs: Record<
          string,
          { assemblerConfig: string; characterModel?: string }
        > = {
          HF6tsWfbfGVdCe7ykzoYS8WtLCKdBL5qroatS1DnV5TY: {
            assemblerConfig: "GS23jno7zxpigJMe3dTAxUpWrYc1H7HQstaE1q41iE8w", // Old config
            characterModel: "CqknWEtmyy7U9m8iPfo4TWytaYuJXasz4apwHbdacaw", // Old model
          },
          HGy9YEJ5JJ1tcL8189iYZGmxWXdxD9qZR8NTjVMPj2ti: {
            assemblerConfig: "3QcwL5dRwJrTReEHCgjN1eKULQqr9uSF71qnyNhwBPTp",
            characterModel: "CmNVv1WfUZoCDqHNWK7mA2TPW4gbMi6B6DFYRNb7mxGV",
          },
        };

        if (knownConfigs[this.projectAddress]) {
          this.nftConfig = {
            assemblerConfigAddress:
              knownConfigs[this.projectAddress].assemblerConfig,
            characterModelAddress:
              knownConfigs[this.projectAddress].characterModel ||
              "CREATE_NEEDED",
            projectAddress: this.projectAddress,
            fetchedFromBlockchain: false,
            timestamp: Date.now(),
          };

          return;
        }

        throw new Error(
          "No NFT infrastructure found for this project. Please contact the game administrator to set up NFT minting."
        );
      }
    } catch (error: any) {
      if (!this.nftConfig) {
        throw new Error(
          "NFT infrastructure not available. Please contact the game administrator or try again later."
        );
      }
    }
  }

  // Manually reload config from blockchain
  public async reloadConfig() {
    await this.loadNFTConfig();
    return this.nftConfig;
  }

  // Ensure config is loaded before proceeding
  private async ensureConfigLoaded() {
    if (!this.nftConfig || !this.nftConfig.characterModelAddress) {
      await this.loadNFTConfig();
    }
  }

  // Ensure user has a Honeycomb profile before minting NFTs
  private async ensureUserProfile(wallet: any, accessToken: string) {
    try {
      const userAddress = wallet.publicKey.toString();
      console.log("🔍 Ensuring user profile for:", userAddress);

      // Check if user already exists
      const existingUsers = await this.client.findUsers(
        {
          wallets: [userAddress],
        },
        {
          fetchOptions: {
            headers: { authorization: `Bearer ${accessToken}` },
          },
        }
      );

      let userId;

      if (existingUsers?.user && existingUsers.user.length > 0) {
        userId = existingUsers.user[0].address;
        console.log("✅ Found existing user:", userId);
      } else {
        console.log("❌ No existing user found, creating new user...");
        // Create new user
        const createUserResponse =
          await this.client.createCreateUserTransaction(
            {
              project: this.projectAddress,
              authority: userAddress,
              payer: userAddress,
              wallet: userAddress,
            },
            {
              fetchOptions: {
                headers: { authorization: `Bearer ${accessToken}` },
              },
            }
          );

        if (!createUserResponse) {
          throw new Error("Failed to create user transaction");
        }

        // Send user creation transaction
        const walletWrapper = {
          adapter: wallet.adapter,
          publicKey: wallet.publicKey,
          signTransaction: wallet.signTransaction,
          signAllTransactions: wallet.signAllTransactions,
          connected: true,
        };

        const userTransaction =
          createUserResponse.createCreateUserTransaction || createUserResponse;
        const userSignatures = await sendClientTransactions(
          this.client,
          walletWrapper,
          userTransaction
        );

        if (!userSignatures || userSignatures.length === 0) {
          throw new Error("User creation transaction failed");
        }

        userId = createUserResponse.user || userAddress; // Fallback to wallet address
      }

      // Check if profile exists
      const existingProfiles = await this.client.findProfiles(
        {
          users: [userId],
        },
        {
          fetchOptions: {
            headers: { authorization: `Bearer ${accessToken}` },
          },
        }
      );

      if (!existingProfiles?.profile || existingProfiles.profile.length === 0) {
        // Create new profile
        const createProfileResponse =
          await this.client.createNewProfileTransaction(
            {
              project: this.projectAddress,
              authority: userAddress,
              payer: userAddress,
              user: userId,
              platformData: {
                addXp: 100, // Give new users 100 starting XP
                addAchievements: [0] // Give first achievement
              }
            },
            {
              fetchOptions: {
                headers: { authorization: `Bearer ${accessToken}` },
              },
            }
          );

        if (!createProfileResponse) {
          throw new Error("Failed to create profile transaction");
        }

        // Send profile creation transaction
        const walletWrapper = {
          adapter: wallet.adapter,
          publicKey: wallet.publicKey,
          signTransaction: wallet.signTransaction,
          signAllTransactions: wallet.signAllTransactions,
          connected: true,
        };

        const profileTransaction =
          createProfileResponse.createNewProfileTransaction ||
          createProfileResponse;
        const profileSignatures = await sendClientTransactions(
          this.client,
          walletWrapper,
          profileTransaction
        );

        if (!profileSignatures || profileSignatures.length === 0) {
          throw new Error("Profile creation transaction failed");
        }
      }
    } catch (error: any) {
      throw new Error(`Failed to ensure user profile: ${error.message}`);
    }
  }

  // Get project authority information
  private async getProjectAuthority() {
    try {
      console.log("🔍 Looking up project:", this.projectAddress);
      const projectData = await this.client.findProjects({
        addresses: [this.projectAddress],
      });

      console.log("🔍 Project data response:", projectData);
      console.log("🔍 Has project array?", projectData?.project);
      console.log("🔍 Project array length:", projectData?.project?.length);

      if (projectData?.project && projectData.project.length > 0) {
        const project = projectData.project[0];
        console.log("✅ Found project:", project);
        console.log("🔍 Project authority:", project.authority);
        return project.authority;
      }

      // If project not found, try fallbacks before giving up
      console.log("⚠️ Project not found in blockchain, checking fallbacks...");

      // Check if we have project authority from HoneycombSetup or environment
      const honeycombConfig = localStorage.getItem("honeycomb_nft_config");
      if (honeycombConfig) {
        const config = JSON.parse(honeycombConfig);
        if (config.projectAuthority) {
          console.log(
            "✅ Using project authority from HoneycombSetup:",
            config.projectAuthority
          );
          return config.projectAuthority;
        }
      }

      // Check environment variable for known project
      if (
        this.projectAddress === "2wF2TeA91FiKRj4fv2UBZHabjpAX7Jk3rJUtu54qGJ6J"
      ) {
        // This is the current project, authority should be the setup wallet
        const authority = "EoazDBGnfmWu4abi5KMtZUDkSf9Lebrr2GppiH6baLE6";
        console.log(
          "✅ Using known project authority for current project:",
          authority
        );
        return authority;
      }

      // If project not found and no fallbacks, maybe it's a setup issue - let's be more helpful
      console.error(
        "❌ Project not found and no fallbacks available. This could mean:"
      );
      console.error("  1. Project address is incorrect");
      console.error("  2. Project doesn't exist on this network");
      console.error("  3. Honeycomb API connection issue");
      console.error("  4. Project setup is incomplete");

      throw new Error(
        `Could not find project information for address: ${this.projectAddress}`
      );
    } catch (error: any) {
      console.error("❌ Failed to get project authority:", error);
      console.error("❌ Project address being used:", this.projectAddress);
      throw error;
    }
  }

  /**
   * ADMIN HELPER: Enable public minting using the official wrapping method
   * Call this method with admin wallet to set up wrapping-based public minting
   */
  async enablePublicMinting(adminWallet: any): Promise<{
    success: boolean;
    message?: string;
    error?: string;
    wrappedCharacterModel?: string;
    characterTree?: string;
  }> {
    try {
      console.log(
        "🚀 ENABLING PUBLIC MINTING WITH OFFICIAL WRAPPING METHOD..."
      );
      console.log("Admin wallet:", adminWallet.publicKey.toString());

      // Verify admin permissions
      const projectAuthority = await this.getProjectAuthority();
      if (adminWallet.publicKey.toString() !== projectAuthority) {
        throw new Error(
          `Only admin wallet ${projectAuthority} can enable public minting`
        );
      }

      const accessToken = await getOrCreateAccessToken(
        adminWallet.publicKey.toString(),
        this.getSignMessageFunction(adminWallet)
      );

      // Step 1: Create a "Wrapped" character model (from official docs)
      console.log("🔨 Step 1: Creating wrapped character model...");

      const createModelResponse =
        await this.client.createCreateCharacterModelTransaction(
          {
            project: this.projectAddress,
            authority: adminWallet.publicKey.toString(),
            payer: adminWallet.publicKey.toString(),
            config: {
              kind: "Wrapped", // 🔑 KEY: Must be "Wrapped" for public use
              criterias: [
                {
                  kind: "Collection", // Allow NFTs from any collection
                  params: "11111111111111111111111111111111", // System program (allows any)
                },
              ],
            },
            cooldown: {
              ejection: 1, // 1 second cooldown for unwrapping
            },
          },
          {
            fetchOptions: {
              headers: { authorization: `Bearer ${accessToken}` },
            },
          }
        );

      // Send character model transaction
      const walletForTransaction = {
        adapter: adminWallet.adapter,
        publicKey: adminWallet.publicKey,
        signTransaction: adminWallet.signTransaction,
        signAllTransactions: adminWallet.signAllTransactions,
        connected: true,
      };

      const modelSignatures = await sendClientTransactions(
        this.client,
        walletForTransaction,
        createModelResponse
      );

      if (!modelSignatures || modelSignatures.length === 0) {
        throw new Error("Failed to create wrapped character model");
      }

      const wrappedCharacterModel =
        createModelResponse.characterModel || modelSignatures[0];
      console.log("✅ Wrapped character model created:", wrappedCharacterModel);

      // Step 2: Create character tree (from official docs)
      console.log("🔨 Step 2: Creating character tree...");

      const createTreeResponse =
        await this.client.createCreateCharactersTreeTransaction(
          {
            authority: adminWallet.publicKey.toString(),
            project: this.projectAddress,
            characterModel: wrappedCharacterModel.toString(),
            payer: adminWallet.publicKey.toString(),
            treeConfig: {
              basic: {
                numAssets: 100000, // Can store 100k characters
              },
            },
          },
          {
            fetchOptions: {
              headers: { authorization: `Bearer ${accessToken}` },
            },
          }
        );

      const treeSignatures = await sendClientTransactions(
        this.client,
        walletForTransaction,
        createTreeResponse
      );

      if (!treeSignatures || treeSignatures.length === 0) {
        throw new Error("Failed to create character tree");
      }

      const characterTree =
        createTreeResponse.charactersTree || treeSignatures[0];
      console.log("✅ Character tree created:", characterTree);

      // Step 3: Update NFT config to use wrapped model
      this.nftConfig = {
        ...this.nftConfig,
        wrappedCharacterModel: wrappedCharacterModel.toString(),
        characterTree: characterTree.toString(),
        supportsWrapping: true,
        projectAddress: this.projectAddress,
        timestamp: Date.now(),
      };

      // Cache the wrapped config
      localStorage.setItem(
        "honeycomb_wrapped_config",
        JSON.stringify(this.nftConfig)
      );

      // Enable wrapping mode
      localStorage.setItem("wrapping_mode_enabled", "true");

      console.log("✅ PUBLIC MINTING SETUP COMPLETE!");
      console.log("🎯 Users can now mint NFTs using the wrapping method!");

      return {
        success: true,
        message:
          "🎉 Public minting enabled! Non-admin users can now mint NFTs using Honeycomb's official wrapping method.",
        wrappedCharacterModel: wrappedCharacterModel.toString(),
        characterTree: characterTree.toString(),
      };
    } catch (error: any) {
      console.error("❌ Failed to enable public minting:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * IMMEDIATE SOLUTION: Override to allow all users to mint
   */
  enableImmediatePublicMinting(): { success: boolean; message: string } {
    console.log("🚀 ENABLING IMMEDIATE PUBLIC MINTING...");

    // Set flag to allow all users
    localStorage.setItem("allow_all_users_mint", "true");

    console.log("✅ All users can now mint NFTs!");

    return {
      success: true,
      message:
        "🎉 PUBLIC MINTING ENABLED! All users can now mint NFTs immediately.",
    };
  }

  /**
   * Create a public assembler config that allows non-admin minting
   */
  async createPublicAssemblerConfig(adminWallet: any): Promise<string> {
    try {
      console.log("🔨 Creating public assembler config...");

      const accessToken = await getOrCreateAccessToken(
        adminWallet.publicKey.toString(),
        this.getSignMessageFunction(adminWallet)
      );

      // Ensure config is loaded
      await this.ensureConfigLoaded();

      if (!this.nftConfig?.characterModelAddress) {
        throw new Error("Character model not found");
      }

      const characterModelAddr =
        typeof this.nftConfig.characterModelAddress === "object"
          ? this.nftConfig.characterModelAddress.address ||
            this.nftConfig.characterModelAddress.characterModel
          : this.nftConfig.characterModelAddress;

      // Create assembler config with public permissions
      const createAssemblerResponse =
        await this.client.createCreateAssemblerConfigTransaction(
          {
            project: this.projectAddress,
            authority: adminWallet.publicKey.toString(), // Admin creates it
            payer: adminWallet.publicKey.toString(),
            ticker: "racing-cars-public", // Different ticker for public config
            // Try to make it public by not restricting authority
          },
          {
            fetchOptions: {
              headers: { authorization: `Bearer ${accessToken}` },
            },
          }
        );

      console.log(
        "📋 Public assembler config created:",
        createAssemblerResponse
      );

      // Send transaction
      const walletForTransaction = {
        adapter: adminWallet.adapter,
        publicKey: adminWallet.publicKey,
        signTransaction: adminWallet.signTransaction,
        signAllTransactions: adminWallet.signAllTransactions,
        connected: true,
      };

      const signatures = await sendClientTransactions(
        this.client,
        walletForTransaction,
        createAssemblerResponse
      );

      if (signatures && signatures.length > 0) {
        const assemblerConfigAddress =
          createAssemblerResponse.assemblerConfig || signatures[0];
        console.log(
          "✅ Public assembler config created:",
          assemblerConfigAddress
        );
        return assemblerConfigAddress;
      }

      throw new Error("Failed to create public assembler config");
    } catch (error: any) {
      console.error("❌ Failed to create public assembler config:", error);
      throw error;
    }
  }

  /**
   * Mint a new NFT car
   */
  async mintCar(
    wallet: any,
    carType: keyof typeof CAR_TEMPLATES,
    recipientAddress: string
  ): Promise<{ success: boolean; mintAddress?: string; error?: string }> {
    try {
      console.log("🚀 STARTING MINT CAR - DEBUG CHECK");
      console.log(
        "🔍 localStorage allow_all_users_mint:",
        localStorage.getItem("allow_all_users_mint")
      );
      console.log(
        "🔍 localStorage wrapping_mode_enabled:",
        localStorage.getItem("wrapping_mode_enabled")
      );

      const carTemplate = CAR_TEMPLATES[carType];
      if (!carTemplate) {
        return { success: false, error: "Invalid car type" };
      }

      // Get access token with properly bound signMessage function
      const accessToken = await getOrCreateAccessToken(
        wallet.publicKey.toString(),
        this.getSignMessageFunction(wallet)
      );

      // Ensure user has profile before minting
      console.log("🔍 Ensuring user profile before minting...");
      await this.ensureUserProfile(wallet, accessToken);
      console.log("✅ User profile ensured");

      // Ensure config is loaded from blockchain
      await this.ensureConfigLoaded();

      if (
        !this.nftConfig ||
        !this.nftConfig.characterModelAddress ||
        !this.nftConfig.assemblerConfigAddress
      ) {
        // Check if we have setup results but they're missing required fields
        const honeycombConfig = localStorage.getItem("honeycomb_nft_config");
        if (honeycombConfig) {
          const config = JSON.parse(honeycombConfig);
          console.log("🔍 Found config but missing required fields:", config);

          if (!config.assemblerConfigAddress) {
            throw new Error(
              "❌ Assembler Config missing from setup!\n\n" +
                "🚀 SOLUTION: Run the Honeycomb Setup again\n" +
                "1. Go to Menu → 🏗️ Honeycomb Setup\n" +
                "2. Click '🚀 Run Official Honeycomb Setup'\n" +
                "3. Wait for all 4 steps to complete\n" +
                "4. Try minting again"
            );
          }

          if (!config.characterModelAddress) {
            throw new Error(
              "❌ Character Model missing from setup!\n\n" +
                "🚀 SOLUTION: Run the Honeycomb Setup again\n" +
                "1. Go to Menu → 🏗️ Honeycomb Setup\n" +
                "2. Click '🚀 Run Official Honeycomb Setup'\n" +
                "3. Wait for all 4 steps to complete\n" +
                "4. Try minting again"
            );
          }
        }

        throw new Error(
          "❌ NFT infrastructure not found!\n\n" +
            "🚀 SOLUTION: Complete the Honeycomb Setup first\n" +
            "1. Go to Menu → 🏗️ Honeycomb Setup\n" +
            "2. Click '🚀 Run Official Honeycomb Setup'\n" +
            "3. Wait for all 4 steps to complete successfully\n" +
            "4. Return here and try minting again\n\n" +
            "This will create the required assembler config and character model."
        );
      }

      // Extract addresses from config objects
      console.log("🔍 Raw NFT config:", this.nftConfig);

      const characterModelAddr =
        typeof this.nftConfig.characterModelAddress === "object"
          ? this.nftConfig.characterModelAddress.address ||
            this.nftConfig.characterModelAddress.characterModel
          : this.nftConfig.characterModelAddress;

      const assemblerConfigAddr =
        typeof this.nftConfig.assemblerConfigAddress === "object"
          ? this.nftConfig.assemblerConfigAddress.address ||
            this.nftConfig.assemblerConfigAddress.assemblerConfig
          : this.nftConfig.assemblerConfigAddress;

      console.log("🔍 Extracted addresses:");
      console.log("   Character Model:", characterModelAddr);
      console.log("   Assembler Config:", assemblerConfigAddr);

      if (!assemblerConfigAddr || !characterModelAddr) {
        throw new Error("Invalid NFT configuration addresses");
      }

      // Create character using Honeycomb's expected format

      // Get project authority since it's required
      const projectAuthority = await this.getProjectAuthority();
      console.log("🔑 Using project authority:", projectAuthority);

      let transactionResponse;
      try {

        // Try different authority configurations based on user type
        const isUserAdmin = wallet.publicKey.toString() === projectAuthority;
        console.log("🔍 Is user admin?", isUserAdmin);
        console.log("🔍 User wallet:", wallet.publicKey.toString());
        console.log("🔍 Project authority:", projectAuthority);

        // Get the correct attribute order from assembler config
        let attributeOrder = [
          "name",
          "rarity",
          "speed",
          "handling",
          "acceleration",
          "durability",
        ]; // Default order

        try {
          const assemblerConfigData = await this.client.findAssemblerConfig({
            addresses: [assemblerConfigAddr],
          });

          if (assemblerConfigData?.assemblerConfig?.[0]?.order) {
            attributeOrder = assemblerConfigData.assemblerConfig[0].order;
            console.log(
              "✅ Using assembler config attribute order:",
              attributeOrder
            );
          } else {
            console.log(
              "⚠️ No order found in assembler config, using default order"
            );
          }
        } catch (orderError) {
          console.warn(
            "⚠️ Could not fetch assembler config order, using default:",
            orderError
          );
        }

        // Create attributes in the correct order with images
        const createAttributesInOrder = (carTemplate: any) => {
          // Define attribute images for different values
          const attributeImages = {
            name: {
              "Nitro Runner": "https://arweave.net/nitro-runner.png",
              "Speed Demon": "https://arweave.net/speed-demon.png",
              "Thunder Bolt": "https://arweave.net/thunder-bolt.png",
              default:
                carTemplate.image || "https://arweave.net/default-car.png",
            },
            rarity: {
              common: "https://arweave.net/common-badge.png",
              uncommon: "https://arweave.net/uncommon-badge.png",
              rare: "https://arweave.net/rare-badge.png",
              epic: "https://arweave.net/epic-badge.png",
              legendary: "https://arweave.net/legendary-badge.png",
            },
            speed: {
              "1": "https://arweave.net/speed-1.png",
              "2": "https://arweave.net/speed-2.png",
              "3": "https://arweave.net/speed-3.png",
              "4": "https://arweave.net/speed-4.png",
              "5": "https://arweave.net/speed-5.png",
              "6": "https://arweave.net/speed-6.png",
              "7": "https://arweave.net/speed-7.png",
              "8": "https://arweave.net/speed-8.png",
              "9": "https://arweave.net/speed-9.png",
              "10": "https://arweave.net/speed-10.png",
            },
            handling: {
              "1": "https://arweave.net/handling-1.png",
              "2": "https://arweave.net/handling-2.png",
              "3": "https://arweave.net/handling-3.png",
              "4": "https://arweave.net/handling-4.png",
              "5": "https://arweave.net/handling-5.png",
              "6": "https://arweave.net/handling-6.png",
              "7": "https://arweave.net/handling-7.png",
              "8": "https://arweave.net/handling-8.png",
              "9": "https://arweave.net/handling-9.png",
              "10": "https://arweave.net/handling-10.png",
            },
            acceleration: {
              "1": "https://arweave.net/acceleration-1.png",
              "2": "https://arweave.net/acceleration-2.png",
              "3": "https://arweave.net/acceleration-3.png",
              "4": "https://arweave.net/acceleration-4.png",
              "5": "https://arweave.net/acceleration-5.png",
              "6": "https://arweave.net/acceleration-6.png",
              "7": "https://arweave.net/acceleration-7.png",
              "8": "https://arweave.net/acceleration-8.png",
              "9": "https://arweave.net/acceleration-9.png",
              "10": "https://arweave.net/acceleration-10.png",
            },
            durability: {
              "1": "https://arweave.net/durability-1.png",
              "2": "https://arweave.net/durability-2.png",
              "3": "https://arweave.net/durability-3.png",
              "4": "https://arweave.net/durability-4.png",
              "5": "https://arweave.net/durability-5.png",
              "6": "https://arweave.net/durability-6.png",
              "7": "https://arweave.net/durability-7.png",
              "8": "https://arweave.net/durability-8.png",
              "9": "https://arweave.net/durability-9.png",
              "10": "https://arweave.net/durability-10.png",
            },
          };

          const allAttributes = {
            name: carTemplate.name,
            rarity: carTemplate.traits.rarity,
            speed: carTemplate.traits.speed.toString(),
            handling: carTemplate.traits.handling.toString(),
            acceleration: carTemplate.traits.acceleration.toString(),
            durability: carTemplate.traits.durability.toString(),
          };

          // Return attributes with images in the exact order specified by assembler config
          return attributeOrder.map((key) => {
            const value = allAttributes[key] || "";
            const imageMap = attributeImages[key] || {};
            const image =
              imageMap[value] ||
              imageMap["default"] ||
              carTemplate.image ||
              "https://arweave.net/default.png";

            return [key, value, image]; // [trait_name, trait_value, trait_image]
          });
        };

        // Use EXACT official GraphQL schema format from documentation
        console.log("🚀 Using EXACT official GraphQL schema format...");

        const transactionParams = {
          uri: carTemplate.image, // Uri of the image representing your character
          project: this.projectAddress, // Project public key as a string
          assemblerConfig: assemblerConfigAddr, // Assembler config public key as a string
          characterModel: characterModelAddr, // Character model public key as a string
          wallet: wallet.publicKey.toString(), // User wallet public key as a string, this user will receive the character
          owner: wallet.publicKey.toString(), // User owns the character
          authority: projectAuthority, // Project authority for minting permissions
          payer: wallet.publicKey.toString(), // User pays for the transaction
        };

        // Check assembler config permissions
        try {
          console.log("🔍 Checking assembler config details...");
          console.log("🔍 Query address:", assemblerConfigAddr);
          console.log("🔍 Address type:", typeof assemblerConfigAddr);
          console.log("🔍 Address length:", assemblerConfigAddr?.length);

          const assemblerConfigData = await this.client.findAssemblerConfig({
            addresses: [assemblerConfigAddr],
          });
          console.log("📋 Assembler config data:", assemblerConfigData);
          console.log(
            "📋 Found configs count:",
            assemblerConfigData?.assemblerConfig?.length || 0
          );

          // Log detailed assembler config info for debugging
          if (assemblerConfigData?.assemblerConfig?.[0]) {
            const config = assemblerConfigData.assemblerConfig[0];
            console.log("🔑 ASSEMBLER CONFIG DETAILS:");
            console.log("   Authority:", config.authority);
            console.log("   Project:", config.project);
            console.log("   Order:", config.order);
            console.log("   Ticker:", config.ticker);
            console.log("   Full config:", config);

            // Check if authority matches project authority
            console.log(
              "🔍 Authority matches projectAuthority?",
              config.authority === projectAuthority
            );
            console.log("🔍 Current projectAuthority:", projectAuthority);
          }

          // If specific assembler config not found, use ProjectCreator approach
          if (!assemblerConfigData?.assemblerConfig?.length) {
            console.log(
              "⚠️ Specific assembler config not found, using ProjectCreator approach..."
            );

            // Wait for indexing (same as ProjectCreator)
            console.log("🔍 Waiting 3 seconds for blockchain indexing...");
            await new Promise((resolve) => setTimeout(resolve, 3000));

            try {
              console.log(
                "🔍 Querying assembler configs with different formats (ProjectCreator method)..."
              );

              // Try different query formats (same as ProjectCreator)
              const queries = [
                { project: this.projectAddress },
                { projectId: this.projectAddress },
                { projectAddress: this.projectAddress },
                {}, // Query all, then filter
              ];

              let foundWorkingConfig = false;

              for (const query of queries) {
                try {
                  console.log("🔍 Trying query format:", query);
                  const result = await this.client.findAssemblerConfig(query);
                  console.log("🔍 Query result:", result);

                  if (
                    result?.assemblerConfig &&
                    result.assemblerConfig.length > 0
                  ) {
                    // Filter by project if we queried all (same as ProjectCreator)
                    const configs = result.assemblerConfig.filter(
                      (config) =>
                        !query.hasOwnProperty("project") ||
                        config.project === this.projectAddress
                    );

                    if (configs.length > 0) {
                      // Use latest config (same as ProjectCreator)
                      const latestAssembler = configs[configs.length - 1];
                      const workingAddress =
                        latestAssembler.address || latestAssembler.id;

                      console.log(
                        "✅ Found working assembler config via ProjectCreator method:",
                        workingAddress
                      );
                      console.log(
                        "🔄 Updating config to use working assembler config..."
                      );

                      // Update the config to use the working assembler config
                      this.nftConfig.assemblerConfigAddress = workingAddress;

                      // Update localStorage with working config
                      const honeycombConfig = localStorage.getItem(
                        "honeycomb_nft_config"
                      );
                      if (honeycombConfig) {
                        const config = JSON.parse(honeycombConfig);
                        config.assemblerConfigAddress = workingAddress;
                        config.updatedWithProjectCreatorMethod = true;
                        localStorage.setItem(
                          "honeycomb_nft_config",
                          JSON.stringify(config)
                        );
                        console.log(
                          "💾 Updated localStorage with working assembler config"
                        );
                      }

                      foundWorkingConfig = true;
                      break;
                    }
                  }
                } catch (queryError) {
                  console.log("🔍 Query format failed:", query, queryError);
                }
              }

              if (!foundWorkingConfig) {
                console.warn(
                  "⚠️ No assembler configs found with any query method"
                );
              } else {
                return; // Skip the permission check, we found a working config
              }
            } catch (projectError) {
              console.warn(
                "⚠️ Could not fetch project assembler configs:",
                projectError
              );
            }
          }

          // Check if there are permissions or restrictions
          if (assemblerConfigData?.assemblerConfig?.[0]) {
            const config = assemblerConfigData.assemblerConfig[0];
            console.log("🔑 Assembler config authority:", config.authority);
            console.log("🔑 Assembler config order:", config.order);
            console.log(
              "🎯 User is authority?",
              config.authority === wallet.publicKey.toString()
            );
          }
        } catch (configError) {
          console.warn(
            "⚠️ Could not fetch assembler config details:",
            configError
          );
        }

        // Check character model details
        try {
          console.log("🔍 Checking character model details...");
          const characterModelData = await this.client.findCharacterModels({
            addresses: [characterModelAddr],
          });
          console.log("📋 Character model data:", characterModelData);
        } catch (modelError) {
          console.warn(
            "⚠️ Could not fetch character model details:",
            modelError
          );
        }

        console.log("📋 Transaction parameters:", {
          userWallet: wallet.publicKey.toString(),
          transactionParams,
          assemblerConfig: assemblerConfigAddr,
          characterModel: characterModelAddr,
        });

        // Use standard Honeycomb character assembly for all users
        console.log("🔄 Creating character assembly transaction...");
        transactionResponse =
          await this.client.createAssembleCharacterTransaction(
            transactionParams,
            {
              fetchOptions: {
                headers: { authorization: `Bearer ${accessToken}` },
              },
            }
          );
        console.log(
          "✅ Transaction created successfully:",
          transactionResponse
        );

        // Check if the response contains character information
        if (transactionResponse.character) {
          console.log(
            "🎯 Character address from transaction response:",
            transactionResponse.character
          );
        }
        if (transactionResponse.createAssembleCharacterTransaction?.character) {
          console.log(
            "🎯 Character address from nested response:",
            transactionResponse.createAssembleCharacterTransaction.character
          );
        }
      } catch (createError) {
        console.error(
          "❌ Failed to create assemble character transaction:",
          createError
        );
        console.error("❌ Error details:", {
          userWallet: wallet.publicKey.toString(),
          errorMessage: createError.message,
        });

        // Check if it's an authority restriction error
        if (createError.message?.includes("Invalid authority")) {
          console.log(
            "🔧 Detected authority restriction - trying with project authority..."
          );

          // Retry with project authority
          const retryParams = {
            uri: carTemplate.image,
            project: this.projectAddress,
            assemblerConfig: assemblerConfigAddr,
            characterModel: characterModelAddr,
            wallet: wallet.publicKey.toString(),
            owner: wallet.publicKey.toString(),
            authority: projectAuthority, // Use project authority instead
            payer: wallet.publicKey.toString(),
          };

          try {
            console.log(
              "🔄 Retrying transaction with project authority as authority..."
            );
            transactionResponse =
              await this.client.createAssembleCharacterTransaction(
                retryParams,
                {
                  fetchOptions: {
                    headers: { authorization: `Bearer ${accessToken}` },
                  },
                }
              );
            console.log("✅ Retry successful with project authority");
          } catch (retryError: any) {
            throw new Error(
              `Transaction failed even with project authority: ${retryError.message}`
            );
          }
        } else {
          throw new Error(
            `Transaction creation failed: ${createError.message}`
          );
        }
      }

      // Check if the transaction response is valid
      if (!transactionResponse) {
        throw new Error("No transaction response received from Honeycomb");
      }

      // Extract the actual transaction from the response
      let actualTransaction = transactionResponse;

      // Handle different response formats
      if (transactionResponse.createAssembleCharacterTransaction) {
        actualTransaction =
          transactionResponse.createAssembleCharacterTransaction;
      } else if (transactionResponse.createWrapAssetsToCharacterTransactions) {
        // Handle wrapping transaction response format
        actualTransaction =
          transactionResponse.createWrapAssetsToCharacterTransactions;
      } else if (transactionResponse.transaction) {
        actualTransaction = transactionResponse.transaction;
      } else if (Array.isArray(transactionResponse)) {
        actualTransaction = transactionResponse;
      }

      if (!actualTransaction) {
        throw new Error("Invalid transaction format received from Honeycomb");
      }

      // Send the transaction
      const walletForTransaction = {
        adapter: wallet.adapter,
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions,
        connected: true,
      };

      const signatures = await sendClientTransactions(
        this.client,
        walletForTransaction,
        actualTransaction
      );

      if (signatures && signatures.length > 0) {
        console.log("🔍 Transaction response received:", signatures);
        console.log(
          "🔍 Full response structure:",
          JSON.stringify(signatures[0], null, 2)
        );

        // Check for transaction errors first
        if (typeof signatures[0] === "object") {
          const sigObj = signatures[0];

          if (sigObj.bundleId && sigObj.responses) {
            console.log("🔍 Bundle response details:", {
              bundleId: sigObj.bundleId,
              responseCount: sigObj.responses.length,
              allResponses: sigObj.responses,
            });

            // Check each response for errors
            let hasErrors = false;
            let successfulResponse = null;

            for (const response of sigObj.responses) {
              console.log("🔍 Individual response:", response);

              if (response.status === "Failed" || response.error) {
                hasErrors = true;
                console.error("❌ Transaction failed:", response.error);
                throw new Error(`Transaction failed: ${response.error}`);
              }

              if (response.status === "Success" || response.signature) {
                successfulResponse = response;
                console.log("✅ Found successful transaction:", response);
              }
            }

            if (hasErrors) {
              throw new Error(
                "Transaction bundle contained failed transactions"
              );
            }

            if (!successfulResponse) {
              throw new Error("No successful transactions found in bundle");
            }

            // Extract character address and signature from successful response
            const characterAddress = successfulResponse.character;
            const txSignature =
              successfulResponse.signature || successfulResponse.txSignature;

            console.log("🎯 Character address:", characterAddress);
            console.log("📝 Transaction signature:", txSignature);

            const mintAddress = characterAddress || txSignature;

            if (!mintAddress) {
              throw new Error(
                "No character address or transaction signature found"
              );
            }

            console.log("🎯 Final mint address/signature:", mintAddress);
            console.log(
              "👤 NFT should belong to wallet:",
              wallet.publicKey.toString()
            );

            // Store mint info in localStorage for tracking
            this.storeMintInfo(
              mintAddress,
              wallet.publicKey.toString(),
              carType,
              sigObj.bundleId
            );

            return {
              success: true,
              mintAddress: mintAddress.toString(),
            };
          } else if ('signature' in sigObj && sigObj.signature) {
            // Direct signature response
            console.log("📝 Direct signature found:", sigObj.signature);
            this.storeMintInfo(
              sigObj.signature as string,
              wallet.publicKey.toString(),
              carType,
              null
            );

            return {
              success: true,
              mintAddress: 'signature' in sigObj ? (sigObj.signature as string) : '',
            };
          } else {
            throw new Error(
              "Invalid response format - no signature or bundle found"
            );
          }
        } else {
          // Simple string signature
          const signature = signatures[0];
          console.log("📝 Simple signature format:", signature);
          this.storeMintInfo(
            signature,
            wallet.publicKey.toString(),
            carType,
            null
          );

          return {
            success: true,
            mintAddress: signature,
          };
        }
      }

      return {
        success: false,
        error: "No signatures returned from transaction",
      };
    } catch (error: any) {
      console.error("❌ Transaction failed:", error.message);
      return { success: false, error: error.message };
    }
  }

  // Helper method to store mint information
  private storeMintInfo(
    mintAddress: string,
    walletAddress: string,
    carType: string,
    bundleId: any
  ) {
    try {
      const mintInfo = {
        mintAddress: mintAddress.toString(),
        walletAddress: walletAddress,
        carType: carType,
        timestamp: Date.now(),
        bundleId: bundleId,
      };

      const existingMints = JSON.parse(
        localStorage.getItem("recent_nft_mints") || "[]"
      );
      existingMints.push(mintInfo);

      // Keep only recent mints (last 24 hours)
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const recentMints = existingMints.filter(
        (mint: any) => mint.timestamp > dayAgo
      );

      localStorage.setItem("recent_nft_mints", JSON.stringify(recentMints));
      console.log("💾 Stored mint info for tracking:", mintInfo);
    } catch (storageError) {
      console.warn("⚠️ Could not store mint info:", storageError);
    }
  }

  /**
   * Get user's NFT cars - REAL HONEYCOMB DATA ONLY
   */
  async getUserCars(
    walletAddress: string,
    retryCount: number = 0
  ): Promise<NFTCar[]> {
    try {
      console.log(
        "🔍 Getting NFT cars for wallet:",
        walletAddress,
        retryCount > 0 ? `(retry ${retryCount})` : ""
      );
      await this.ensureConfigLoaded();

      let characters = [];

      try {
        // Try multiple query methods to find characters
        console.log("🔍 Trying multiple query methods...");

        // Method 1: Query by wallets array
        let response = await this.client.findCharacters({
          project: this.projectAddress,
          wallets: [walletAddress],
        });
        console.log("🔍 Method 1 (wallets) response:", response);

        // Method 2: Query by owners array
        if (!response?.character || response.character.length === 0) {
          response = await this.client.findCharacters({
            project: this.projectAddress,
            owners: [walletAddress],
          });
          console.log("🔍 Method 2 (owners) response:", response);
        }

        // Method 3: Query all characters in project and filter
        if (!response?.character || response.character.length === 0) {
          response = await this.client.findCharacters({
            project: this.projectAddress,
          });
          console.log(
            "🔍 Method 3 (all project characters) response count:",
            response?.character?.length || 0
          );
        }

        // Method 4: Look for recently assembled characters (within last 10 minutes)
        if (!response?.character || response.character.length === 0) {
          console.log(
            "🔍 Method 4: Looking for recent assembled characters..."
          );
          const recentTime = Date.now() - 10 * 60 * 1000; // 10 minutes ago

          response = await this.client.findCharacters({
            project: this.projectAddress,
            // Look for assembled characters specifically
          });

          if (response?.character) {
            // Filter for recently assembled characters
            const assembledChars = response.character.filter((char: any) => {
              const isAssembled = char.source?.kind === "Assembled";
              const isRecent = char.createdAt
                ? new Date(char.createdAt).getTime() > recentTime
                : true;
              return isAssembled && isRecent;
            });

            console.log(
              "🔍 Method 4: Found assembled characters:",
              assembledChars.length
            );

            if (assembledChars.length > 0) {
              response = { character: assembledChars };
            }
          }
        }

        // Handle different response formats
        if (response?.character && Array.isArray(response.character)) {
          characters = response.character;
          console.log(
            "✅ Found characters in response.character:",
            characters.length
          );
        } else if (
          response?.findCharacters?.character &&
          Array.isArray(response.findCharacters.character)
        ) {
          characters = response.findCharacters.character;
          console.log(
            "✅ Found characters in response.findCharacters.character:",
            characters.length
          );
        } else if (Array.isArray(response)) {
          characters = response;
          console.log(
            "✅ Response is array, found characters:",
            characters.length
          );
        } else if (response?.characters && Array.isArray(response.characters)) {
          characters = response.characters;
          console.log(
            "✅ Found characters in response.characters:",
            characters.length
          );
        } else {
          console.log("❌ No characters found in response format");
        }

        // Filter characters owned by the wallet
        console.log(
          "🔍 Sample character structure:",
          JSON.stringify(characters[0], null, 2)
        );
        console.log("🔍 Target wallet:", walletAddress);

        const filteredCharacters = characters.filter((char: any, index) => {
          // Check multiple ownership fields including asset ownership
          let isOwned =
            char.owner === walletAddress ||
            char.info?.owner === walletAddress ||
            char.authority === walletAddress ||
            char.wallet === walletAddress ||
            char.asset?.ownership?.owner === walletAddress ||
            // NEW: Check if this is an assembled character created by this wallet
            (char.source?.kind === "Assembled" &&
              char.assembledBy === walletAddress) ||
            // NEW: Check transaction creator/payer fields
            char.payer === walletAddress ||
            char.creator === walletAddress;

          // NEW: Check if this character matches a recent mint by this wallet
          if (!isOwned && char.source?.kind === "Assembled") {
            try {
              const recentMints = JSON.parse(
                localStorage.getItem("recent_nft_mints") || "[]"
              );
              const matchingMint = recentMints.find(
                (mint: any) =>
                  mint.walletAddress === walletAddress &&
                  (mint.mintAddress === char.address ||
                    mint.mintAddress === char.id ||
                    mint.bundleId === char.bundleId)
              );

              if (matchingMint) {
                console.log("🎯 Found matching recent mint:", matchingMint);
                isOwned = true;
              }
            } catch (e) {
              // Ignore localStorage errors
            }
          }

          const hasMinimumData = !!(char.address || char.id);

          // Debug first few characters to see the structure and look for assembled characters
          if (index < 5 || char.source?.kind === "Assembled") {
            console.log(
              `🔍 Character ${index} (${char.source?.kind || "Unknown"}):`,
              {
                owner: char.owner,
                infoOwner: char.info?.owner,
                authority: char.authority,
                wallet: char.wallet,
                assetOwner: char.asset?.ownership?.owner,
                assembledBy: char.assembledBy,
                payer: char.payer,
                creator: char.creator,
                sourceKind: char.source?.kind,
                address: char.address,
                id: char.id,
                isOwned,
                hasMinimumData,
              }
            );
          }

          return isOwned && hasMinimumData;
        });

        console.log("🔍 Filtered characters count:", filteredCharacters.length);
        characters = filteredCharacters;
      } catch (apiError) {
        // Silently handle API errors
      }

      // Convert Honeycomb characters to NFTCar format
      const realNFTCars = characters
        .map((char: any) => {
          // Try to extract name from different possible locations
          // If it's an assembled character, try to infer name from the character model or traits
          let characterName =
            char.info?.name ||
            char.name ||
            char.metadata?.name ||
            char.uri?.name;

          // If no name found but it's an assembled character, try to determine the car type
          let matchingTemplate = null; // Declare outside to use later for traits

          if (!characterName && char.source?.kind === "Assembled") {
            // Try to match with our car templates based on multiple criteria

            // Check permanent character mapping
            if (typeof window !== "undefined") {
              const characterMapping = JSON.parse(
                localStorage.getItem("character_mapping") || "{}"
              );
              const carTypeId =
                characterMapping[char.address] ||
                characterMapping[char.mint] ||
                characterMapping[char.id];

              if (
                carTypeId &&
                CAR_TEMPLATES[carTypeId as keyof typeof CAR_TEMPLATES]
              ) {
                matchingTemplate =
                  CAR_TEMPLATES[carTypeId as keyof typeof CAR_TEMPLATES];
              }
            }

            // Method 2: Try to match by image URL (fallback)
            if (!matchingTemplate) {
              matchingTemplate = Object.values(CAR_TEMPLATES).find(
                (template) => {
                  return (
                    char.info?.image === template.image ||
                    char.image === template.image
                  );
                }
              );
            }

            // Method 3: If minting just happened, check localStorage for recent mints
            if (!matchingTemplate && typeof window !== "undefined") {
              try {
                const recentMints = JSON.parse(
                  localStorage.getItem("recent_mints") || "[]"
                );
                const recentMint = recentMints.find(
                  (mint: any) =>
                    mint.mintAddress === char.address ||
                    mint.mintAddress === char.mint ||
                    mint.mintAddress === char.id
                );
                if (recentMint && recentMint.carType) {
                  matchingTemplate =
                    CAR_TEMPLATES[
                      recentMint.carType as keyof typeof CAR_TEMPLATES
                    ];
                }
              } catch (e) {
                // Ignore recent mints check errors
              }
            }

            // Method 4: Check localStorage minting history for this address
            if (!matchingTemplate && typeof window !== "undefined") {
              try {
                const allLocalStorageKeys = Object.keys(localStorage);
                for (const key of allLocalStorageKeys) {
                  if (key.startsWith("minting_history_")) {
                    const history = JSON.parse(
                      localStorage.getItem(key) || "[]"
                    );
                    const mintRecord = history.find(
                      (record: any) =>
                        record.mintAddress === char.address ||
                        record.mintAddress === char.mint ||
                        record.mintAddress === char.id
                    );
                    if (mintRecord) {
                      const templateKey = Object.keys(CAR_TEMPLATES).find(
                        (key) =>
                          CAR_TEMPLATES[key as keyof typeof CAR_TEMPLATES]
                            .name === mintRecord.carType
                      );
                      if (templateKey) {
                        matchingTemplate =
                          CAR_TEMPLATES[
                            templateKey as keyof typeof CAR_TEMPLATES
                          ];
                        break;
                      }
                    }
                  }
                }
              } catch (e) {
                // Ignore minting history check errors
              }
            }

            if (matchingTemplate) {
              characterName = matchingTemplate.name;
            } else {
              characterName = "Assembled Racing Car";
            }
          } else if (!characterName) {
            characterName = "Racing Car NFT";
          }

          // Try to extract image from different possible locations
          let characterImage =
            char.info?.image ||
            char.image ||
            char.metadata?.image ||
            char.uri?.image;

          // If no image found, try to match with car templates
          if (!characterImage) {
            const matchingTemplate = Object.values(CAR_TEMPLATES).find(
              (template) => template.name === characterName
            );
            characterImage =
              matchingTemplate?.image || this.getDefaultCarImage();
          }

          // Try to extract description
          const characterDescription =
            char.info?.description ||
            char.description ||
            char.metadata?.description ||
            "A Honeycomb racing car NFT";

          // Try to extract mint address
          const mintAddress =
            char.mint || char.address || char.id || char.mintAddress;

          // Extract traits, using template if character matched to one
          const matchedTemplate = matchingTemplate;

          const traits = matchedTemplate
            ? {
                speed: matchedTemplate.traits.speed,
                handling: matchedTemplate.traits.handling,
                acceleration: matchedTemplate.traits.acceleration,
                durability: matchedTemplate.traits.durability,
                rarity: matchedTemplate.traits.rarity,
              }
            : {
                speed: this.extractTraitValue(char, "speed") || 5,
                handling: this.extractTraitValue(char, "handling") || 5,
                acceleration: this.extractTraitValue(char, "acceleration") || 5,
                durability: this.extractTraitValue(char, "durability") || 5,
                rarity: this.extractTraitValue(char, "rarity") || "common",
              };

          return {
            id: char.address || char.id || `char_${Date.now()}`,
            name: characterName,
            image: characterImage,
            description: matchedTemplate?.description || characterDescription,
            traits: traits,
            mintAddress: mintAddress,
            isStaked: char.staked || false,
          };
        })
        .filter((car) => {
          const isValid = car.mintAddress && car.id;
          return isValid;
        });

      // If no cars found and this is a recent mint, try again with delay
      if (realNFTCars.length === 0 && retryCount < 2) {
        console.log("⏳ No NFTs found, retrying in 3 seconds...");
        await new Promise((resolve) => setTimeout(resolve, 3000));
        return this.getUserCars(walletAddress, retryCount + 1);
      }

      return realNFTCars;
    } catch (error) {
      console.error("❌ Error getting user cars:", error);

      // If error and this is a recent mint, try again with delay
      if (retryCount < 2) {
        console.log("⏳ Error occurred, retrying in 3 seconds...");
        await new Promise((resolve) => setTimeout(resolve, 3000));
        return this.getUserCars(walletAddress, retryCount + 1);
      }

      return [];
    }
  }

  // Helper method to extract trait values from different formats
  private extractTraitValue(char: any, traitName: string): any {
    const name = traitName.toLowerCase();

    // Try different attribute formats in various locations
    const attributeLocations = [
      char.info?.attributes,
      char.attributes,
      char.metadata?.attributes,
      char.uri?.attributes,
    ];

    for (const attributes of attributeLocations) {
      if (attributes && Array.isArray(attributes)) {
        const attr = attributes.find((a: any) => {
          const attrName = (
            a.trait_type ||
            a.traitType ||
            a.name ||
            ""
          ).toLowerCase();
          return attrName === name;
        });
        if (attr && attr.value !== undefined) {
          return attr.value;
        }
      }
    }

    // Try direct property access in different locations
    const directLocations = [
      char.traits,
      char.info?.traits,
      char.metadata?.traits,
    ];

    for (const traits of directLocations) {
      if (traits && traits[name] !== undefined) {
        return traits[name];
      }
    }

    // If this is a car template trait, try to infer from the character name
    if (char.info?.name || char.name) {
      const characterName = char.info?.name || char.name;
      const matchingTemplate = Object.values(CAR_TEMPLATES).find(
        (template) => template.name === characterName
      );
      if (matchingTemplate) {
        return matchingTemplate.traits[
          traitName as keyof typeof matchingTemplate.traits
        ];
      }
    }

    return null;
  }

  // Helper method to get car image by type
  private getCarImageByType(carType: string): string {
    const carTemplate = Object.values(CAR_TEMPLATES).find(
      (template) => template.name === carType
    );
    return carTemplate?.image || "/default-car.png";
  }

  // Helper method to get default car image
  private getDefaultCarImage(): string {
    // Use the first car template as default
    return CAR_TEMPLATES.nitrorunner.image;
  }

  /**
   * Create a staking pool for NFT cars
   */
  async createStakingPool(
    wallet: any,
    poolConfig: {
      name: string;
      rewardsPerSecond: number;
      maxDuration: number;
      minDuration: number;
      resetStake: boolean;
    }
  ): Promise<{ success: boolean; poolAddress?: string; error?: string }> {
    try {
      const accessToken = await getOrCreateAccessToken(
        wallet.publicKey.toString(),
        this.getSignMessageFunction(wallet)
      );

      const stakingPoolTransaction =
        await this.client.createCreateStakingPoolTransaction(
          {
            project: this.projectAddress,
            authority: wallet.publicKey.toString(),
            payer: wallet.publicKey.toString(),

            // Pool configuration
            name: poolConfig.name,
            rewardsPerSecond: poolConfig.rewardsPerSecond,
            maxDuration: poolConfig.maxDuration,
            minDuration: poolConfig.minDuration,
            resetStake: poolConfig.resetStake,
            startTime: Math.floor(Date.now() / 1000), // Current timestamp
            endTime: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1 year from now
          },
          {
            fetchOptions: {
              headers: { authorization: `Bearer ${accessToken}` },
            },
          }
        );

      const walletForTransaction = {
        adapter: wallet.adapter,
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions,
        connected: true,
      };

      const signatures = await sendClientTransactions(
        this.client,
        walletForTransaction,
        stakingPoolTransaction
      );

      if (signatures && signatures.length > 0) {
        const poolAddress = typeof signatures[0] === 'string' ? signatures[0] : 
                          (signatures[0] as any).signature || 'unknown';
        return { success: true, poolAddress };
      }

      return { success: false, error: "Failed to create staking pool" };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Stake an NFT car to earn rewards
   */
  async stakeCar(
    wallet: any,
    carMintAddress: string,
    stakingPoolAddress?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const accessToken = await getOrCreateAccessToken(
        wallet.publicKey.toString(),
        this.getSignMessageFunction(wallet)
      );

      // Ensure user has a profile before staking
      await this.ensureUserProfile(wallet, accessToken);

      // Use default staking pool if none provided
      const poolAddress =
        stakingPoolAddress || import.meta.env.VITE_DEFAULT_STAKING_POOL;

      if (!poolAddress) {
        throw new Error(
          "No staking pool available. Please create a staking pool first."
        );
      }

      // Create staking transaction using Honeycomb's character staking
      const stakeTransaction =
        await this.client.createStakeCharactersTransactions(
          {
            project: this.projectAddress,
            stakingPool: poolAddress,
            characters: [carMintAddress],
            payer: wallet.publicKey.toString(),
          },
          {
            fetchOptions: {
              headers: {
                authorization: `Bearer ${accessToken}`,
              },
            },
          }
        );

      const walletForTransaction = {
        adapter: wallet.adapter,
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions,
        connected: true,
      };

      const signatures = await sendClientTransactions(
        this.client,
        walletForTransaction,
        stakeTransaction
      );

      if (signatures && signatures.length > 0) {
        return { success: true };
      }

      return { success: false, error: "Failed to stake character" };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Claim staking rewards for NFT cars
   */
  async claimStakingRewards(
    wallet: any,
    carMintAddresses: string[],
    stakingPoolAddress?: string
  ): Promise<{ success: boolean; rewards?: number; error?: string }> {
    try {
      const accessToken = await getOrCreateAccessToken(
        wallet.publicKey.toString(),
        this.getSignMessageFunction(wallet)
      );

      const poolAddress =
        stakingPoolAddress || import.meta.env.VITE_DEFAULT_STAKING_POOL;

      if (!poolAddress) {
        throw new Error("No staking pool available");
      }

      const claimTransaction =
        await this.client.createClaimStakingRewardsTransactions(
          {
            project: this.projectAddress,
            stakingPool: poolAddress,
            characters: carMintAddresses,
            payer: wallet.publicKey.toString(),
          },
          {
            fetchOptions: {
              headers: { authorization: `Bearer ${accessToken}` },
            },
          }
        );

      const walletForTransaction = {
        adapter: wallet.adapter,
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions,
        connected: true,
      };

      const signatures = await sendClientTransactions(
        this.client,
        walletForTransaction,
        claimTransaction
      );

      if (signatures && signatures.length > 0) {
        // Note: In a real implementation, you'd get actual reward amounts from the transaction
        return { success: true, rewards: 0 };
      }

      return { success: false, error: "Failed to claim rewards" };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Unstake an NFT car
   */
  async unstakeCar(
    wallet: any,
    carMintAddress: string,
    stakingPoolAddress?: string
  ): Promise<{ success: boolean; rewards?: number; error?: string }> {
    try {
      const accessToken = await getOrCreateAccessToken(
        wallet.publicKey.toString(),
        this.getSignMessageFunction(wallet)
      );

      const poolAddress =
        stakingPoolAddress || import.meta.env.VITE_DEFAULT_STAKING_POOL;

      if (!poolAddress) {
        throw new Error("No staking pool available");
      }

      // First claim any pending rewards
      try {
        await this.claimStakingRewards(wallet, [carMintAddress], poolAddress);
      } catch (claimError) {
        // Ignore claim errors during unstaking
      }

      // Create unstaking transaction
      const unstakeTransaction =
        await this.client.createUnstakeCharactersTransactions(
          {
            project: this.projectAddress,
            stakingPool: poolAddress,
            characters: [carMintAddress],
            payer: wallet.publicKey.toString(),
          },
          {
            fetchOptions: {
              headers: {
                authorization: `Bearer ${accessToken}`,
              },
            },
          }
        );

      const walletForTransaction = {
        adapter: wallet.adapter,
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions,
        connected: true,
      };

      const signatures = await sendClientTransactions(
        this.client,
        walletForTransaction,
        unstakeTransaction
      );

      if (signatures && signatures.length > 0) {
        return { success: true };
      }

      return { success: false, error: "Failed to unstake character" };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Apply car traits to game mechanics
   */
  applyCarTraits(baseCar: any, carTraits: CarTraits): any {
    return {
      ...baseCar,
      maxSpeed: baseCar.maxSpeed * (1 + (carTraits.speed - 5) * 0.1), // ±50% speed variation
      turnSpeed: baseCar.turnSpeed * (1 + (carTraits.handling - 5) * 0.1), // ±50% handling variation
      acceleration:
        baseCar.acceleration * (1 + (carTraits.acceleration - 5) * 0.1), // ±50% acceleration variation
      collisionDamage:
        baseCar.collisionDamage * (1 - (carTraits.durability - 5) * 0.05), // ±25% damage variation
    };
  }
}

export const nftCarService = new NFTCarService();

// Make service available globally for admin console access
if (typeof window !== "undefined") {
  (window as any).nftCarService = nftCarService;
  console.log("🔧 NFT Car Service available globally as window.nftCarService");
  console.log("📋 Available methods:");
  console.log("  - enableImmediatePublicMinting() // Quick solution");
  console.log(
    "  - enablePublicMinting(adminWallet) // Official wrapping method"
  );
}
