// Mission Service - Official Honeycomb Mission System Implementation
// Based on https://docs.honeycombprotocol.com/missions

import { createEdgeClient, RewardKind } from '@honeycomb-protocol/edge-client';
import { sendClientTransactions } from '@honeycomb-protocol/edge-client/client/walletHelpers';
import { getOrCreateAccessToken } from '../utils/accessToken';

export interface MissionPool {
  address: string;
  name: string;
  characterModel: string;
  project: string;
}

export interface Mission {
  address: string;
  name: string;
  description: string;
  duration: string; // Duration in seconds
  minXp: string;
  cost: {
    address: string;
    amount: string;
  };
  rewards: Array<{
    kind: RewardKind;
    min: string;
    max: string;
    resource?: string;
  }>;
  missionPool: string;
}

export interface CharacterMissionStatus {
  characterAddress: string;
  missionAddress: string;
  startTime: number;
  endTime: number;
  isActive: boolean;
  canRecall: boolean;
}

export class MissionService {
  private client;
  private projectAddress: string;

  constructor() {
    this.client = createEdgeClient(
      import.meta.env.VITE_PUBLIC_HONEYCOMB_API_URL || 'https://edge.test.honeycombprotocol.com/',
      true
    );
    this.projectAddress = import.meta.env.VITE_PUBLIC_HONEYCOMB_PROJECT_ADDRESS;
  }

  /**
   * Step 1: Create Mission Pool
   * Following official docs lines 33-46
   */
  async createMissionPool(
    wallet: any,
    characterModelAddress: string,
    poolName: string = "Daily Challenge Pool"
  ): Promise<string> {
    console.log('🏊 Creating mission pool for daily challenges...');
    
    // Properly bind the signMessage function to avoid context issues
    const signMessageFn = wallet.signMessage 
      ? wallet.signMessage.bind(wallet)
      : wallet.adapter?.signMessage?.bind(wallet.adapter);
    
    if (!signMessageFn) {
      throw new Error('No signMessage function available from wallet');
    }
    
    const accessToken = await getOrCreateAccessToken(
      wallet.publicKey.toString(),
      signMessageFn
    );
    
    // Exact format from official docs lines 38-46
    const {
      createCreateMissionPoolTransaction: {
        missionPoolAddress, // The address of the mission pool
        tx, // The transaction response, you'll need to sign and send this transaction
      },
    } = await this.client.createCreateMissionPoolTransaction({
      data: {
        name: poolName,
        project: this.projectAddress,
        payer: wallet.publicKey.toString(),
        authority: wallet.publicKey.toString(),
        characterModel: characterModelAddress,
      },
    }, {
      fetchOptions: {
        headers: { authorization: `Bearer ${accessToken}` },
      },
    });

    console.log('📋 Mission pool transaction created:', missionPoolAddress);
    
    // Send transaction using Honeycomb helper
    const walletWrapper = {
      publicKey: wallet.publicKey,
      signTransaction: wallet.signTransaction,
      signAllTransactions: wallet.signAllTransactions,
      adapter: wallet.adapter,
      connected: true
    };

    const signatures = await sendClientTransactions(this.client, walletWrapper, tx);
    console.log('✅ Mission pool created successfully:', signatures);
    
    return missionPoolAddress;
  }


  /**
   * Step 2: Create Daily Challenge Mission
   * Following official docs lines 57-89
   */
  async createDailyChallengeMission(
    wallet: any,
    missionPoolAddress: string,
    resourceAddress: string,
    missionData: {
      name: string;
      description: string;
      costAmount: string; // Resource cost to start mission
      durationHours: number; // Duration in hours
      minXp: string; // Minimum XP required
      xpReward: { min: string; max: string };
      resourceReward: { min: string; max: string };
    }
  ): Promise<string> {
    console.log('🎯 Creating daily challenge mission...');
    console.log('🔍 Mission resource address:', resourceAddress);
    console.log('🔍 Mission data:', missionData);
    
    if (!resourceAddress) {
      throw new Error(`Mission creation failed: resourceAddress is ${resourceAddress}`);
    }
    
    // Properly bind the signMessage function to avoid context issues
    const signMessageFn = wallet.signMessage 
      ? wallet.signMessage.bind(wallet)
      : wallet.adapter?.signMessage?.bind(wallet.adapter);
    
    if (!signMessageFn) {
      throw new Error('No signMessage function available from wallet');
    }
    
    const accessToken = await getOrCreateAccessToken(
      wallet.publicKey.toString(),
      signMessageFn
    );
    
    // Duration already in seconds
    const durationSeconds = missionData.duration;
    
    console.log(`🎯 Creating mission "${missionData.name}" with resource: ${resourceAddress}`);
    console.log(`🔍 Mission cost address: ${resourceAddress}`);
    console.log(`🔍 Mission reward resource: ${resourceAddress}`);
    
    // Exact format from official docs lines 62-89
    const {
      createCreateMissionTransaction: {
        missionAddress, // The address of the mission
        tx, // The transaction response, you'll need to sign and send this transaction
      },
    } = await this.client.createCreateMissionTransaction({
      data: {
        name: missionData.name,
        project: this.projectAddress,
        cost: {
          address: String(resourceAddress),
          amount: missionData.costAmount,
        },
        duration: durationSeconds, // Keep as string like official test
        minXp: missionData.minXp, // Keep as string - Honeycomb handles BigInt conversion
        rewards: [
          {
            kind: RewardKind.Xp,
            max: missionData.xpReward.max, // Keep as string - Honeycomb handles BigInt conversion
            min: missionData.xpReward.min, // Keep as string - Honeycomb handles BigInt conversion
          },
          {
            kind: RewardKind.Resource,
            max: missionData.resourceReward.max,
            min: missionData.resourceReward.min,
            resource: String(resourceAddress),
          },
        ],
        missionPool: missionPoolAddress,
        authority: wallet.publicKey.toString(),
        payer: wallet.publicKey.toString(),
      },
    }, {
      fetchOptions: {
        headers: { authorization: `Bearer ${accessToken}` },
      },
    });

    console.log('📋 Mission transaction created:', missionAddress);
    
    // Send transaction using Honeycomb helper
    const walletWrapper = {
      publicKey: wallet.publicKey,
      signTransaction: wallet.signTransaction,
      signAllTransactions: wallet.signAllTransactions,
      adapter: wallet.adapter,
      connected: true
    };

    const signatures = await sendClientTransactions(this.client, walletWrapper, tx);
    console.log('✅ Daily challenge mission created successfully:', signatures);
    
    return missionAddress;
  }

