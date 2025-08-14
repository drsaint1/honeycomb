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
    
    // Convert hours to seconds
    const durationSeconds = (missionData.durationHours * 60 * 60).toString();
    
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
          address: resourceAddress,
          amount: missionData.costAmount,
        },
        duration: durationSeconds,
        minXp: missionData.minXp,
        rewards: [
          {
            kind: RewardKind.Xp,
            max: missionData.xpReward.max,
            min: missionData.xpReward.min,
          },
          {
            kind: RewardKind.Resource,
            max: missionData.resourceReward.max,
            min: missionData.resourceReward.min,
            resource: resourceAddress,
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
   * Get user ID for the connected wallet using the same pattern as the game
   */
  private async getUserId(wallet: any, accessToken: string): Promise<number | null> {
    try {
      console.log('🔍 Finding user ID for wallet:', wallet.publicKey.toString());
      
      // Step 1: Find existing user (following game pattern)
      const userResponse = await this.client.findUsers({
        wallets: [wallet.publicKey.toString()],
      }, {
        fetchOptions: {
          headers: { authorization: `Bearer ${accessToken}` },
        },
      });

      console.log("👤 User search response:", userResponse);

      // FIX: Check all possible response structures (same as game)
      let users = null;
      if ((userResponse as any)?.findUsers?.user) {
        users = (userResponse as any).findUsers.user;
      } else if ((userResponse as any)?.user) {
        users = (userResponse as any).user;
      } else if (Array.isArray(userResponse)) {
        users = userResponse;
      }

      console.log("👤 Extracted users:", users);

      if (users && users.length > 0) {
        const existingUser = users[0];
        console.log("✅ Found existing user with ID:", existingUser.id);
        return existingUser.id;
      }

      console.log("❌ No existing user found for wallet");
      return null;
    } catch (error) {
      console.error('❌ Error finding user ID:', error);
      return null;
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
    
    // Check wallet SPEEDY token balance first
    try {
      const { speedyTokenService } = await import('./speedyTokenService');
      const speedyBalance = await speedyTokenService.getTokenBalance(wallet.publicKey.toString());
      console.log(`💰 Wallet SPEEDY balance: ${speedyBalance} tokens`);
      
      if (speedyBalance < 0.05) {
        throw new Error(`Insufficient SPEEDY tokens. Balance: ${speedyBalance}, minimum needed: 0.05`);
      }
    } catch (balanceError) {
      console.warn('⚠️ Could not check SPEEDY balance:', balanceError);
    }
    
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
      const missionArray = missionQuery?.missions || missionQuery?.mission || [];
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
        console.log('🔍 Mission cost object full:', JSON.stringify(mission.cost, null, 2));
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
    console.log('🔍 User ID found:', userId);
    
    if (!userId) {
      throw new Error('User ID not found - profile required for missions. Make sure user profile exists.');
    }
    
    // Mission transaction format - userId required per error message
    const transactionData = {
      mission: missionAddress,
      characterAddresses: [
        characterAddress,
      ],
      authority: wallet.publicKey.toString(),
      userId: userId, // Required for profile association
    };
    
    console.log('🔍 Send mission transaction data:', transactionData);
    
    // Debug each parameter to identify the null value causing _bn error
    console.log('🔍 Debug mission parameters (checking for null values that cause _bn error):');
    console.log('  - mission:', JSON.stringify(missionAddress), typeof missionAddress, 'isNull:', missionAddress === null);
    console.log('  - characterAddress:', JSON.stringify(characterAddress), typeof characterAddress, 'isNull:', characterAddress === null);
    console.log('  - authority:', JSON.stringify(wallet.publicKey.toString()), typeof wallet.publicKey.toString(), 'isNull:', wallet.publicKey.toString() === null);
    console.log('  - userId:', JSON.stringify(userId), typeof userId, 'isNull:', userId === null);
    
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
    if (userId === null || userId === undefined) {
      validationErrors.push(`User ID is null/undefined: ${userId}`);
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
      } else if ((characterQuery as any)?.characters) {
        characters = (characterQuery as any).characters;
      } else if ((characterQuery as any)?.findCharacters?.character) {
        characters = (characterQuery as any).findCharacters.character;
      } else if (Array.isArray(characterQuery)) {
        characters = characterQuery;
      }
      
      if (!characters || characters.length === 0) {
        throw new Error('Character not found in Honeycomb system - may need to be created/wrapped first');
      }
      
      console.log('✅ Character found and validated for missions');
    } catch (charError) {
      console.warn('⚠️ Character validation failed:', charError);
      // Continue anyway - the error might provide more specific info
    }
    
    // Try converting addresses to ensure proper format (no BigNumber issues)
    const cleanMissionAddress = missionAddress?.toString() || missionAddress;
    const cleanCharacterAddress = characterAddress?.toString() || characterAddress;
    const cleanAuthority = wallet.publicKey.toString();
    
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
        userId: userId,
      },
    };
    
    console.log('🔍 ===== FINAL _BN DEBUG: EXACT GRAPHQL PARAMS =====');
    console.log('🔍 GraphQL parameters:', JSON.stringify(graphQLParams, null, 2));
    console.log('🔍 Access token length:', accessToken?.length);
    
    
    let txResponse;
    try {
      // Follow official test pattern from links.md lines 29-43
      const {
        createSendCharactersOnMissionTransaction: {
          blockhash,
          lastValidBlockHeight,
          transactions,
        },
      } = await this.client.createSendCharactersOnMissionTransaction(graphQLParams, {
        fetchOptions: {
          headers: { authorization: `Bearer ${accessToken}` },
        },
      });
    } catch (missionError: any) {
      console.error('❌ Mission error:', missionError);
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
    if (!userId) {
      throw new Error('User ID not found - profile required for mission recall');
    }
    
    // Follow official docs pattern from lines 32-42
    const recallParams: any = {
      data: {
        mission: missionAddress,
        characterAddresses: [
          characterAddress
        ],
        authority: wallet.publicKey.toString(),
        payer: wallet.publicKey.toString(), // Optional
        userId: userId, // Required for profile association
      },
    };

    // Add lookup table if provided
    if (lookupTableAddress) {
      recallParams.lutAddresses = [lookupTableAddress];
    }

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
        costAmount: "100000", // 0.1 SPEEDY tokens
        durationHours: 4,
        minXp: "0", // No minimum XP required
        xpReward: { min: "100", max: "200" },
        resourceReward: { min: "50000", max: "150000" }, // 0.05-0.15 SPEEDY tokens
      },
      {
        name: "Endurance Race",
        description: "Complete an 8-hour endurance mission for bigger rewards",
        costAmount: "200000", // 0.2 SPEEDY tokens
        durationHours: 8,
        minXp: "100", // Requires some XP
        xpReward: { min: "250", max: "400" },
        resourceReward: { min: "150000", max: "300000" }, // 0.15-0.3 SPEEDY tokens
      },
      {
        name: "Daily Sprint",
        description: "Quick 1-hour mission for fast rewards",
        costAmount: "50000", // 0.05 SPEEDY tokens
        durationHours: 1,
        minXp: "0", // No minimum XP required
        xpReward: { min: "25", max: "50" },
        resourceReward: { min: "25000", max: "75000" }, // 0.025-0.075 SPEEDY tokens
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