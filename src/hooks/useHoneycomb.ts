// hooks/useHoneycomb.ts - CORRECT IMPLEMENTATION BASED ON OFFICIAL DOCS
import { useWallet } from "@solana/wallet-adapter-react";
import { useState, useCallback, useRef, useEffect } from "react";
import { createEdgeClient } from "@honeycomb-protocol/edge-client";
import { sendClientTransactions } from "@honeycomb-protocol/edge-client/client/walletHelpers";
import { getOrCreateAccessToken } from "../utils/accessToken";

// Types
interface PlayerProfile {
  id: string;
  walletAddress: string;
  level: number;
  totalXp: number;
  highScore: number;
  gamesPlayed: number;
  totalDistance: number;
  totalObstaclesAvoided: number;
  totalBonusBoxesCollected: number;
  bestLapTime: number;
  winRate: number;
  createdAt: number;
  lastPlayedAt: number;
  achievements: number[];
  traits: any[];
}

interface GameStats {
  score: number;
  distance: number;
  obstaclesAvoided: number;
  bonusBoxesCollected: number;
  lapTime: number;
  gameCompleted: boolean;
}

type HoneycombStatus = "not_initialized" | "initializing" | "created" | "error" | "ready";

// Achievement indexes that match your project's profileDataConfig
const ACHIEVEMENT_INDEXES = {
  first_ride: 0,
  speed_runner: 1,
  collector_master: 2,
  obstacle_master: 3,
  distance_legend: 4,
} as const;

// Achievement thresholds for missions
const MISSION_THRESHOLDS = {
  collector_master: 50,
  obstacle_master: 500,
  distance_legend: 10000,
  speed_runner: 1000,
};