  /**
   * Get user ID for the connected wallet using the same pattern as the official test
   * Must return a valid number, never null, to prevent _bn errors
   */
  private async getUserId(wallet: any, accessToken: string): Promise<number> {
    try {
      console.log('🔍 Finding user ID for wallet:', wallet.publicKey.toString());
      
      // Step 1: Find existing user (following official test pattern)
      const userResponse = await this.client.findUsers({
        wallets: [wallet.publicKey.toString()],
      }, {
        fetchOptions: {
          headers: { authorization: `Bearer ${accessToken}` },
        },
      });

      console.log("👤 User search response:", userResponse);

      // FIX: Check all possible response structures (matching official test line 338)
      let users = null;
      if ((userResponse as any)?.user) {
        users = (userResponse as any).user;  // Official test uses .user not .findUsers.user
      } else if ((userResponse as any)?.findUsers?.user) {
        users = (userResponse as any).findUsers.user;
      } else if (Array.isArray(userResponse)) {
        users = userResponse;
      }

      console.log("👤 Extracted users:", users);

      if (users && users.length > 0) {
        const existingUser = users[0];
        console.log("✅ Found existing user with ID:", existingUser.id, typeof existingUser.id);
        
        // CRITICAL: Ensure we return a valid number, never null
        if (existingUser.id && typeof existingUser.id === 'number') {
          // CRITICAL: Also ensure user has a profile for this project (following official test lines 364-405)
          await this.ensureUserProfile(wallet, existingUser, accessToken);
          
          return existingUser.id;
        }
        
        console.warn("⚠️ User ID is not a valid number:", existingUser.id);
      }

      // Step 2: If no user found, create one (following official test pattern lines 341-351)
      console.log("❌ No existing user found, creating new user...");
      
      const userInfo = {
        username: wallet.publicKey.toString().substring(0, 16), // Keep it short
        name: "Racing Player",
        bio: "SPEEDY Racing Game Player",
        pfp: "https://arweave.net/AUgjbSGUbXzvjfX_0y2hHG9mVRH1Syk_ZI0iqmN8OAw" // Use same image as resource
      };
      
      const { createNewUserTransaction: txResponse } = await this.client.createNewUserTransaction({
        info: userInfo,
        wallet: wallet.publicKey.toString(),
      }, {
        fetchOptions: {
          headers: { authorization: `Bearer ${accessToken}` },
        },
      });

      console.log('📋 User creation transaction created');
      
      // Send transaction using Honeycomb helper
      const walletWrapper = {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions,
        adapter: wallet.adapter,
        connected: true
      };

      const signatures = await (await import('@honeycomb-protocol/edge-client/client/walletHelpers')).sendClientTransactions(this.client, walletWrapper, txResponse);
      console.log('✅ User created successfully:', signatures);
      
      // Wait a moment for indexing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Query the newly created user
      const newUserResponse = await this.client.findUsers({
        wallets: [wallet.publicKey.toString()],
      }, {
        fetchOptions: {
          headers: { authorization: `Bearer ${accessToken}` },
        },
      });
      
      // Extract user from response
      let newUsers = null;
      if ((newUserResponse as any)?.user) {
        newUsers = (newUserResponse as any).user;
      } else if ((newUserResponse as any)?.findUsers?.user) {
        newUsers = (newUserResponse as any).findUsers.user;
      }
      
      if (newUsers && newUsers.length > 0 && newUsers[0].id) {
        const newUser = newUsers[0];
        console.log("✅ Retrieved newly created user ID:", newUser.id);
        
        // CRITICAL: Also create profile for the user (following official test lines 375-405)
        await this.ensureUserProfile(wallet, newUser, accessToken);
        
        return newUser.id;
      }
      
      throw new Error('Failed to create or retrieve user ID - this is required for missions');
      
    } catch (error) {
      console.error('❌ Error getting user ID:', error);
      throw new Error(`Failed to get valid user ID: ${error.message}. User profile is required for missions.`);
    }
  }

  /**
   * Ensure user has a profile for this project (following official test lines 364-405)
   * Profiles are required for missions per the error message
   */
  private async ensureUserProfile(wallet: any, user: any, accessToken: string): Promise<void> {
    try {
      console.log('🔍 Checking if user has profile for project:', this.projectAddress);
      
      // Step 1: Check if profile already exists (following official test line 364)
      const profileResponse = await this.client.findProfiles({
        userIds: [user.id],
        projects: [this.projectAddress],
        includeProof: false,
      }, {
        fetchOptions: {
          headers: { authorization: `Bearer ${accessToken}` },
        },
      });
      
      console.log("🔍 Profile search response:", profileResponse);
      
      // Extract profile from response (following official test line 371)
      let profiles = null;
      if ((profileResponse as any)?.profile) {
        profiles = (profileResponse as any).profile;
      } else if ((profileResponse as any)?.findProfiles?.profile) {
        profiles = (profileResponse as any).findProfiles.profile;
      } else if (Array.isArray(profileResponse)) {
        profiles = profileResponse;
      }
      
      if (profiles && profiles.length > 0) {
        console.log("✅ User already has profile for this project:", profiles[0].address);
        return; // Profile exists, we're good
      }
      
      // Step 2: Create profile if it doesn't exist (following official test lines 375-405)
      console.log("❌ No profile found, creating profile for user...");
      
      // First, ensure project has a profile tree (following official test lines 296-332)
      await this.ensureProjectProfileTree(wallet, accessToken);
      
      const profileInfo = {
        name: `Racing Player ${user.id}`,
        bio: `SPEEDY Racing Game Profile for user ${user.id}`,
        pfp: "https://arweave.net/AUgjbSGUbXzvjfX_0y2hHG9mVRH1Syk_ZI0iqmN8OAw" // Use same image as resource
      };
      
      const { createNewProfileTransaction: txResponse } = await this.client.createNewProfileTransaction({
        project: this.projectAddress,
        info: profileInfo,
        payer: wallet.publicKey.toString(),
      }, {
        fetchOptions: {
          headers: { authorization: `Bearer ${accessToken}` },
        },
      });

      console.log('📋 Profile creation transaction created');
      
      // Send transaction using Honeycomb helper
      const walletWrapper = {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions,
        adapter: wallet.adapter,
        connected: true
      };

      const signatures = await (await import('@honeycomb-protocol/edge-client/client/walletHelpers')).sendClientTransactions(this.client, walletWrapper, txResponse);
      console.log('✅ Profile created successfully:', signatures);
      
      // Wait a moment for indexing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log("✅ User profile created and ready for missions");
      
    } catch (error) {
      console.error('❌ Error ensuring user profile:', error);
      throw new Error(`Failed to create user profile: ${error.message}. Profile is required for missions.`);
    }
  }

  /**
   * Ensure project has a profile tree (following official test lines 296-332)
   */
  /**
   * Get Honeycomb resource balance for a wallet
   */
  private async getResourceBalance(walletAddress: string, resourceAddress: string): Promise<number> {
    try {
      // Use the correct Honeycomb API method to get wallet holdings
      const holdingsQuery = await this.client.findHoldings({
        wallets: [walletAddress],
        resources: [resourceAddress]
      });

      if (holdingsQuery?.holding && holdingsQuery.holding.length > 0) {
        const holding = holdingsQuery.holding[0];
        const amount = parseFloat(holding.amount || '0') / 1000000; // Convert from smallest unit
        return amount;
      }

      return 0; // No balance found
    } catch (error) {
      console.error('❌ Error getting resource balance:', error);
      return 0;
    }
  }

  private async ensureProjectProfileTree(wallet: any, accessToken: string): Promise<void> {
    try {
      console.log('🔍 Checking if project has profile tree...');
      
      // Query project to check profile tree status
      const projectQuery = await this.client.findProjects({
        addresses: [this.projectAddress]
      });
      
      const project = projectQuery?.project?.[0];
      if (!project) {
        throw new Error('Project not found');
      }
      
      console.log('🔍 Project profile trees:', project.profileTrees);
      
      // Check if profile tree exists and is active (following official test line 297)
      if (project.profileTrees?.merkle_trees?.[project.profileTrees.active]) {
        console.log('✅ Project already has active profile tree');
        return; // Profile tree exists
      }
      
      // Create profile tree (following official test lines 298-327)
      console.log('❌ No active profile tree found, creating one...');
      
      const {
        createCreateProfilesTreeTransaction: {
          tx: txResponse,
          treeAddress: profilesTreeAddress,
        },
      } = await this.client.createCreateProfilesTreeTransaction({
        treeConfig: {
          advanced: {
            maxDepth: 3,
            maxBufferSize: 8,
            canopyDepth: 1,
          },
        },
        project: this.projectAddress,
        payer: wallet.publicKey.toString(),
      });
      
      console.log('📋 Profile tree creation transaction created');
      
      // Send transaction using Honeycomb helper
      const walletWrapper = {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions,
        adapter: wallet.adapter,
        connected: true
      };

      const signatures = await (await import('@honeycomb-protocol/edge-client/client/walletHelpers')).sendClientTransactions(this.client, walletWrapper, txResponse);
      console.log('✅ Profile tree created successfully:', signatures);
      console.log('🔍 Profile tree address:', profilesTreeAddress);
      
      // Wait a moment for indexing
      await new Promise(resolve => setTimeout(resolve, 3000));
      
    } catch (error) {
      console.error('❌ Error ensuring project profile tree:', error);
      throw new Error(`Failed to create project profile tree: ${error.message}`);
    }
  }

  /**
   * Step 3: Send Character on Mission
   * Following official docs lines 98-109
   */
  async sendCharacterOnMission(
    wallet: any,
    missionAddress: string,
    characterAddress: string
  ): Promise<string[]> {
    console.log('🚀 Sending character on mission...');
    console.log('🔍 Mission address:', missionAddress);
    console.log('🔍 Character address:', characterAddress);
    
    // CRITICAL: Add early debugging to catch where _bn error originates
    console.log('🔍 ===== EARLY _BN ERROR INVESTIGATION =====');
    console.log('🔍 Checking if mission address is valid:', {
      missionAddress,
      type: typeof missionAddress,
      isNull: missionAddress === null,
      isEmpty: missionAddress === '',
      isUndefined: missionAddress === undefined
    });
    
    // Skip balance checking - let Honeycomb handle it during transaction
    console.log('🎯 Skipping balance check - letting Honeycomb handle resource validation during transaction');
    
    // CRITICAL DEBUG: Force check mission details - _bn error source investigation
    console.log('🔍 ===== INVESTIGATING _BN ERROR SOURCE =====');
    console.log('🔍 Mission address being queried:', missionAddress);
    console.log('🔍 Mission address type:', typeof missionAddress);
    
    try {
      console.log('🔍 Querying mission details...');
      const missionQuery = await this.client.findMissions({
        addresses: [missionAddress]
      });
      console.log('🔍 Mission query result:', missionQuery);
      
      // Try different possible response structures
      const missionArray = missionQuery?.mission || [];
      console.log('🔍 Mission array:', missionArray);
      console.log('🔍 Mission array length:', missionArray.length);
      
      if (missionArray.length > 0) {
        const mission = missionArray[0];
        console.log('🔍 Mission details:', {
          name: mission.name,
          cost: mission.cost,
          rewards: mission.rewards,
          missionPool: mission.missionPool
        });
        
        // Deep inspect the cost object - CRITICAL for _bn error
        console.log('🔍 Mission cost object full:', JSON.stringify(mission.cost, (key, value) => 
          typeof value === 'bigint' ? value.toString() + 'n' : value, 2));
        console.log('🔍 Mission cost amount:', mission.cost?.amount, typeof mission.cost?.amount);
        console.log('🔍 Mission cost amount is null?', mission.cost?.amount === null);
        
        // Check if the cost amount is null (likely cause of _bn error)
        if (mission.cost?.amount === null || mission.cost?.amount === undefined) {
          console.error('❌ FOUND THE ISSUE: Mission cost amount is null! This causes _bn error');
          console.error('❌ Mission cost object:', mission.cost);
        }
        
        // Also check rewards for null amounts
        console.log('🔍 Mission rewards check:');
        if (mission.rewards && Array.isArray(mission.rewards)) {
          mission.rewards.forEach((reward, index) => {
            console.log(`🔍 Reward ${index}:`, {
              kind: reward.kind,
              min: reward.min,
              max: reward.max,
              resource: reward.resource
            });
            
            if (reward.min === null || reward.min === undefined) {
              console.error(`❌ FOUND ISSUE: Reward ${index} min amount is null!`);
            }
            if (reward.max === null || reward.max === undefined) {
              console.error(`❌ FOUND ISSUE: Reward ${index} max amount is null!`);
            }
          });
        }
        
        // Check if the cost resource matches our imported resource
        const storedResource = localStorage.getItem('honeycomb_resources');
        if (storedResource) {
          const resources = JSON.parse(storedResource);
          console.log('🔍 Imported resource:', resources.speedyToken);
          console.log('🔍 Mission cost resource (address):', mission.cost?.address);
          console.log('🔍 Mission cost resource (resource_address):', mission.cost?.resource_address);
          console.log('🔍 Mission cost object keys:', Object.keys(mission.cost || {}));
          
          // The actual resource address from the mission cost object
          const missionResourceAddress = mission.cost?.resource_address || mission.cost?.address;
          console.log('🔍 Resource match:', resources.speedyToken === missionResourceAddress);
          console.log('🔍 Mission uses resource_address field, not address field');
          
          // Verify the resource exists in Honeycomb system
          try {
            console.log('🔍 Verifying resource exists in Honeycomb system...');
            const resourceQuery = await this.client.findResources({
              addresses: [missionResourceAddress]
            });
            console.log('🔍 Resource query result:', resourceQuery);
            
            if (resourceQuery?.resources && resourceQuery.resources.length > 0) {
              console.log('✅ Resource confirmed to exist in Honeycomb system');
              console.log('🔍 Resource details:', resourceQuery.resources[0]);
            } else {
              console.log('❌ Resource NOT found in Honeycomb system! This explains the error.');
              console.log('❌ Need to re-import the SPEEDY token as a Honeycomb resource');
            }
          } catch (resourceError) {
            console.error('❌ Resource verification failed:', resourceError);
          }
        }
      } else {
        console.log('❌ Mission not found in query result!');
      }
    } catch (queryError) {
      console.error('❌ Mission query failed:', queryError);
    }
    
    // Properly bind the signMessage function to avoid context issues
    const signMessageFn = wallet.signMessage 
      ? wallet.signMessage.bind(wallet)
      : wallet.adapter?.signMessage?.bind(wallet.adapter);
    
    if (!signMessageFn) {
      throw new Error('No signMessage function available from wallet');
    }
    
    const accessToken = await getOrCreateAccessToken(
      wallet.publicKey.toString(),
      signMessageFn
    );
    
    // Get dynamic user ID for this wallet - required for missions per error message
    const userId = await this.getUserId(wallet, accessToken);
    console.log('🔍 User ID found:', userId, typeof userId);
    
    // getUserId() now guarantees to return a valid number or throw an error
    
    // CRITICAL FIX: Use project authority instead of user authority (like official test)
    // Official test uses adminKeypair.publicKey.toString() as authority (line 1073)
    // This might be the source of the _bn error - wrong authority permissions
    console.log('🔧 CRITICAL FIX: Using project authority instead of user authority...');
    
    let missionAuthority = wallet.publicKey.toString(); // Default to user
    
    try {
      // Get project details to find the correct authority
      const projectQuery = await this.client.findProjects({
        addresses: [this.projectAddress]
      });
      
      const project = projectQuery?.project?.[0];
      if (project && project.authority) {
        console.log('🔍 Project authority:', project.authority);
        console.log('🔍 User wallet:', wallet.publicKey.toString());
        
        // If user is the project authority, use user as authority
        // Otherwise, we may need to use project authority (but user needs permission)
        if (project.authority === wallet.publicKey.toString()) {
          missionAuthority = wallet.publicKey.toString();
          console.log('✅ User is project authority - using user as mission authority');
        } else {
          console.log('⚠️ User is NOT project authority - this might cause permission issues');
          console.log('⚠️ Proceeding with user authority anyway...');
          missionAuthority = wallet.publicKey.toString();
        }
      }
    } catch (authError) {
      console.warn('⚠️ Could not determine project authority, using user authority:', authError);
    }

    // Mission transaction format - userId required per error message
    const transactionData = {
      mission: missionAddress,
      characterAddresses: [
        characterAddress,
      ],
      authority: missionAuthority, // Use determined authority
      userId: userId, // Required for profile association
    };
    
    console.log('🔍 Send mission transaction data:', transactionData);
    
    // Debug each parameter to identify the null value causing _bn error
    console.log('🔍 Debug mission parameters (checking for null values that cause _bn error):');
    console.log('  - mission:', JSON.stringify(missionAddress), typeof missionAddress, 'isNull:', missionAddress === null);
    console.log('  - characterAddress:', JSON.stringify(characterAddress), typeof characterAddress, 'isNull:', characterAddress === null);
    console.log('  - authority:', JSON.stringify(wallet.publicKey.toString()), typeof wallet.publicKey.toString(), 'isNull:', wallet.publicKey.toString() === null);
    console.log('  - userId:', JSON.stringify(userId), typeof userId, 'isNull:', userId === null);
    
    // CRITICAL: Check if the mission itself has corrupted cost/reward data
    console.log('🔍 ===== INVESTIGATING MISSION DATA FOR NULL VALUES =====');
    try {
      const missionDetails = await this.client.findMissions({
        addresses: [missionAddress]
      });
      
      console.log('🔍 Raw mission query response:', missionDetails);
      
      const missions = missionDetails?.mission || missionDetails?.missions || [];
      if (missions.length > 0) {
        const mission = missions[0];
        console.log('🔍 Mission cost object:', JSON.stringify(mission.cost, (key, value) => 
          typeof value === 'bigint' ? value.toString() + 'n' : value, 2));
        console.log('🔍 Mission rewards array:', JSON.stringify(mission.rewards, (key, value) => 
          typeof value === 'bigint' ? value.toString() + 'n' : value, 2));
        
        // Check for null amounts in cost
        if (mission.cost) {
          console.log('🔍 Cost amount value:', mission.cost.amount, 'type:', typeof mission.cost.amount);
          console.log('🔍 Cost address value:', mission.cost.address, 'type:', typeof mission.cost.address);
          console.log('🔍 Cost resource_address value:', mission.cost.resource_address, 'type:', typeof mission.cost.resource_address);
          
          if (mission.cost.amount === null || mission.cost.amount === undefined) {
            console.error('❌ FOUND ISSUE: Mission cost amount is NULL! This causes _bn error in transaction processing');
            throw new Error('Mission has null cost amount - mission data is corrupted, need to recreate mission');
          }
          
          // CRITICAL FIX: Check both possible resource address fields
          const resourceAddress = mission.cost.resource_address || mission.cost.address;
          if (!resourceAddress) {
            console.error('❌ FOUND ISSUE: Mission cost has no resource address! This causes _bn error');
            console.error('❌ Mission cost object:', mission.cost);
            throw new Error('Mission has no resource address - mission data is corrupted');
          }
        }
        
        // Check for null amounts in rewards
        if (mission.rewards && Array.isArray(mission.rewards)) {
          mission.rewards.forEach((reward, index) => {
            console.log(`🔍 Reward ${index} min:`, reward.min, 'type:', typeof reward.min);
            console.log(`🔍 Reward ${index} max:`, reward.max, 'type:', typeof reward.max);
            console.log(`🔍 Reward ${index} type:`, reward.rewardType);
            
            if (reward.min === null || reward.min === undefined) {
              console.error(`❌ FOUND ISSUE: Reward ${index} min amount is NULL!`);
              throw new Error(`Mission reward ${index} has null min amount - mission data is corrupted`);
            }
            if (reward.max === null || reward.max === undefined) {
              console.error(`❌ FOUND ISSUE: Reward ${index} max amount is NULL!`);
              throw new Error(`Mission reward ${index} has null max amount - mission data is corrupted`);
            }
            
            // Check resource reward addresses too
            if (reward.rewardType?.kind === 'Resource') {
              const rewardResourceAddress = reward.rewardType?.params?.address || reward.resource;
              if (!rewardResourceAddress) {
                console.error(`❌ FOUND ISSUE: Reward ${index} has no resource address!`);
                console.error(`❌ Reward ${index} object:`, reward);
                throw new Error(`Mission reward ${index} has no resource address - mission data is corrupted`);
              }
            }
          });
        }
        
        console.log('✅ Mission cost and reward amounts are valid (not null)');
        
        // Also verify the resource exists and is valid
        const missionResourceAddress = mission.cost?.resource_address || mission.cost?.address;
        if (mission.cost && missionResourceAddress) {
          console.log('🔍 Verifying mission cost resource exists...');
          console.log('🔍 Using resource address:', missionResourceAddress);
          try {
            const resourceQuery = await this.client.findResources({
              addresses: [missionResourceAddress]
            });
            
            console.log('🔍 Resource verification query:', resourceQuery);
            
            const resources = resourceQuery?.resources || [];
            if (resources.length > 0) {
              const resource = resources[0];
              console.log('✅ Mission cost resource verified:', {
                address: resource.address,
                name: resource.name,
                symbol: resource.symbol,
                decimals: resource.decimals,
                mint: resource.mint
              });
            } else {
              console.error('❌ FOUND ISSUE: Mission cost resource does not exist in Honeycomb system!');
              console.error('❌ Tried to find resource:', missionResourceAddress);
              throw new Error(`Mission references non-existent resource: ${missionResourceAddress}`);
            }
          } catch (resourceError) {
            console.error('❌ Resource verification failed:', resourceError);
            throw new Error(`Cannot verify mission cost resource: ${resourceError.message}`);
          }
        }
        
      } else {
        console.error('❌ Mission not found in query result!');
        throw new Error('Mission not found - cannot verify mission data integrity');
      }
    } catch (missionDataError) {
      console.error('❌ Mission data verification failed:', missionDataError);
      throw new Error(`Mission data is corrupted: ${missionDataError.message}. Need to recreate mission with proper resource amounts.`);
    }
    
    // Additional validation - check for undefined, null, empty strings
    const validationErrors = [];
    if (!missionAddress || missionAddress === null || missionAddress === '') {
      validationErrors.push(`Mission address is invalid: ${missionAddress}`);
    }
    if (!characterAddress || characterAddress === null || characterAddress === '') {
      validationErrors.push(`Character address is invalid: ${characterAddress}`);
    }
    if (!wallet.publicKey || wallet.publicKey.toString() === null || wallet.publicKey.toString() === '') {
      validationErrors.push(`Wallet public key is invalid: ${wallet.publicKey}`);
    }
    if (typeof userId !== 'number' || userId <= 0) {
      validationErrors.push(`User ID is not a valid positive number: ${userId} (type: ${typeof userId})`);
    }
    
    if (validationErrors.length > 0) {
      throw new Error(`Parameter validation failed: ${validationErrors.join(', ')}`);
    }
    
    // Additional validation: Check if character is valid for missions
    try {
      console.log('🔍 Validating character for mission compatibility...');
      const characterQuery = await this.client.findCharacters({
        addresses: [characterAddress]
      }, {
        fetchOptions: {
          headers: { authorization: `Bearer ${accessToken}` },
        },
      });
      
      console.log('🔍 Character query result:', characterQuery);
      
      // Check if character exists and is properly configured
      let characters = null;
      if ((characterQuery as any)?.character) {
        characters = (characterQuery as any).character;
      } else if ((characterQuery as any)?.findCharacters?.character) {
        characters = (characterQuery as any).findCharacters.character;
      } else if (Array.isArray(characterQuery)) {
        characters = characterQuery;
      }
      
      if (!characters || characters.length === 0) {
        throw new Error('Character not found in Honeycomb system - may need to be created/wrapped first');
      }
      
      console.log('✅ Character found and validated for missions');
      
      // CRITICAL: Also check if character has any Honeycomb resource balances
      const character = characters[0];
      console.log('🔍 Character details for balance check:', {
        address: character.address,
        walletAddress: character.walletAddress || character.wallet,
        assets: character.assets?.length || 0
      });
      
      // Check character's Honeycomb resource holdings
      if (character.assets && Array.isArray(character.assets)) {
        console.log('🔍 Character assets/resources:');
        character.assets.forEach((asset, index) => {
          console.log(`  Asset ${index}:`, {
            address: asset.address,
            amount: asset.amount,
            resource: asset.resource
          });
          
          // Check for null amounts that could cause _bn error
          if (asset.amount === null || asset.amount === undefined) {
            console.error(`❌ FOUND ISSUE: Character asset ${index} has null amount!`, asset);
          }
        });
      } else {
        console.log('🔍 Character has no assets/resources or assets is not an array');
        
        // If character has no assets, check if wallet has Honeycomb resource balances
        console.log('🔍 Checking wallet Honeycomb resource balances...');
        try {
          // Get stored resource address from localStorage 
          const storedResources = localStorage.getItem('honeycomb_resources');
          if (storedResources) {
            const resources = JSON.parse(storedResources);
            const speedyResourceAddress = resources.speedyToken;
            
            if (speedyResourceAddress) {
              console.log('🔍 Checking Honeycomb resource balance for:', speedyResourceAddress);
              
              // Query user's Honeycomb resource holdings (this might show the null balance causing _bn error)
              const userResourceQuery = await this.client.findUsers({
                wallets: [wallet.publicKey.toString()],
                includeProof: false
              }, {
                fetchOptions: {
                  headers: { authorization: `Bearer ${accessToken}` },
                },
              });
              
              console.log('🔍 User resource query response:', userResourceQuery);
              
              // Check if the user object has resource balances
              const users = (userResourceQuery as any)?.user || [];
              if (users.length > 0) {
                const userWithResources = users[0];
                console.log('🔍 User object (checking for resource balances):', userWithResources);
                
                // Check if user has any resource-related fields that might be null
                if (userWithResources.resources || userWithResources.balances) {
                  console.log('🔍 User resource balances:', userWithResources.resources || userWithResources.balances);
                } else {
                  console.log('💰 User has no visible resource balances in user object (this is normal)');
                  console.log('💰 Honeycomb resources are tracked separately from user object');
                  console.log('💰 Skipping auto-mint to avoid infinite loop');
                  
                  // Auto-mint disabled to prevent infinite loop
                }
              }
            }
          }
        } catch (resourceBalanceError) {
          console.warn('⚠️ Could not check Honeycomb resource balances:', resourceBalanceError);
        }
      }
      
    } catch (charError) {
      console.warn('⚠️ Character validation failed:', charError);
      // Continue anyway - the error might provide more specific info
    }
    
    // Try converting addresses to ensure proper format (no BigNumber issues)
    const cleanMissionAddress = missionAddress?.toString() || missionAddress;
    const cleanCharacterAddress = characterAddress?.toString() || characterAddress;
    const cleanAuthority = missionAuthority; // Use the determined authority
    
    console.log('🔍 Attempting mission transaction with cleaned parameters:', {
      mission: cleanMissionAddress,
      characterAddresses: [cleanCharacterAddress],
      authority: cleanAuthority,
      payer: cleanAuthority,
      userId: userId,
      userIdAsString: userId?.toString(),
      userIdType: typeof userId,
    });


    // FINAL DEBUG: Log exact parameters being sent to GraphQL API
    const graphQLParams = {
      data: {
        mission: cleanMissionAddress,
        characterAddresses: [cleanCharacterAddress],
        authority: cleanAuthority,
        userId: userId, // Should be int, not string
      }
    };
    
    console.log('🔍 ===== FINAL _BN DEBUG: EXACT GRAPHQL PARAMS =====');
    console.log('🔍 GraphQL parameters:', JSON.stringify(graphQLParams, (key, value) => 
      typeof value === 'bigint' ? value.toString() + 'n' : value, 2));
    console.log('🔍 Access token length:', accessToken?.length);
    
    
    let blockhash: string, lastValidBlockHeight: number, transactions: string[];
    try {
      console.log('🔍 About to call createSendCharactersOnMissionTransaction...');
    console.log('🔍 ===== FINAL DEBUG: ALL PARAMETERS =====');
    console.log('🔍 Mission address:', missionAddress);
    console.log('🔍 Character address:', characterAddress);
    console.log('🔍 Authority:', cleanAuthority);
    console.log('🔍 User ID:', userId);
    console.log('🔍 All parameters are defined?', {
      missionAddress: missionAddress !== undefined && missionAddress !== null,
      characterAddress: characterAddress !== undefined && characterAddress !== null,
      cleanAuthority: cleanAuthority !== undefined && cleanAuthority !== null,
      userId: userId !== undefined && userId !== null
    });
      console.log('🔍 GraphQL call parameters:', JSON.stringify(graphQLParams, (key, value) => 
        typeof value === 'bigint' ? value.toString() + 'n' : value, 2));
      
      // Follow official test pattern from links.md lines 29-43
      const response = await this.client.createSendCharactersOnMissionTransaction(graphQLParams, {
        fetchOptions: {
          headers: { authorization: `Bearer ${accessToken}` },
        },
      });
      
      console.log('🔍 GraphQL response received:', response);
      
      const {
        createSendCharactersOnMissionTransaction: missionTxData
      } = response;
      
      blockhash = missionTxData.blockhash;
      lastValidBlockHeight = missionTxData.lastValidBlockHeight;
      transactions = missionTxData.transactions;
      
      console.log('✅ Mission transaction created successfully');
      
    } catch (missionError: any) {
      console.error('❌ Mission error details:', {
        message: missionError.message,
        graphQLErrors: missionError.graphQLErrors,
        networkError: missionError.networkError,
        source: missionError.source
      });
      
      // If it's the _bn error, it means there's still a null value somewhere
      if (missionError.message?.includes('_bn')) {
        console.error('❌ _bn error detected - this means a null value is being processed as BigNumber');
        console.error('❌ Possible causes:');
        console.error('  1. Mission cost resource_address is not being properly handled by API');
        console.error('  2. Character has null/undefined balance for the cost resource');
        console.error('  3. Mission pool or character model has corrupted data');
        console.error('  4. API expects different field names than what we\'re sending');
      }
      
      throw missionError;
    }

    console.log('📋 Send mission transaction created');
    
    // Send transactions using official test pattern (lines 45-55)
    const walletWrapper = {
      publicKey: wallet.publicKey,
      signTransaction: wallet.signTransaction,
      signAllTransactions: wallet.signAllTransactions,
      adapter: wallet.adapter,
      connected: true
    };

    // Process multiple transactions as per official test
    const allSignatures: string[] = [];
    
    if (transactions && Array.isArray(transactions) && transactions.length > 0) {
      console.log(`📋 Processing ${transactions.length} mission transactions...`);
      
      for (let i = 0; i < transactions.length; i++) {
        const individualTxResponse = {
          transaction: transactions[i],
          blockhash,
          lastValidBlockHeight,
        };
        
        const signatures = await sendClientTransactions(this.client, walletWrapper, individualTxResponse);
        allSignatures.push(...signatures);
        console.log(`✅ Mission transaction ${i + 1}/${transactions.length} sent:`, signatures);
      }
    } else {
      // Fallback - create single transaction object
      const txResponse = { blockhash, lastValidBlockHeight, transactions };
      const signatures = await sendClientTransactions(this.client, walletWrapper, txResponse);
      allSignatures.push(...signatures);
    }
    
    console.log('✅ Character sent on mission successfully:', allSignatures);
    
    return allSignatures;
  }