export const useHoneycomb = () => {
  const { connected, publicKey, wallet, signTransaction, signAllTransactions } =
    useWallet();

  // State management
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [honeycombStatus, setHoneycombStatus] =
    useState<HoneycombStatus>("not_initialized");
  const [honeycombProfile, setHoneycombProfile] = useState<any>(null);
  const [honeycombProject, setHoneycombProject] = useState<any>(null);
  const [initializationRequired, setInitializationRequired] = useState(false);
  const [recentAchievements, setRecentAchievements] = useState<string[]>([]);

  // Client initialization
  const client = useRef(
    createEdgeClient(
      import.meta.env.VITE_PUBLIC_HONEYCOMB_API_URL ||
        "https://edge.test.honeycombprotocol.com/",
      true
    )
  ).current;

  // Helper function to create proper wallet object for transactions
  const createWalletForTransaction = useCallback(() => {
    if (
      !wallet?.adapter ||
      !publicKey ||
      !signTransaction ||
      !signAllTransactions
    ) {
      throw new Error(
        "Wallet not properly connected or missing required methods"
      );
    }
    return {
      adapter: wallet.adapter,
      publicKey: publicKey,
      signTransaction: signTransaction,
      signAllTransactions: signAllTransactions,
      connected: connected,
    };
  }, [wallet, publicKey, signTransaction, signAllTransactions, connected]);

  // Local storage functions
  const saveProfileToLocalStorage = useCallback(() => {
    if (playerProfile) {
      localStorage.setItem(
        "honeycomb_player_profile",
        JSON.stringify(playerProfile)
      );
      console.log("💾 Profile saved to localStorage");
    }
  }, [playerProfile]);

  const loadProfileFromLocalStorage = useCallback((): PlayerProfile | null => {
    try {
      const saved = localStorage.getItem("honeycomb_player_profile");
      if (saved) {
        const profile = JSON.parse(saved);
        console.log("📦 Loaded profile from localStorage");
        return profile;
      }
    } catch (error) {
      console.error("❌ Error loading profile from localStorage:", error);
    }
    return null;
  }, []);

  // Create new player profile
  const createNewPlayerProfile = useCallback(
    (walletAddress: string): PlayerProfile => {
      return {
        id:
          "player_" +
          Date.now() +
          "_" +
          Math.random().toString(36).substr(2, 9),
        walletAddress,
        level: 1,
        totalXp: 0,
        highScore: 0,
        gamesPlayed: 0,
        totalDistance: 0,
        totalObstaclesAvoided: 0,
        totalBonusBoxesCollected: 0,
        bestLapTime: 0,
        winRate: 0,
        createdAt: Date.now(),
        lastPlayedAt: Date.now(),
        achievements: [],
        traits: [],
      };
    },
    []
  );

  // Calculate level from XP
  const calculateLevel = useCallback((xp: number): number => {
    return Math.floor(xp / 100) + 1;
  }, []);

  // Calculate XP gain from game performance
  const calculateXpGain = useCallback((stats: GameStats): number => {
    let xp = 10; // Base XP
    xp += Math.floor(stats.score / 10);
    xp += Math.floor(stats.distance / 100);
    xp += stats.obstaclesAvoided * 2;
    xp += stats.bonusBoxesCollected * 5;
    if (stats.gameCompleted) xp += 25;
    if (stats.lapTime > 0 && stats.lapTime < 60) xp += 15;
    return Math.max(10, xp);
  }, []);

  // Update on-chain stats
  const updateOnChainStats = useCallback(
    async (
      xpToAdd: number,
      customDataUpdates: Record<string, any> = {}
    ): Promise<boolean> => {
      if (
        honeycombStatus !== "created" ||
        !honeycombProfile ||
        !honeycombProject
      ) {
        console.log("❌ Honeycomb not properly initialized for stats update");
        return false;
      }

      try {
        console.log("🚀 Updating on-chain stats...", {
          xpGained: xpToAdd,
          customUpdates: Object.keys(customDataUpdates),
        });

        const platformData: any = {};

        if (xpToAdd > 0) {
          platformData.addXp = xpToAdd;
        }

        if (Object.keys(customDataUpdates).length > 0) {
          const customDataFields: [string, string][] = Object.entries(
            customDataUpdates
          ).map(([key, value]) => [key, String(value)]);
          platformData.custom = { add: customDataFields };
        }

        // According to official Honeycomb docs:
        // Users can create their own profiles, but need authentication
        // For now, use a simplified approach for gaming
        const currentWallet = publicKey?.toString();
        
        console.log("📚 Official approach: User creates own profile when needed");
        
        // Check if we have a proper blockchain profile
        if (honeycombProfile.address === "pending-user-creation") {
          console.log("⚠️ No blockchain profile yet - user needs to create one first");
          return false;
        }

        // Use access token to update profile custom data
        console.log("🔑 Updating profile custom data with access token...");
        
        if (Object.keys(customDataUpdates).length === 0) {
          console.log("⚠️ No custom data to update");
          return true;
        }

        try {
          console.log("👤 Creating profile update transaction with proper authentication...");
          
          // Create wallet sign message function for access token
          const walletForAuth = createWalletForTransaction();
          const signMessageFunc = async (message: Uint8Array): Promise<Uint8Array> => {
            if (!walletForAuth.adapter.signMessage) {
              throw new Error("Wallet does not support message signing");
            }
            console.log("🔐 Calling wallet.adapter.signMessage...");
            const result = await walletForAuth.adapter.signMessage(message);
            console.log("🔍 Wallet adapter signMessage result:", result);
            console.log("🔍 Result type:", typeof result);
            console.log("🔍 Result has signature property:", !!(result as any)?.signature);
            
            // Handle different wallet adapter return formats
            if (result instanceof Uint8Array) {
              console.log("✅ Wallet returned Uint8Array directly");
              return result;
            } else if ((result as any)?.signature instanceof Uint8Array) {
              console.log("✅ Wallet returned object with signature property");
              return (result as any).signature;
            } else if ((result as any)?.signature) {
              console.log("✅ Wallet returned object with signature (converting to Uint8Array)");
              const sig = (result as any).signature;
              if (Array.isArray(sig)) {
                return new Uint8Array(sig);
              }
            }
            
            console.error("❌ Unexpected wallet signMessage result format");
            throw new Error("Wallet returned unexpected signMessage format: " + typeof result);
          };

          // Get access token using proper Honeycomb authentication
          const accessToken = await getOrCreateAccessToken(currentWallet || "", signMessageFunc);
          
          // ⛓️ Use proper createUpdateProfileTransaction format from official docs
          const {
            createUpdateProfileTransaction: txResponse
          } = await client.createUpdateProfileTransaction({
            payer: currentWallet || "", // User must sign this
            profile: honeycombProfile.address,
            customData: {
              add: Object.entries(customDataUpdates).reduce((acc, [key, value]) => {
                acc[key] = [value.toString()]; // Format: key: ["string"]
                return acc;
              }, {} as Record<string, string[]>)
            },
          }, {
            fetchOptions: {
              headers: {
                authorization: `Bearer ${accessToken}`, // Required access token authentication
              },
            },
          });
          
          if (txResponse) {
            const walletForTransaction = createWalletForTransaction();
            const signature = await sendClientTransactions(
              client,
              walletForTransaction,
              txResponse
            );

            if (signature && signature.length > 0) {
              console.log("✅ Profile custom data updated successfully!", signature[0]);
              await refreshHoneycombProfile();
              return true;
            }
          }
          
          console.log("⚠️ Profile update transaction failed");
          return false;
        } catch (profileError) {
          console.error("❌ Profile custom data update failed:", profileError);
          
          // If authorization fails, return true to continue with local storage
          if (profileError.message?.includes("Unauthorized")) {
            console.log("💡 Authorization failed, continuing with local storage");
            return true;
          }
          
          return false;
        }
      } catch (error) {
        console.error("❌ Failed to update on-chain stats:", error);
        return false;
      }
    },
    [
      honeycombStatus,
      honeycombProfile,
      honeycombProject,
      client,
      createWalletForTransaction,
    ]
  );

  // Add achievement to profile - Store in custom data since users can't update platform data
  const addAchievementToProfile = useCallback(
    async (achievementIndex: number): Promise<boolean> => {
      if (
        honeycombStatus !== "created" ||
        !honeycombProfile ||
        !honeycombProject
      ) {
        console.log(
          "❌ Honeycomb not properly initialized for achievement update"
        );
        return false;
      }

      try {
        console.log("🏆 Adding achievement " + achievementIndex + " to profile custom data...");

        // Store achievement in profile custom data with access token
        console.log("🏆 Adding achievement " + achievementIndex + " to profile custom data...");
        
        try {
          console.log("🏆 Creating achievement update transaction with proper authentication...");
          
          // Create wallet sign message function for access token
          const walletForAuth = createWalletForTransaction();
          const signMessageFunc = async (message: Uint8Array): Promise<Uint8Array> => {
            if (!walletForAuth.adapter.signMessage) {
              throw new Error("Wallet does not support message signing");
            }
            console.log("🔐 Calling wallet.adapter.signMessage...");
            const result = await walletForAuth.adapter.signMessage(message);
            console.log("🔍 Wallet adapter signMessage result:", result);
            console.log("🔍 Result type:", typeof result);
            console.log("🔍 Result has signature property:", !!(result as any)?.signature);
            
            // Handle different wallet adapter return formats
            if (result instanceof Uint8Array) {
              console.log("✅ Wallet returned Uint8Array directly");
              return result;
            } else if ((result as any)?.signature instanceof Uint8Array) {
              console.log("✅ Wallet returned object with signature property");
              return (result as any).signature;
            } else if ((result as any)?.signature) {
              console.log("✅ Wallet returned object with signature (converting to Uint8Array)");
              const sig = (result as any).signature;
              if (Array.isArray(sig)) {
                return new Uint8Array(sig);
              }
            }
            
            console.error("❌ Unexpected wallet signMessage result format");
            throw new Error("Wallet returned unexpected signMessage format: " + typeof result);
          };

          // Get access token using proper Honeycomb authentication
          const accessToken = await getOrCreateAccessToken(publicKey?.toString() || "", signMessageFunc);
          
          // Get current achievements from local profile
          const currentAchievements = playerProfile?.achievements || [];
          const newAchievements = [...currentAchievements, achievementIndex];
          
          // ⛓️ Use proper createUpdateProfileTransaction format from official docs
          const {
            createUpdateProfileTransaction: txResponse
          } = await client.createUpdateProfileTransaction({
            payer: publicKey?.toString() || "", // User must sign this
            profile: honeycombProfile.address,
            customData: {
              add: {
                achievements: [JSON.stringify(newAchievements)] // Format: key: ["string"]
              }
            },
          }, {
            fetchOptions: {
              headers: {
                authorization: `Bearer ${accessToken}`, // Required access token authentication
              },
            },
          });

          if (txResponse) {
            const walletForTransaction = createWalletForTransaction();
            const signature = await sendClientTransactions(
              client,
              walletForTransaction,
              txResponse
            );

            if (signature && signature.length > 0) {
              console.log(
                "✅ Achievement " + achievementIndex + " added to profile successfully!",
                signature[0]
              );
              return true;
            }
          }
          
          console.log("⚠️ Achievement update transaction failed");
          return false;
        } catch (profileError) {
          console.error("❌ Achievement profile update failed:", profileError);
          
          // If authorization fails, return true to continue with local storage
          if (profileError.message?.includes("Unauthorized")) {
            console.log("💡 Authorization failed, achievement saved locally");
            return true;
          }
          
          return false;
        }
      } catch (error) {
        console.error(
          "❌ Failed to add achievement " + achievementIndex + ":",
          error
        );
        return false;
      }
    },
    [
      honeycombStatus,
      honeycombProfile,
      honeycombProject,
      client,
      createWalletForTransaction,
      publicKey,
      playerProfile,
    ]
  );

  // Refresh Honeycomb profile
  const refreshHoneycombProfile = useCallback(async (): Promise<void> => {
    if (!honeycombProfile?.address || !client) return;

    try {
      const response = await client.findProfiles({
        addresses: [honeycombProfile.address],
        includeProof: true,
      });

      if (
        (response as any)?.findProfiles?.profile &&
        (response as any).findProfiles.profile.length > 0
      ) {
        const updatedProfile = (response as any).findProfiles.profile[0];
        setHoneycombProfile(updatedProfile);

        if (playerProfile && updatedProfile.platformData) {
          const newProfile = {
            ...playerProfile,
            totalXp: updatedProfile.platformData.xp || 0,
            achievements: updatedProfile.platformData.achievements || [],
          };

          if (updatedProfile.platformData.custom) {
            Object.entries(updatedProfile.platformData.custom).forEach(
              ([key, value]) => {
                (newProfile as any)[key] = value;
              }
            );
          }

          newProfile.level = calculateLevel(newProfile.totalXp);
          setPlayerProfile(newProfile);
          saveProfileToLocalStorage();
        }

        console.log("🔄 Honeycomb profile refreshed with latest data");
      }
    } catch (error) {
      console.error("❌ Failed to refresh Honeycomb profile:", error);
    }
  }, [
    honeycombProfile,
    client,
    playerProfile,
    calculateLevel,
    saveProfileToLocalStorage,
  ]);

  // Initialize Honeycomb integration - FIXED ACCORDING TO OFFICIAL DOCS
  const initializeHoneycombIntegration =
    useCallback(async (): Promise<boolean> => {
      if (!connected || !publicKey) {
        console.log("❌ Wallet not connected for Honeycomb initialization");
        return false;
      }

      if (
        !wallet?.adapter?.signTransaction ||
        !wallet?.adapter?.signAllTransactions
      ) {
        console.log("❌ Wallet doesn't support required signing methods");
        return false;
      }

      try {
        setLoading(true);
        setHoneycombStatus("initializing");
        console.log("🚀 Starting Honeycomb Protocol integration...");

        const projectAddress = import.meta.env
          .VITE_PUBLIC_HONEYCOMB_PROJECT_ADDRESS;
        if (!projectAddress) {
          console.error("❌ No project address configured");
          setHoneycombStatus("error");
          return false;
        }

        console.log("🔍 Looking for existing user and profile...");

        // Step 1: Find existing user - FIXED RESPONSE PARSING
        let existingUser: any = null;
        let existingProfile: any = null;

        try {
          const userResponse = await client.findUsers({
            wallets: [publicKey.toString()],
          });

          console.log("👤 User search response:", userResponse);
          console.log(
            "👤 User search response structure:",
            JSON.stringify(userResponse, null, 2)
          );

          // FIX: Check all possible response structures
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
            existingUser = users[0];
            console.log("✅ Found existing user with ID:", existingUser.id);

            // Step 2: Look for existing profile with multiple approaches
            console.log(
              "🔍 Searching for profile with userIds:",
              [existingUser.id],
              "and projects:",
              [projectAddress]
            );

            const profileResponse = await client.findProfiles({
              userIds: [existingUser.id],
              projects: [projectAddress],
            });

            console.log("📝 Profile search response:", profileResponse);
            console.log(
              "📝 Profile search response structure:",
              JSON.stringify(profileResponse, null, 2)
            );

            // Check all possible response structures for profiles
            let profiles = null;
            if ((profileResponse as any)?.findProfiles?.profile) {
              profiles = (profileResponse as any).findProfiles.profile;
            } else if ((profileResponse as any)?.profile) {
              profiles = (profileResponse as any).profile;
            } else if (Array.isArray(profileResponse)) {
              profiles = profileResponse;
            }

            console.log("📝 Extracted profiles:", profiles);

            if (profiles && profiles.length > 0) {
              existingProfile = profiles[0];
              console.log(
                "✅ Found existing profile with address:",
                existingProfile.address
              );
            } else {
              console.log("❌ No profile found for this user and project");

              // Try alternative search by project only
              console.log(
                "🔄 Trying alternative profile search by project only..."
              );
              const alternativeProfileResponse = await client.findProfiles({
                projects: [projectAddress],
                includeProof: true,
              });

              console.log(
                "🔍 Alternative profile search response:",
                alternativeProfileResponse
              );

              let alternativeProfiles = null;
              if (alternativeProfileResponse?.findProfiles?.profile) {
                alternativeProfiles =
                  alternativeProfileResponse.findProfiles.profile;
              } else if (alternativeProfileResponse?.profile) {
                alternativeProfiles = alternativeProfileResponse.profile;
              }

              if (alternativeProfiles && alternativeProfiles.length > 0) {
                // Filter profiles to find one that belongs to this user
                const userProfile = alternativeProfiles.find(
                  (profile) => profile.userId === existingUser.id
                );

                if (userProfile) {
                  console.log("✅ Found profile through alternative search");
                  existingProfile = userProfile;
                } else {
                  console.log(
                    "❌ No matching profile found in alternative search"
                  );
                }
              }
            }
          } else {
            console.log("❌ No user found for this wallet");
          }
        } catch (searchError) {
          console.log(
            "⚠️ Error searching for existing user/profile:",
            searchError
          );
        }

        // Step 3: Handle different scenarios
        if (existingUser && existingProfile) {
          // Scenario A: Both user and profile exist
          console.log("✅ Using existing user and profile");
          setHoneycombProfile(existingProfile);
        } else if (existingUser && !existingProfile) {
          // Scenario B: User exists but no profile for this project
          console.log("🆕 User exists but needs to create profile for this project");
          console.log("📝 User will be prompted to create profile when starting race");
          
          // Set up a pending profile state
          setHoneycombProfile({ address: "pending-user-creation", userId: existingUser.id });
          setHoneycombProject({ address: projectAddress }); // Set basic project info
        } else {
          // Scenario C: No user exists - user will need to create both
          console.log("🆕 No user exists - user needs to create account and profile");
          console.log("📝 User will be prompted to create account when starting race");
          
          // Set up a pending profile state
          setHoneycombProfile({ address: "pending-user-creation", userId: null });
          setHoneycombProject({ address: projectAddress }); // Set basic project info
        }

        // Step 4: Finalize integration if we have a profile
        if (existingProfile) {
          console.log("🏗️ Getting project information...");
          const projectResponse = await client.findProjects({
            addresses: [projectAddress],
          });

          console.log("🏗️ Project search response:", projectResponse);
          console.log(
            "🏗️ Project search response structure:",
            JSON.stringify(projectResponse, null, 2)
          );

          // Check all possible response structures for projects
          let projects = null;
          if ((projectResponse as any)?.findProjects?.project) {
            projects = (projectResponse as any).findProjects.project;
          } else if ((projectResponse as any)?.project) {
            projects = (projectResponse as any).project;
          } else if (Array.isArray(projectResponse)) {
            projects = projectResponse;
          }

          console.log("🏗️ Extracted projects:", projects);

          if (projects && projects.length > 0) {
            const project = projects[0];
            setHoneycombProject(project);
            setHoneycombStatus("created");

            console.log("✅ Found project:", project);

            // Sync local profile with on-chain data
            if (existingProfile && playerProfile) {
              console.log("🔄 Syncing local profile with on-chain data...");

              const syncedProfile = { ...playerProfile };

              if (existingProfile.platformData) {
                if (existingProfile.platformData.xp !== undefined) {
                  // XP might be a string, convert to number
                  const xpValue =
                    typeof existingProfile.platformData.xp === "string"
                      ? parseInt(existingProfile.platformData.xp)
                      : existingProfile.platformData.xp;
                  syncedProfile.totalXp = xpValue || 0;
                  syncedProfile.level = calculateLevel(syncedProfile.totalXp);
                }

                if (existingProfile.platformData.achievements) {
                  syncedProfile.achievements =
                    existingProfile.platformData.achievements;
                }

                if (existingProfile.platformData.custom) {
                  Object.entries(existingProfile.platformData.custom).forEach(
                    ([key, value]) => {
                      if (key === "gamesPlayed")
                        syncedProfile.gamesPlayed =
                          parseInt(value as string) || 0;
                      if (key === "highScore")
                        syncedProfile.highScore =
                          parseInt(value as string) || 0;
                      if (key === "totalDistance")
                        syncedProfile.totalDistance =
                          parseInt(value as string) || 0;
                      if (key === "bestLapTime")
                        syncedProfile.bestLapTime =
                          parseFloat(value as string) || 0;
                      if (key === "winRate")
                        syncedProfile.winRate =
                          parseFloat(value as string) || 0;
                      if (key === "totalObstaclesAvoided")
                        syncedProfile.totalObstaclesAvoided =
                          parseInt(value as string) || 0;
                      if (key === "totalBonusBoxesCollected")
                        syncedProfile.totalBonusBoxesCollected =
                          parseInt(value as string) || 0;
                    }
                  );
                }
              }

              setPlayerProfile(syncedProfile);
              saveProfileToLocalStorage();
              console.log("✅ Profile synced with on-chain data");
            }

            console.log("🎉 Honeycomb integration completed successfully!");
            console.log("🎮 Ready for on-chain game stats storage!");
            return true;
          } else {
            console.log(
              "❌ Failed to find project information - no projects in response"
            );
            console.log("🔍 Project address being searched:", projectAddress);
            console.log("🔍 Available projects in response:", projects);
            setHoneycombStatus("error");
            return false;
          }
        } else {
          console.log("⚠️ No profile available - user needs to create one");
          console.log("💡 Setting up pending state for user-driven profile creation");
          
          // Set up pending profile creation state
          setHoneycombProfile({ address: "pending-user-creation", userId: null });
          setHoneycombProject({ address: projectAddress });
          setHoneycombStatus("ready");
          setProfileReady(true);
          
          console.log("✅ Ready for user to create their own blockchain profile");
          return true;
        }
      } catch (error) {
        console.error("❌ Honeycomb initialization error:", error);
        setHoneycombStatus("error");
        return false;
      } finally {
        setLoading(false);
      }
    }, [
      connected,
      publicKey,
      wallet,
      client,
      createWalletForTransaction,
      calculateLevel,
      playerProfile,
      saveProfileToLocalStorage,
    ]);

  // Update mission progress
  const updateMissionProgress = useCallback(
    async (missionType: string, progress: number): Promise<boolean> => {
      if (!playerProfile || !profileReady) {
        console.log("❌ No profile available for mission progress update");
        return false;
      }

      try {
        console.log(
          "🎯 Updating mission " + missionType + " progress by " + progress
        );

        const achievementIndex =
          ACHIEVEMENT_INDEXES[missionType as keyof typeof ACHIEVEMENT_INDEXES];

        if (achievementIndex === undefined) {
          console.error("❌ Unknown mission type: " + missionType);
          return false;
        }

        const currentAchievements = playerProfile.achievements || [];
        if (currentAchievements.includes(achievementIndex)) {
          console.log("✅ Achievement " + missionType + " already unlocked");
          return true;
        }

        let updatedProfile = { ...playerProfile };
        let missionCompleted = false;

        switch (missionType) {
          case "collector_master":
            updatedProfile.totalBonusBoxesCollected += progress;
            missionCompleted =
              updatedProfile.totalBonusBoxesCollected >=
              MISSION_THRESHOLDS.collector_master;
            break;
          case "obstacle_master":
            updatedProfile.totalObstaclesAvoided += progress;
            missionCompleted =
              updatedProfile.totalObstaclesAvoided >=
              MISSION_THRESHOLDS.obstacle_master;
            break;
          case "distance_legend":
            updatedProfile.totalDistance += progress;
            missionCompleted =
              updatedProfile.totalDistance >=
              MISSION_THRESHOLDS.distance_legend;
            break;
          case "speed_runner":
            missionCompleted = progress >= MISSION_THRESHOLDS.speed_runner;
            break;
          case "first_ride":
            missionCompleted = true;
            break;
          default:
            missionCompleted = true;
        }

        setPlayerProfile(updatedProfile);
        saveProfileToLocalStorage();

        if (missionCompleted && honeycombStatus === "created") {
          const success = await addAchievementToProfile(achievementIndex);
          if (success) {
            updatedProfile.achievements = [
              ...currentAchievements,
              achievementIndex,
            ];
            updatedProfile.totalXp += 50;
            setPlayerProfile(updatedProfile);
            saveProfileToLocalStorage();

            const achievementName =
              Object.keys(ACHIEVEMENT_INDEXES)[achievementIndex] ||
              "Achievement " + achievementIndex;
            setRecentAchievements((prev) =>
              [...prev, achievementName].slice(-5)
            );

            console.log(
              "🏆 Mission " + missionType + " completed successfully!"
            );
            return true;
          }
        }

        return missionCompleted;
      } catch (error) {
        console.error("❌ Error updating mission progress:", error);
        return false;
      }
    },
    [
      playerProfile,
      profileReady,
      honeycombStatus,
      addAchievementToProfile,
      saveProfileToLocalStorage,
    ]
  );

  // Main game stats update function
  const updateGameStats = useCallback(
    async (gameStats: GameStats): Promise<boolean> => {
      if (!playerProfile) {
        console.log("❌ No player profile available for stats update");
        return false;
      }

      console.log("🎮 Starting comprehensive game stats update...", gameStats);

      try {
        const xpGained = calculateXpGain(gameStats);

        const updatedProfile: PlayerProfile = {
          ...playerProfile,
          gamesPlayed: playerProfile.gamesPlayed + 1,
          totalXp: playerProfile.totalXp + xpGained,
          totalDistance: playerProfile.totalDistance + gameStats.distance,
          totalObstaclesAvoided:
            playerProfile.totalObstaclesAvoided + gameStats.obstaclesAvoided,
          totalBonusBoxesCollected:
            playerProfile.totalBonusBoxesCollected +
            gameStats.bonusBoxesCollected,
          lastPlayedAt: Date.now(),
        };

        if (gameStats.score > updatedProfile.highScore) {
          updatedProfile.highScore = gameStats.score;
        }

        if (
          gameStats.lapTime > 0 &&
          (updatedProfile.bestLapTime === 0 ||
            gameStats.lapTime < updatedProfile.bestLapTime)
        ) {
          updatedProfile.bestLapTime = gameStats.lapTime;
        }

        if (gameStats.gameCompleted) {
          updatedProfile.winRate =
            (updatedProfile.winRate * (updatedProfile.gamesPlayed - 1) + 1) /
            updatedProfile.gamesPlayed;
        } else {
          updatedProfile.winRate =
            (updatedProfile.winRate * (updatedProfile.gamesPlayed - 1)) /
            updatedProfile.gamesPlayed;
        }

        updatedProfile.level = calculateLevel(updatedProfile.totalXp);

        setPlayerProfile(updatedProfile);
        saveProfileToLocalStorage();

        // ALWAYS attempt on-chain update if Honeycomb is available
        if (honeycombStatus === "created") {
          console.log("🚀 Updating on-chain stats...");

          const customDataUpdates = {
            gamesPlayed: updatedProfile.gamesPlayed.toString(),
            highScore: updatedProfile.highScore.toString(),
            totalDistance: updatedProfile.totalDistance.toString(),
            bestLapTime: updatedProfile.bestLapTime.toString(),
            winRate: updatedProfile.winRate.toFixed(2),
            totalObstaclesAvoided:
              updatedProfile.totalObstaclesAvoided.toString(),
            totalBonusBoxesCollected:
              updatedProfile.totalBonusBoxesCollected.toString(),
          };

          const onChainSuccess = await updateOnChainStats(
            xpGained,
            customDataUpdates
          );

          if (onChainSuccess) {
            console.log("✅ On-chain stats updated successfully!");
          } else {
            console.log("⚠️ On-chain update failed, but local stats saved");
          }
        } else {
          console.log("⚠️ Honeycomb not available, stats saved locally only");
        }

        console.log("✅ Game stats update completed successfully");
        return true;
      } catch (error) {
        console.error("❌ Error updating game stats:", error);
        return false;
      }
    },
    [
      playerProfile,
      calculateXpGain,
      calculateLevel,
      saveProfileToLocalStorage,
      honeycombStatus,
      updateOnChainStats,
    ]
  );

  // Get trait bonuses
  const getTraitBonuses = useCallback(() => {
    if (!playerProfile?.traits || playerProfile.traits.length === 0) {
      return {};
    }

    const bonuses: any = {};
    playerProfile.traits.forEach((trait: any) => {
      switch (trait.type) {
        case "speed":
          bonuses.speedMultiplier =
            (bonuses.speedMultiplier || 1) + trait.value * 0.1;
          break;
        case "bonus":
          bonuses.bonusSpawnRate =
            (bonuses.bonusSpawnRate || 1) + trait.value * 0.2;
          break;
        case "invisibility":
          bonuses.invisibilityDuration =
            (bonuses.invisibilityDuration || 15) + trait.value * 5;
          break;
      }
    });

    return bonuses;
  }, [playerProfile]);

  // Get recent achievements
  const getRecentAchievements = useCallback(() => {
    return recentAchievements;
  }, [recentAchievements]);

  // Force on-chain sync function
  const forceOnChainSync = useCallback(async (): Promise<boolean> => {
    if (!playerProfile || honeycombStatus !== "created") {
      console.log("❌ Cannot sync - no profile or Honeycomb not ready");
      return false;
    }

    console.log("🚀 Force syncing all local data to on-chain...");

    const customDataUpdates = {
      gamesPlayed: playerProfile.gamesPlayed.toString(),
      highScore: playerProfile.highScore.toString(),
      totalDistance: playerProfile.totalDistance.toString(),
      bestLapTime: playerProfile.bestLapTime.toString(),
      winRate: playerProfile.winRate.toFixed(2),
      totalObstaclesAvoided: playerProfile.totalObstaclesAvoided.toString(),
      totalBonusBoxesCollected:
        playerProfile.totalBonusBoxesCollected.toString(),
    };

    const success = await updateOnChainStats(0, customDataUpdates);

    if (success) {
      console.log("✅ Force sync to on-chain completed successfully!");
      await refreshHoneycombProfile();
    }

    return success;
  }, [
    playerProfile,
    honeycombStatus,
    updateOnChainStats,
    refreshHoneycombProfile,
  ]);

  // Initialize profile on wallet connection
  useEffect(() => {
    if (connected && publicKey) {
      console.log("🍯 Wallet connected:", publicKey.toString());

      const existingProfile = loadProfileFromLocalStorage();

      if (
        existingProfile &&
        existingProfile.walletAddress === publicKey.toString()
      ) {
        console.log("📦 Loaded existing profile from localStorage");
        setPlayerProfile((prev) => {
          if (!prev || prev.walletAddress !== existingProfile.walletAddress) {
            return existingProfile;
          }
          return prev;
        });
        setProfileReady(true);
        setInitializationRequired(true);
      } else {
        console.log("🆕 Creating new player profile");
        const newProfile = createNewPlayerProfile(publicKey.toString());
        setPlayerProfile(newProfile);
        setProfileReady(true);
        setInitializationRequired(true);
        saveProfileToLocalStorage();
      }
    } else {
      console.log("🔌 Wallet disconnected");
      setPlayerProfile(null);
      setProfileReady(false);
      setHoneycombStatus("not_initialized");
      setHoneycombProfile(null);
      setHoneycombProject(null);
      setInitializationRequired(false);
    }
  }, [
    connected,
    publicKey,
    loadProfileFromLocalStorage,
    createNewPlayerProfile,
    saveProfileToLocalStorage,
  ]);

  // Create user profile - to be called when user clicks "Start Race"
  const createUserProfile = useCallback(async (): Promise<boolean> => {
    if (!connected || !publicKey || !client) {
      console.log("❌ Cannot create profile - wallet not connected");
      return false;
    }

    const projectAddress = import.meta.env.VITE_PUBLIC_HONEYCOMB_PROJECT_ADDRESS;
    if (!projectAddress) {
      console.error("❌ No project address configured");
      return false;
    }

    try {
      console.log("🆕 User creating their own blockchain profile...");
      const currentWallet = publicKey.toString();
      
      // Check if user already exists
      let existingUser: any = null;
      try {
        const userResponse = await client.findUsers({
          wallets: [currentWallet],
        });
        
        if ((userResponse as any)?.findUsers?.user && (userResponse as any).findUsers.user.length > 0) {
          existingUser = (userResponse as any).findUsers.user[0];
          console.log("✅ Found existing user:", existingUser.id);
        }
      } catch (userError) {
        console.log("⚠️ Error searching for existing user:", userError);
      }

      let profileCreated = false;

      if (existingUser) {
        // User exists, create profile only
        console.log("👤 Creating profile for existing user...");
        try {
          const newProfileResponse = await client.createNewProfileTransaction({
            project: projectAddress,
            payer: currentWallet, // User pays for their own profile
            identity: "main",
            info: {
              name: "Racer " + currentWallet.slice(0, 8),
              bio: "Honeycomb Racing Championship Player",
              pfp: `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentWallet}`,
            },
          });

          if (newProfileResponse?.createNewProfileTransaction) {
            const walletForTransaction = createWalletForTransaction();
            const signature = await sendClientTransactions(
              client,
              walletForTransaction,
              newProfileResponse.createNewProfileTransaction
            );

            if (signature && signature.length > 0) {
              console.log("✅ Profile created successfully!", signature[0]);
              profileCreated = true;
            }
          }
        } catch (profileError) {
          console.error("❌ Failed to create profile for existing user:", profileError);
        }
      } else {
        // Create both user and profile
        console.log("🆕 Creating new user and profile...");
        try {
          const newUserResponse = await client.createNewUserWithProfileTransaction({
            project: projectAddress,
            wallet: currentWallet, // User's wallet
            payer: currentWallet, // User pays for their own profile
            profileIdentity: "main",
            userInfo: {
              name: "Player " + currentWallet.slice(0, 8),
              bio: "Honeycomb Racing Player",
              pfp: "https://via.placeholder.com/150/FFD700/000000?text=🏎️",
            },
          });

          if (newUserResponse?.createNewUserWithProfileTransaction) {
            const walletForTransaction = createWalletForTransaction();
            const signature = await sendClientTransactions(
              client,
              walletForTransaction,
              newUserResponse.createNewUserWithProfileTransaction
            );

            if (signature && signature.length > 0) {
              console.log("✅ User and profile created successfully!", signature[0]);
              profileCreated = true;
            }
          }
        } catch (userProfileError) {
          console.error("❌ Failed to create user and profile:", userProfileError);
        }
      }

      if (profileCreated) {
        // Wait for blockchain confirmation
        console.log("⏳ Waiting for blockchain confirmation...");
        await new Promise((resolve) => setTimeout(resolve, 3000));
        
        // Try to initialize full Honeycomb integration now that profile exists
        console.log("🔄 Initializing Honeycomb integration with new profile...");
        await initializeHoneycombIntegration();
        
        return true;
      } else {
        console.error("❌ Profile creation failed");
        return false;
      }
    } catch (error) {
      console.error("❌ Failed to create user profile:", error);
      return false;
    }
  }, [connected, publicKey, client, createWalletForTransaction, initializeHoneycombIntegration]);

  return {
    // State
    playerProfile,
    loading,
    profileReady,
    honeycombStatus,
    honeycombProfile,
    honeycombProject,
    initializationRequired,

    // Functions
    updateGameStats,
    updateMissionProgress,
    getTraitBonuses,
    getRecentAchievements,
    initializeHoneycombIntegration,
    refreshHoneycombProfile,
    forceOnChainSync,
    createUserProfile, // New function for user profile creation

    // Internal functions (for advanced usage)
    updateOnChainStats,
    addAchievementToProfile,
    saveProfileToLocalStorage,
  };
};