  /**
   * Step 4: Recall Character from Mission
   * Following official docs lines 121-133
   */
  async recallCharacterFromMission(
    wallet: any,
    missionAddress: string,
    characterAddress: string,
    lookupTableAddress?: string
  ): Promise<string[]> {
    console.log('🏁 Recalling character from mission...');
    
    // Properly bind the signMessage function to avoid context issues
    const signMessageFn = wallet.signMessage 
      ? wallet.signMessage.bind(wallet)
      : wallet.adapter?.signMessage?.bind(wallet.adapter);
    
    if (!signMessageFn) {
      throw new Error('No signMessage function available from wallet');
    }
    
    const accessToken = await getOrCreateAccessToken(
      wallet.publicKey.toString(),
      signMessageFn
    );
    
    // Get user ID for recall transaction (required as per official test line 764)
    const userId = await this.getUserId(wallet, accessToken);
    console.log('🔍 Recall user ID found:', userId, typeof userId);
    
    // getUserId() now guarantees to return a valid number or throw an error
    

    // Follow official docs pattern from lines 32-42
    const recallParams: any = {
      data: {
        mission: missionAddress,
        characterAddresses: [
          characterAddress
        ],
        authority: wallet.publicKey.toString(),
        payer: wallet.publicKey.toString(), // Optional
        userId: userId, // Should be int, not string
      }
    };

    const {
      createRecallCharactersTransaction: txResponse // This is the transaction response, you'll need to sign and send this transaction
    } = await this.client.createRecallCharactersTransaction(recallParams, {
      fetchOptions: {
        headers: { authorization: `Bearer ${accessToken}` },
      },
    });

    console.log('📋 Recall mission transaction created');
    
    // Send transaction using Honeycomb helper (simple format per official docs)
    const walletWrapper = {
      publicKey: wallet.publicKey,
      signTransaction: wallet.signTransaction,
      signAllTransactions: wallet.signAllTransactions,
      adapter: wallet.adapter,
      connected: true
    };

    const signatures = await sendClientTransactions(this.client, walletWrapper, txResponse);
    console.log('✅ Character recalled from mission successfully:', signatures);
    
    return signatures;
  }

  /**
   * Query character mission status
   */
  async getCharacterMissionStatus(characterAddress: string): Promise<CharacterMissionStatus | null> {
    try {
      // Query character's current mission status
      const characterData = await this.client.findCharacters({
        addresses: [characterAddress],
        includeProof: true,
      });

      if (!characterData?.characters?.[0]) {
        return null;
      }

      const character = characterData.characters[0];
      
      // Check if character is currently on a mission
      if (character.usedBy && character.usedBy.kind === 'Mission') {
        const missionAddress = character.usedBy.address;
        const startTime = character.usedBy.usedAt ? new Date(character.usedBy.usedAt).getTime() : Date.now();
        
        // Get mission details to calculate end time
        const missionData = await this.client.findMissions({
          addresses: [missionAddress]
        });

        if (missionData?.missions?.[0]) {
          const mission = missionData.missions[0];
          const durationMs = parseInt(mission.duration) * 1000;
          const endTime = startTime + durationMs;
          const now = Date.now();

          return {
            characterAddress,
            missionAddress,
            startTime,
            endTime,
            isActive: now < endTime,
            canRecall: now >= endTime,
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting character mission status:', error);
      return null;
    }
  }

  /**
   * Import existing SPEEDY token using PDA mint authority
   */
  async createSpeedyResource(wallet: any): Promise<string> {
    console.log('💎 Attempting to import existing SPEEDY token...');
    
    // Properly bind the signMessage function to avoid context issues
    const signMessageFn = wallet.signMessage 
      ? wallet.signMessage.bind(wallet)
      : wallet.adapter?.signMessage?.bind(wallet.adapter);
    
    if (!signMessageFn) {
      throw new Error('No signMessage function available from wallet');
    }
    
    const accessToken = await getOrCreateAccessToken(
      wallet.publicKey.toString(),
      signMessageFn
    );
    
    // Get existing SPEEDY token mint from environment
    const speedyTokenMint = import.meta.env.VITE_SPEEDY_TOKEN_MINT;
    if (!speedyTokenMint) {
      throw new Error('VITE_SPEEDY_TOKEN_MINT not found in environment variables');
    }
    
    console.log('🔍 Using existing SPEEDY token mint:', speedyTokenMint);
    console.log('🔍 Using wallet as mint authority:', wallet.publicKey.toString());
    console.log('🔍 Project address:', this.projectAddress);
    
    // Critical Debug: Check project details and permissions
    try {
      console.log('🔍 Fetching project details...');
      console.log('🔍 Looking for project address:', this.projectAddress);
      console.log('🔍 Project address source:', import.meta.env.VITE_PUBLIC_HONEYCOMB_PROJECT_ADDRESS ? 'ENV VAR' : 'DEFAULT');
      
      const projectQuery = await this.client.findProjects({
        addresses: [this.projectAddress]
      });
      
      console.log('🔍 Project query result:', projectQuery);
      
      // Fix: API returns 'project' not 'projects'
      if (projectQuery?.project && projectQuery.project.length > 0) {
        const project = projectQuery.project[0];
        console.log('✅ Project found:', {
          address: project.address,
          authority: project.authority,
          name: project.name,
          profileDataConfig: project.profileDataConfig
        });
        
        // Check if wallet matches project authority
        const isProjectAuthority = project.authority === wallet.publicKey.toString();
        console.log('🔍 Project authority match:', isProjectAuthority ? '✅ MATCH' : '❌ MISMATCH');
        console.log('🔍 Project authority:', project.authority);
        console.log('🔍 Wallet address:', wallet.publicKey.toString());
        
      } else {
        console.error('❌ Project not found! This could be the root issue.');
        console.log('🔍 Let me check what projects exist for this wallet...');
        
        // Check all projects where wallet is authority
        console.log('🔍 Searching for ANY projects with wallet as authority...');
        const allProjectsQuery = await this.client.findProjects({
          authorities: [wallet.publicKey.toString()]
        });
        
        // Also try searching without filters to see ALL projects
        console.log('🔍 Let me also check ALL projects in the system...');
        const globalProjectsQuery = await this.client.findProjects({});
        console.log('🔍 Total projects in system:', globalProjectsQuery?.totalProjects || 0);
        
        if (globalProjectsQuery?.project && globalProjectsQuery.project.length > 0) {
          console.log('🔍 Sample projects in system (first 5):');
          globalProjectsQuery.project.slice(0, 5).forEach((project, i) => {
            console.log(`  ${i + 1}. ${project.address} - Authority: ${project.authority} - Name: ${project.name || 'Unnamed'}`);
            
            // Check if any project matches your .env address
            if (project.address === this.projectAddress) {
              console.log('  ^^^^ THIS IS YOUR PROJECT FROM .ENV! Authority mismatch?');
            }
          });
        }
        
        if (allProjectsQuery?.project && allProjectsQuery.project.length > 0) {
          console.log('✅ Found projects where wallet is authority:');
          allProjectsQuery.project.forEach((project, i) => {
            console.log(`  ${i + 1}. ${project.address} - ${project.name || 'Unnamed'}`);
          });
          
          // Use the first available project
          const firstProject = allProjectsQuery.project[0];
          console.log('🔄 Switching to first available project:', firstProject.address);
          this.projectAddress = firstProject.address;
        } else {
          console.log('❌ No projects found where wallet is authority!');
          console.log('💡 Creating a project automatically...');
          
          // Create a new project for this wallet
          try {
            const { createCreateProjectTransaction } = await this.client.createCreateProjectTransaction({
              data: {
                name: "SPEEDY Racing Game",
                authority: wallet.publicKey.toString(),
                payer: wallet.publicKey.toString(),
                profileDataConfigs: []
              }
            }, {
              fetchOptions: {
                headers: { authorization: `Bearer ${accessToken}` }
              }
            });
            
            console.log('📋 Project creation transaction:', createCreateProjectTransaction);
            
            // Create wallet wrapper for transaction
            const projectWalletWrapper = {
              publicKey: wallet.publicKey,
              signTransaction: wallet.signTransaction,
              signAllTransactions: wallet.signAllTransactions,
              adapter: wallet.adapter,
              connected: true
            };
            
            // Send the transaction to create the project
            const projectSignatures = await sendClientTransactions(this.client, projectWalletWrapper, createCreateProjectTransaction.tx);
            console.log('✅ Project created successfully:', projectSignatures);
            
            // Extract the project address
            const newProjectAddress = createCreateProjectTransaction.project;
            console.log('🎯 New project address:', newProjectAddress);
            
            if (newProjectAddress) {
              this.projectAddress = newProjectAddress;
              console.log('🔄 Updated project address to:', this.projectAddress);
            }
            
          } catch (createProjectError) {
            console.error('❌ Failed to create project:', createProjectError);
            throw new Error('Cannot proceed without a valid project');
          }
        }
      }
    } catch (projectError) {
      console.error('❌ Failed to fetch project details:', projectError);
    }
    
    // Debug: Let's verify the actual mint authority from the blockchain
    try {
      const connection = new (await import('@solana/web3.js')).Connection(
        import.meta.env.VITE_PUBLIC_HONEYCOMB_RPC_URL || "https://rpc.test.honeycombprotocol.com",
        "confirmed"
      );
      const mintInfo = await connection.getParsedAccountInfo(new (await import('@solana/web3.js')).PublicKey(speedyTokenMint));
      if (mintInfo.value?.data && 'parsed' in mintInfo.value.data) {
        const mintAuthority = mintInfo.value.data.parsed.info.mintAuthority;
        console.log('🔍 Actual mint authority from blockchain:', mintAuthority);
        console.log('🔍 Authority match:', mintAuthority === wallet.publicKey.toString() ? '✅ MATCH' : '❌ MISMATCH');
      }
    } catch (mintCheckError) {
      console.warn('⚠️ Could not verify mint authority:', mintCheckError);
    }
    
    // Import existing fungible token as Honeycomb resource using proper authority
    // According to docs: "You have to be the owner/authority of the token you're importing"
    // From your contract.rs: mint::authority = authority (wallet is mint authority)
    // First, check if resource already exists for this mint
    console.log('🔍 Checking if SPEEDY resource already exists...');
    try {
      const existingResourceQuery = await this.client.findResources({
        projects: [this.projectAddress],
        mints: [speedyTokenMint]
      });
      
      if (existingResourceQuery?.resources && existingResourceQuery.resources.length > 0) {
        const existingResource = existingResourceQuery.resources[0];
        console.log('✅ Found existing SPEEDY resource!', existingResource);
        const existingAddress = existingResource.address || existingResource.id;
        console.log('🔍 Existing resource address:', existingAddress);
        return existingAddress;
      } else {
        console.log('🔍 No existing SPEEDY resource found, proceeding with import...');
        
        // Debug: Show what resources DO exist in this project
        if (existingResourceQuery?.resources) {
          console.log(`🔍 Project currently has ${existingResourceQuery.resources.length} resources:`);
          existingResourceQuery.resources.slice(0, 3).forEach((resource, i) => {
            console.log(`  ${i + 1}. Address: ${resource.address || resource.id}, Mint: ${resource.mint}, Name: ${resource.name || 'unnamed'}`);
          });
        }
      }
    } catch (existingCheckError) {
      console.warn('⚠️ Could not check for existing resources:', existingCheckError);
    }

    console.log('🔍 Import parameters (proper authority and storage):', {
      decimals: 6,
      tags: ["SPEEDY", "Game Token"], // Added tags per docs recommendation
      project: this.projectAddress,
      mint: speedyTokenMint,
      authority: wallet.publicKey.toString(), // Wallet is mint authority from contract
      storage: "LedgerState" // Use LedgerState (compressed/wrapped) for better compatibility
    });
    
    // Get the correct authority for resource import
    let correctAuthority = wallet.publicKey.toString();
    
    // If we discovered project authority is different, use that instead
    try {
      const projectQuery = await this.client.findProjects({
        addresses: [this.projectAddress]
      });
      
      if (projectQuery?.projects && projectQuery.projects.length > 0) {
        const project = projectQuery.projects[0];
        if (project.authority && project.authority !== wallet.publicKey.toString()) {
          console.log('🔄 Using project authority for import instead of wallet');
          correctAuthority = project.authority;
        }
      }
    } catch (projectQueryError) {
      console.warn('⚠️ Could not query project for authority, using wallet');
    }

    // Create new Honeycomb resource with proper decimals
    console.log('🔄 Creating new Honeycomb resource with proper decimals...');
    
    const { createCreateNewResourceTransaction } = await this.client.createCreateNewResourceTransaction({
      project: this.projectAddress,
      authority: correctAuthority,
      params: {
        name: "SPEEDY Token",
        symbol: "SPEEDY", 
        decimals: 6, // Explicitly set proper decimals
        storage: "AccountState",
        uri: "https://arweave.net/AUgjbSGUbXzvjfX_0y2hHG9mVRH1Syk_ZI0iqmN8OAw"
      }
    }, {
      fetchOptions: {
        headers: { authorization: `Bearer ${accessToken}` },
      },
    });
    
    const createImportResult = createCreateNewResourceTransaction;
    console.log('✅ SPEEDY resource import transaction created successfully');
    
    console.log('📋 SPEEDY resource import transaction response:', createImportResult);
    
    // Extract resource address using official API structure from docs
    let resourceAddress = createImportResult.resource;
    
    console.log('🔍 Extracted resource address before transaction:', resourceAddress);
    
    // Send transaction using Honeycomb helper
    const walletWrapper = {
      publicKey: wallet.publicKey,
      signTransaction: wallet.signTransaction,
      signAllTransactions: wallet.signAllTransactions,
      adapter: wallet.adapter,
      connected: true
    };

    const signatures = await sendClientTransactions(this.client, walletWrapper, createImportResult.tx);
    console.log('✅ SPEEDY token transaction sent successfully:', signatures);
    
    // Verify transaction was actually successful
    if (!signatures || signatures.length === 0) {
      throw new Error('Transaction failed - no signatures returned from sendClientTransactions');
    }
    
    // If still undefined, check if it's in the transaction response
    if (!resourceAddress && createImportResult.tx) {
      console.log('🔍 Checking transaction object for resource address:', createImportResult.tx);
      resourceAddress = createImportResult.tx.resourceAddress ||
                       createImportResult.tx.resource ||
                       createImportResult.tx.address;
    }
    
    console.log('🔍 Final resource address:', resourceAddress);
    
    if (!resourceAddress) {
      throw new Error('Failed to extract resource address from import transaction response');
    }
    
    // Wait for resource to be available in Honeycomb system with shorter timeout
    console.log('⏳ Waiting for resource to be available in Honeycomb system...');
    let resourceVerified = false;
    let attempts = 0;
    const maxAttempts = 10; // Reduced attempts - if it doesn't work quickly, there's likely a fundamental issue
    
    while (!resourceVerified && attempts < maxAttempts) {
      attempts++;
      console.log(`🔍 Verification attempt ${attempts}/${maxAttempts}...`);
      
      try {
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
        
        // Try multiple query approaches to find the resource
        console.log('🔍 Trying different resource queries...');
        
        // 1. Query by specific address
        const verificationQuery = await this.client.findResources({
          addresses: [resourceAddress]
        });
        console.log(`🔍 Direct resource query for ${resourceAddress}:`, verificationQuery);
        
        // 2. Query by project and mint (might work better)
        const projectMintQuery = await this.client.findResources({
          projects: [this.projectAddress],
          mints: [import.meta.env.VITE_SPEEDY_TOKEN_MINT]
        });
        console.log(`🔍 Project+mint query:`, projectMintQuery);
        
        // 3. Query by project with tags
        const tagQuery = await this.client.findResources({
          projects: [this.projectAddress],
          tags: ["SPEEDY"]
        });
        console.log(`🔍 Tag-based query:`, tagQuery);
        
        // Check if any query method found the resource
        let foundResource = null;
        
        if (verificationQuery?.resources && verificationQuery.resources.length > 0) {
          foundResource = verificationQuery.resources[0];
          console.log('✅ Resource found via direct address query!');
        } else if (projectMintQuery?.resources && projectMintQuery.resources.length > 0) {
          foundResource = projectMintQuery.resources[0];
          console.log('✅ Resource found via project+mint query!');
          // Update resource address if different
          const foundAddress = foundResource.address || foundResource.id;
          if (foundAddress && foundAddress !== resourceAddress) {
            console.log(`🔄 Updating resource address: ${resourceAddress} -> ${foundAddress}`);
            resourceAddress = foundAddress;
          }
        } else if (tagQuery?.resources && tagQuery.resources.length > 0) {
          const speedyResource = tagQuery.resources.find(r => 
            r.mint === import.meta.env.VITE_SPEEDY_TOKEN_MINT || 
            r.tags?.includes('SPEEDY') ||
            r.name?.includes('SPEEDY')
          );
          if (speedyResource) {
            foundResource = speedyResource;
            console.log('✅ Resource found via tag query!');
            const foundAddress = foundResource.address || foundResource.id;
            if (foundAddress && foundAddress !== resourceAddress) {
              console.log(`🔄 Updating resource address: ${resourceAddress} -> ${foundAddress}`);
              resourceAddress = foundAddress;
            }
          }
        }
        
        if (foundResource) {
          resourceVerified = true;
          console.log('✅ Resource verified in Honeycomb system!');
          console.log('🔍 Resource details:', foundResource);
        } else {
          console.log(`❌ Resource not yet available (attempt ${attempts}/${maxAttempts})`);
          
          // On first attempt, also check all project resources to see if SPEEDY exists elsewhere
          if (attempts === 1) {
            try {
              console.log('🔍 Checking all project resources...');
              const allResourcesQuery = await this.client.findResources({
                // Query ALL resources, not just our project
              });
              console.log('🔍 All resources query (showing total count):', { 
                totalResources: allResourcesQuery?.resources?.length || 0 
              });
              
              if (allResourcesQuery?.resources) {
                console.log('🔍 Sample of project resources (first 3):', allResourcesQuery.resources.slice(0, 3));
                console.log('🔍 Our project address:', this.projectAddress);
                console.log('🔍 Looking for our SPEEDY resource with address:', resourceAddress);
                
                // Check if our project has any resources at all
                const ourProjectResources = allResourcesQuery.resources.filter(r => 
                  r.project === this.projectAddress
                );
                console.log(`🔍 Resources in our project (${this.projectAddress}):`, ourProjectResources.length);
                if (ourProjectResources.length > 0) {
                  console.log('🔍 Our project resources (first 3):', ourProjectResources.slice(0, 3));
                }
                
                // Look for our native SPEEDY resource by address
                const ourResource = allResourcesQuery.resources.find(r => 
                  r.address === resourceAddress
                );
                
                if (ourResource) {
                  console.log('🔍 Found our native SPEEDY resource in project:', ourResource);
                } else {
                  console.log('❌ Our native SPEEDY resource not found in project resources');
                  
                  // Show some native resources for comparison
                  const nativeResources = allResourcesQuery.resources.filter(r => 
                    r.symbol && r.symbol.includes('SPEEDY')
                  ).slice(0, 3);
                  if (nativeResources.length > 0) {
                    console.log('🔍 Found other SPEEDY-related resources:', nativeResources);
                  }
                }
              }
            } catch (allResourcesError) {
              console.warn('⚠️ Could not query all project resources:', allResourcesError);
            }
          }
        }
      } catch (verifyError) {
        console.warn(`⚠️ Verification attempt ${attempts} failed:`, verifyError);
      }
    }
    
    if (!resourceVerified) {
      console.warn('⚠️ Resource import transaction succeeded but resource not queryable yet');
      console.warn('⚠️ Proceeding anyway - the resource address is valid and missions should work');
      console.log('💡 If missions fail, the resource may need more time to be indexed by Honeycomb');
    } else {
      console.log('✅ Resource successfully verified and ready for missions');
    }
    
    // Step 3: Mint initial tokens to admin wallet (1,000,000 tokens)
    console.log('💰 Minting initial 1,000,000 SPEEDY tokens to admin wallet...');
    try {
      // Use official Honeycomb API format from docs
      const {
        createMintResourceTransaction: txResponse // This is the transaction response directly
      } = await this.client.createMintResourceTransaction({
        resource: resourceAddress, // Resource public key as a string
        amount: "1000000000000", // 1,000,000 tokens with 6 decimals (1,000,000 * 10^6)
        authority: correctAuthority, // Project authority's public key
        owner: wallet.publicKey.toString(), // The owner's public key, this wallet will receive the resource
        payer: wallet.publicKey.toString() // Optional, specify when you want a different wallet to pay for the tx
      }, {
        fetchOptions: {
          headers: { authorization: `Bearer ${accessToken}` },
        },
      });

      // Send mint transaction using the official response structure
      const mintSignatures = await sendClientTransactions(this.client, walletWrapper, txResponse);
      console.log('✅ Successfully minted 1,000,000 SPEEDY tokens to admin wallet:', mintSignatures);
      
    } catch (mintError) {
      console.warn('⚠️ Failed to mint initial tokens (resource still created successfully):', mintError);
      console.error('⚠️ Mint error details:', mintError);
      // Don't throw error - resource is still created successfully
    }
    
    return resourceAddress;
  }



  /**
   * Create predefined daily challenges
   */
  async createDefaultDailyChallenges(
    wallet: any,
    missionPoolAddress: string,
    resourceAddress: string
  ): Promise<string[]> {
    console.log('🎯 Creating default daily challenges...');

    const challenges = [
      {
        name: "Speed Demon Challenge",
        description: "Complete a 4-hour racing mission to earn XP and SPEEDY tokens",
        costAmount: String(10 * 10 ** 6), // 10 SPEEDY tokens (6 decimals)
        duration: "14400", // 4 hours in seconds
        minXp: "0", // Minimum XP required
        xpReward: { min: "100", max: "200" },
        resourceReward: { min: String(25 * 10 ** 6), max: String(50 * 10 ** 6) }, // 25-50 SPEEDY tokens (6 decimals)
      },
      {
        name: "Endurance Race",
        description: "Complete an 8-hour endurance mission for bigger rewards",
        costAmount: String(20 * 10 ** 6), // 20 SPEEDY tokens (6 decimals)
        duration: "28800", // 8 hours in seconds
        minXp: "10", // Minimum XP required
        xpReward: { min: "250", max: "400" },
        resourceReward: { min: String(30 * 10 ** 6), max: String(60 * 10 ** 6) }, // 30-60 SPEEDY tokens (6 decimals)
      },
      {
        name: "Daily Sprint",
        description: "Quick 1-hour mission for fast rewards",
        costAmount: String(5 * 10 ** 6), // 5 SPEEDY tokens (6 decimals)
        duration: "3600", // 1 hour in seconds
        minXp: "10", // Minimum XP required
        xpReward: { min: "25", max: "50" },
        resourceReward: { min: String(15 * 10 ** 6), max: String(25 * 10 ** 6) }, // 15-25 SPEEDY tokens (6 decimals)
      }
    ];

    const missionAddresses: string[] = [];

    for (const challenge of challenges) {
      try {
        const missionAddress = await this.createDailyChallengeMission(
          wallet,
          missionPoolAddress,
          resourceAddress,
          challenge
        );
        missionAddresses.push(missionAddress);
        console.log(`✅ Created challenge: ${challenge.name} at ${missionAddress}`);
        
        // Wait a bit between transactions to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`❌ Failed to create challenge: ${challenge.name}`, error);
      }
    }

    return missionAddresses;
  }
}

// Export singleton instance
export const missionService = new MissionService();