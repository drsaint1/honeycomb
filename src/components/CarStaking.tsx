import React, { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { createEdgeClient } from "@honeycomb-protocol/edge-client";
import { nftCarService } from "../services/nftCarService";
import type { NFTCar } from "../services/nftCarService";

interface StakingCar extends NFTCar {
  stakingStartTime?: Date;
  estimatedRewards?: number;
  stakingHours?: number;
}

interface StakingPool {
  address: string;
  name: string;
  rewardsPerHour: {
    common: number;
    uncommon: number;
    rare: number;
    epic: number;
    legendary: number;
  };
  totalStaked: number;
  totalRewardsPaid: number;
  minStakeDuration: number; // hours
  maxStakeDuration: number; // hours
}

// Sample data will be replaced with real NFT cars from the service

const STAKING_POOL: StakingPool = {
  address: "StakePool123...",
  name: "Car Staking Pool",
  rewardsPerHour: {
    common: 25,
    uncommon: 50,
    rare: 100,
    epic: 200,
    legendary: 500,
  },
  totalStaked: 1247,
  totalRewardsPaid: 2500000,
  minStakeDuration: 1, // 1 hour minimum
  maxStakeDuration: 720, // 30 days maximum
};

export const CarStaking: React.FC = () => {
  const { connected, publicKey, wallet, signTransaction, signAllTransactions } =
    useWallet();
  const [cars, setCars] = useState<StakingCar[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalRewardsEarned, setTotalRewardsEarned] = useState(15000);

  const projectAddress = import.meta.env.VITE_PUBLIC_HONEYCOMB_PROJECT_ADDRESS;

  useEffect(() => {
    if (connected && publicKey) {
      loadUserCars();
    }

    const interval = setInterval(() => {
      updateStakingRewards();
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [connected, publicKey]);

  const loadUserCars = async () => {
    if (!publicKey) return;

    setLoading(true);
    try {
      const userCars = await nftCarService.getUserCars(publicKey.toString());
      const stakingCars: StakingCar[] = userCars.map((car) => ({
        ...car,
        // Convert traits to match the UI expectations
        traits: {
          ...car.traits,
          // Convert 1-10 scale to percentage for display
          speed: car.traits.speed * 10,
          acceleration: car.traits.acceleration * 10,
          handling: car.traits.handling * 10,
        },
      }));
      setCars(stakingCars);
    } catch (error) {
      console.error("Failed to load user cars:", error);
      setError("Failed to load your NFT cars");
    } finally {
      setLoading(false);
    }
  };

  const updateStakingRewards = () => {
    setCars((prevCars) =>
      prevCars.map((car) => {
        if (car.isStaked && car.stakingStartTime) {
          const now = new Date();
          const hoursStaked =
            (now.getTime() - car.stakingStartTime.getTime()) / (1000 * 60 * 60);
          const rewardRate = STAKING_POOL.rewardsPerHour[car.traits.rarity as keyof typeof STAKING_POOL.rewardsPerHour] || 
                           STAKING_POOL.rewardsPerHour.common;
          const estimatedRewards = Math.floor(hoursStaked * rewardRate);

          return {
            ...car,
            stakingHours: hoursStaked,
            estimatedRewards: estimatedRewards,
          };
        }
        return car;
      })
    );
  };

  const stakeCar = async (carMint: string) => {
    if (!connected || !publicKey || !projectAddress) {
      setError("Please connect wallet and ensure project is set up");
      return;
    }

    const car = cars.find((c) => c.mintAddress === carMint);
    if (!car || car.isStaked) return;

    setLoading(true);
    setError(null);

    try {
      console.log('🎯 Starting NFT car staking process...');
      
      // Create proper wallet object for Honeycomb
      const walletForStaking = {
        publicKey,
        signMessage: wallet?.adapter?.signMessage,
        signTransaction,
        signAllTransactions,
        adapter: wallet?.adapter
      };

      // Validate wallet has required methods
      if (!walletForStaking.signTransaction) {
        throw new Error('Wallet must support transaction signing to stake NFT cars');
      }

      console.log('🏊 Staking NFT car:', car.name, 'Address:', carMint);

      // Use the real Honeycomb staking service
      const result = await nftCarService.stakeCar(
        walletForStaking,
        carMint,
        import.meta.env.VITE_DEFAULT_STAKING_POOL // Use env var for staking pool
      );

      if (result.success) {
        console.log('✅ NFT car staked successfully on blockchain');

        // Update local state to reflect staking
        setCars((prevCars) =>
          prevCars.map((c) =>
            c.mintAddress === carMint
              ? {
                  ...c,
                  isStaked: true,
                  stakingStartTime: new Date(),
                  stakingHours: 0,
                  estimatedRewards: 0,
                }
              : c
          )
        );

        // Store staking info in localStorage
        const stakingRecord = {
          carMintAddress: carMint,
          stakingStartTime: new Date().toISOString(),
          stakingPool: import.meta.env.VITE_DEFAULT_STAKING_POOL,
          rewardRate: STAKING_POOL.rewardsPerHour[car.traits.rarity as keyof typeof STAKING_POOL.rewardsPerHour] || 
                     STAKING_POOL.rewardsPerHour.common
        };
        
        const existingStakes = JSON.parse(localStorage.getItem(`staking_records_${publicKey.toString()}`) || '[]');
        const updatedStakes = [...existingStakes, stakingRecord];
        localStorage.setItem(`staking_records_${publicKey.toString()}`, JSON.stringify(updatedStakes));

        alert(
          `🎯 ${car.name} staked successfully on blockchain! You'll earn ${
            STAKING_POOL.rewardsPerHour[car.traits.rarity as keyof typeof STAKING_POOL.rewardsPerHour] || 
            STAKING_POOL.rewardsPerHour.common
          } SPEEDY tokens per hour.`
        );
      } else {
        throw new Error(result.error || 'Staking transaction failed');
      }
    } catch (error: any) {
      console.error("❌ NFT car staking failed:", error);
      
      // Provide specific error messages
      let errorMessage = error.message;
      
      if (error.message.includes('insufficient funds')) {
        errorMessage = 'Insufficient SOL for transaction fees. Please add SOL to your wallet.';
      } else if (error.message.includes('user rejected')) {
        errorMessage = 'Transaction was cancelled by user.';
      } else if (error.message.includes('staking pool')) {
        errorMessage = 'Staking pool not available. Please contact the administrator.';
      } else if (error.message.includes('already staked')) {
        errorMessage = 'This car is already staked.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const unstakeCar = async (carMint: string) => {
    if (!connected || !publicKey) return;

    const car = cars.find((c) => c.mintAddress === carMint);
    if (!car || !car.isStaked || !car.stakingStartTime) return;

    const hoursStaked =
      (new Date().getTime() - car.stakingStartTime.getTime()) /
      (1000 * 60 * 60);

    if (hoursStaked < STAKING_POOL.minStakeDuration) {
      setError(
        `Car must be staked for at least ${
          STAKING_POOL.minStakeDuration
        } hour(s). Currently staked: ${hoursStaked.toFixed(2)} hours`
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔓 Starting NFT car unstaking process...');
      
      // Create proper wallet object for Honeycomb
      const walletForUnstaking = {
        publicKey,
        signMessage: wallet?.adapter?.signMessage,
        signTransaction,
        signAllTransactions,
        adapter: wallet?.adapter
      };

      console.log('🔓 Unstaking NFT car:', car.name, 'Address:', carMint);

      // Use the real Honeycomb unstaking service
      const result = await nftCarService.unstakeCar(
        walletForUnstaking,
        carMint,
        import.meta.env.VITE_DEFAULT_STAKING_POOL
      );

      if (result.success) {
        console.log('✅ NFT car unstaked successfully from blockchain');

        // Calculate rewards based on local tracking
        const rewardRate = STAKING_POOL.rewardsPerHour[car.traits.rarity as keyof typeof STAKING_POOL.rewardsPerHour] || 
                          STAKING_POOL.rewardsPerHour.common;
        const rewards = Math.floor(hoursStaked * rewardRate);

        // Update local state
        setCars((prevCars) =>
          prevCars.map((c) =>
            c.mintAddress === carMint
              ? {
                  ...c,
                  isStaked: false,
                  stakingStartTime: undefined,
                  stakingHours: undefined,
                  estimatedRewards: undefined,
                }
              : c
          )
        );

        // Update total rewards earned
        setTotalRewardsEarned((prev) => prev + rewards);

        // Remove from localStorage staking records
        const existingStakes = JSON.parse(localStorage.getItem(`staking_records_${publicKey.toString()}`) || '[]');
        const updatedStakes = existingStakes.filter((stake: any) => stake.carMintAddress !== carMint);
        localStorage.setItem(`staking_records_${publicKey.toString()}`, JSON.stringify(updatedStakes));

        alert(
          `🎉 ${
            car.name
          } unstaked successfully from blockchain!\n\nStaked for: ${hoursStaked.toFixed(
            2
          )} hours\nRewards earned: ${rewards.toLocaleString()} SPEEDY tokens`
        );
      } else {
        throw new Error(result.error || 'Unstaking transaction failed');
      }
    } catch (error: any) {
      console.error("❌ NFT car unstaking failed:", error);
      
      // Provide specific error messages
      let errorMessage = error.message;
      
      if (error.message.includes('insufficient funds')) {
        errorMessage = 'Insufficient SOL for transaction fees. Please add SOL to your wallet.';
      } else if (error.message.includes('user rejected')) {
        errorMessage = 'Transaction was cancelled by user.';
      } else if (error.message.includes('not staked')) {
        errorMessage = 'This car is not currently staked.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const claimRewards = async (carMint: string) => {
    const car = cars.find((c) => c.mintAddress === carMint);
    if (!car || !car.isStaked || !car.estimatedRewards) return;

    setLoading(true);
    try {
      console.log('💰 Starting NFT car reward claiming process...');
      
      // Create proper wallet object for Honeycomb
      const walletForClaiming = {
        publicKey,
        signMessage: wallet?.adapter?.signMessage,
        signTransaction,
        signAllTransactions,
        adapter: wallet?.adapter
      };

      console.log('💰 Claiming rewards for NFT car:', car.name, 'Address:', carMint);

      // Use the real Honeycomb reward claiming service
      const result = await nftCarService.claimStakingRewards(
        walletForClaiming,
        [carMint], // Array of car mint addresses
        import.meta.env.VITE_DEFAULT_STAKING_POOL
      );

      if (result.success) {
        console.log('✅ Rewards claimed successfully from blockchain');

        const rewards = car.estimatedRewards;
        setTotalRewardsEarned((prev) => prev + rewards);

        // Reset staking start time to now (rewards claimed)
        setCars((prevCars) =>
          prevCars.map((c) =>
            c.mintAddress === carMint
              ? {
                  ...c,
                  stakingStartTime: new Date(),
                  stakingHours: 0,
                  estimatedRewards: 0,
                }
              : c
          )
        );

        // Update localStorage staking record
        if (publicKey) {
          const existingStakes = JSON.parse(localStorage.getItem(`staking_records_${publicKey.toString()}`) || '[]');
          const updatedStakes = existingStakes.map((stake: any) => 
            stake.carMintAddress === carMint 
              ? { ...stake, stakingStartTime: new Date().toISOString(), lastClaimTime: new Date().toISOString() }
              : stake
          );
          localStorage.setItem(`staking_records_${publicKey.toString()}`, JSON.stringify(updatedStakes));
        }

        alert(
          `💰 Claimed ${rewards.toLocaleString()} SPEEDY tokens from ${car.name} on blockchain!`
        );
      } else {
        throw new Error(result.error || 'Reward claiming failed');
      }
    } catch (error: any) {
      console.error("❌ NFT car reward claiming failed:", error);
      
      // Provide specific error messages
      let errorMessage = error.message;
      
      if (error.message.includes('insufficient funds')) {
        errorMessage = 'Insufficient SOL for transaction fees. Please add SOL to your wallet.';
      } else if (error.message.includes('user rejected')) {
        errorMessage = 'Transaction was cancelled by user.';
      } else if (error.message.includes('no rewards')) {
        errorMessage = 'No rewards available to claim at this time.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity?.toLowerCase()) {
      case "common":
        return "#6c757d";
      case "uncommon":
        return "#28a745";
      case "rare":
        return "#007bff";
      case "epic":
        return "#6610f2";
      case "legendary":
        return "#fd7e14";
      default:
        return "#6c757d";
    }
  };

  const getRarityGlow = (rarity: string) => {
    switch (rarity?.toLowerCase()) {
      case "common":
        return "0 0 10px rgba(108, 117, 125, 0.3)";
      case "uncommon":
        return "0 0 12px rgba(40, 167, 69, 0.4)";
      case "rare":
        return "0 0 15px rgba(0, 123, 255, 0.4)";
      case "epic":
        return "0 0 20px rgba(102, 16, 242, 0.5)";
      case "legendary":
        return "0 0 25px rgba(253, 126, 20, 0.6)";
      default:
        return "none";
    }
  };

  const stakedCars = cars.filter((c) => c.isStaked);
  const availableCars = cars.filter((c) => !c.isStaked);
  const totalActiveRewards = stakedCars.reduce(
    (sum, car) => sum + (car.estimatedRewards || 0),
    0
  );

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <h2>🎯 NFT Car Staking</h2>

      {/* Staking Overview */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "15px",
          marginBottom: "30px",
        }}
      >
        <div
          style={{
            background: "#e7f3ff",
            padding: "15px",
            borderRadius: "8px",
            textAlign: "center",
          }}
        >
          <h3 style={{ margin: "0 0 5px 0", color: "#0066cc" }}>Cars Staked</h3>
          <p style={{ margin: 0, fontSize: "24px", fontWeight: "bold" }}>
            {stakedCars.length}/{cars.length}
          </p>
        </div>

        <div
          style={{
            background: "#fff3cd",
            padding: "15px",
            borderRadius: "8px",
            textAlign: "center",
          }}
        >
          <h3 style={{ margin: "0 0 5px 0", color: "#856404" }}>
            Pending Rewards
          </h3>
          <p style={{ margin: 0, fontSize: "24px", fontWeight: "bold" }}>
            {totalActiveRewards.toLocaleString()}
          </p>
        </div>

        <div
          style={{
            background: "#d4edda",
            padding: "15px",
            borderRadius: "8px",
            textAlign: "center",
          }}
        >
          <h3 style={{ margin: "0 0 5px 0", color: "#155724" }}>
            Total Earned
          </h3>
          <p style={{ margin: 0, fontSize: "24px", fontWeight: "bold" }}>
            {totalRewardsEarned.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Staking Pool Info */}
      <div
        style={{
          background: "#f8f9fa",
          padding: "20px",
          borderRadius: "12px",
          marginBottom: "30px",
          border: "1px solid #dee2e6",
        }}
      >
        <h3 style={{ margin: "0 0 15px 0" }}>🏊 Staking Pool Information</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
            gap: "20px",
            fontSize: "14px",
          }}
        >
          <div>
            <strong>Reward Rates (per hour):</strong>
            <ul style={{ margin: "5px 0", paddingLeft: "20px" }}>
              <li style={{ color: getRarityColor("common") }}>
                Common: {STAKING_POOL.rewardsPerHour.common} SPEEDY
              </li>
              <li style={{ color: getRarityColor("rare") }}>
                Rare: {STAKING_POOL.rewardsPerHour.rare} SPEEDY
              </li>
              <li style={{ color: getRarityColor("epic") }}>
                Epic: {STAKING_POOL.rewardsPerHour.epic} SPEEDY
              </li>
              <li style={{ color: getRarityColor("legendary") }}>
                Legendary: {STAKING_POOL.rewardsPerHour.legendary} SPEEDY
              </li>
            </ul>
          </div>
          <div>
            <strong>Pool Stats:</strong>
            <p style={{ margin: "5px 0" }}>
              Total Cars Staked: {STAKING_POOL.totalStaked.toLocaleString()}
            </p>
            <p style={{ margin: "5px 0" }}>
              Total Rewards Paid:{" "}
              {STAKING_POOL.totalRewardsPaid.toLocaleString()}
            </p>
          </div>
          <div>
            <strong>Duration Limits:</strong>
            <p style={{ margin: "5px 0" }}>
              Minimum: {STAKING_POOL.minStakeDuration} hour(s)
            </p>
            <p style={{ margin: "5px 0" }}>
              Maximum: {STAKING_POOL.maxStakeDuration} hour(s)
            </p>
          </div>
          <div>
            <strong>Your Pool Share:</strong>
            <p style={{ margin: "5px 0" }}>Cars: {stakedCars.length}</p>
            <p style={{ margin: "5px 0" }}>
              Share:{" "}
              {((stakedCars.length / STAKING_POOL.totalStaked) * 100).toFixed(
                4
              )}
              %
            </p>
          </div>
        </div>
      </div>

      {/* Staked Cars */}
      {stakedCars.length > 0 && (
        <div style={{ marginBottom: "30px" }}>
          <h3>🔒 Currently Staked Cars</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: "20px",
            }}
          >
            {stakedCars.map((car) => (
              <div
                key={car.mintAddress || car.id}
                style={{
                  background: "#fff",
                  border: `2px solid ${getRarityColor(car.traits.rarity)}`,
                  borderRadius: "12px",
                  padding: "20px",
                  boxShadow: getRarityGlow(car.traits.rarity),
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: "10px",
                    right: "10px",
                    background: "#28a745",
                    color: "white",
                    padding: "4px 8px",
                    borderRadius: "12px",
                    fontSize: "10px",
                    fontWeight: "bold",
                  }}
                >
                  STAKED
                </div>

                <img
                  src={car.image}
                  alt={car.name}
                  style={{
                    width: "100%",
                    height: "150px",
                    objectFit: "cover",
                    borderRadius: "8px",
                    marginBottom: "15px",
                  }}
                />

                <h4 style={{ margin: "0 0 5px 0", fontSize: "16px" }}>
                  {car.name}
                </h4>

                <span
                  style={{
                    background: getRarityColor(car.traits.rarity),
                    color: "white",
                    padding: "2px 8px",
                    borderRadius: "12px",
                    fontSize: "11px",
                    fontWeight: "bold",
                  }}
                >
                  {car.traits.rarity}
                </span>

                <div
                  style={{
                    background: "#e7f3ff",
                    padding: "12px",
                    borderRadius: "6px",
                    margin: "12px 0",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "12px",
                      marginBottom: "5px",
                    }}
                  >
                    <span>Staking Time:</span>
                    <strong>{car.stakingHours?.toFixed(2) || 0} hours</strong>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "12px",
                      marginBottom: "5px",
                    }}
                  >
                    <span>Rate per Hour:</span>
                    <strong>
                      {STAKING_POOL.rewardsPerHour[car.traits.rarity as keyof typeof STAKING_POOL.rewardsPerHour] || 
                       STAKING_POOL.rewardsPerHour.common} SPEEDY
                    </strong>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "12px",
                    }}
                  >
                    <span>Pending Rewards:</span>
                    <strong style={{ color: "#ff6b35" }}>
                      {car.estimatedRewards?.toLocaleString() || 0} SPEEDY
                    </strong>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => claimRewards(car.mintAddress || car.id)}
                    disabled={loading || !car.estimatedRewards}
                    style={{
                      flex: 1,
                      background: car.estimatedRewards ? "#28a745" : "#6c757d",
                      color: "white",
                      border: "none",
                      padding: "8px",
                      borderRadius: "6px",
                      cursor: car.estimatedRewards ? "pointer" : "not-allowed",
                      fontSize: "12px",
                      fontWeight: "bold",
                    }}
                  >
                    Claim Rewards
                  </button>

                  <button
                    onClick={() => unstakeCar(car.mintAddress || car.id)}
                    disabled={loading}
                    style={{
                      background: "#dc3545",
                      color: "white",
                      border: "none",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: "bold",
                    }}
                  >
                    Unstake
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Cars */}
      {availableCars.length > 0 && (
        <div>
          <h3>🏎️ Available Cars for Staking</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "20px",
            }}
          >
            {availableCars.map((car) => (
              <div
                key={car.mintAddress || car.id}
                style={{
                  background: "#fff",
                  border: `2px solid ${getRarityColor(car.traits.rarity)}`,
                  borderRadius: "12px",
                  padding: "20px",
                  boxShadow: getRarityGlow(car.traits.rarity),
                }}
              >
                <img
                  src={car.image}
                  alt={car.name}
                  style={{
                    width: "100%",
                    height: "150px",
                    objectFit: "cover",
                    borderRadius: "8px",
                    marginBottom: "15px",
                  }}
                />

                <h4 style={{ margin: "0 0 5px 0", fontSize: "16px" }}>
                  {car.name}
                </h4>

                <span
                  style={{
                    background: getRarityColor(car.traits.rarity),
                    color: "white",
                    padding: "2px 8px",
                    borderRadius: "12px",
                    fontSize: "11px",
                    fontWeight: "bold",
                  }}
                >
                  {car.traits.rarity}
                </span>

                <div
                  style={{
                    background: "#f8f9fa",
                    padding: "10px",
                    borderRadius: "6px",
                    margin: "12px 0",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: "5px",
                      fontSize: "11px",
                    }}
                  >
                    <div>
                      Speed: <strong>{car.traits.speed}</strong>
                    </div>
                    <div>
                      Accel: <strong>{car.traits.acceleration}</strong>
                    </div>
                    <div>
                      Handle: <strong>{car.traits.handling}</strong>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    background: "#fff3cd",
                    padding: "8px",
                    borderRadius: "6px",
                    marginBottom: "12px",
                    textAlign: "center",
                  }}
                >
                  <strong style={{ color: "#856404" }}>
                    Earns {STAKING_POOL.rewardsPerHour[car.traits.rarity as keyof typeof STAKING_POOL.rewardsPerHour] || STAKING_POOL.rewardsPerHour.common} SPEEDY/hour
                  </strong>
                </div>

                <button
                  onClick={() => stakeCar(car.mintAddress || car.id)}
                  disabled={loading || !connected}
                  style={{
                    width: "100%",
                    background: connected ? "#ff6b35" : "#6c757d",
                    color: "white",
                    border: "none",
                    padding: "12px",
                    borderRadius: "6px",
                    cursor: connected ? "pointer" : "not-allowed",
                    fontWeight: "bold",
                  }}
                >
                  {loading
                    ? "Staking..."
                    : !connected
                    ? "Connect Wallet"
                    : "Stake Car"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {cars.length === 0 && (
        <div
          style={{
            background: "#f8f9fa",
            padding: "40px",
            borderRadius: "12px",
            textAlign: "center",
            border: "2px dashed #dee2e6",
          }}
        >
          <h3>🏎️ No NFT Cars Found</h3>
          <p>
            You need to own NFT cars to participate in staking. Visit the
            minting section to get your first car!
          </p>
        </div>
      )}

      {/* Connection Status */}
      {!connected && (
        <div
          style={{
            background: "#fff3cd",
            padding: "20px",
            borderRadius: "8px",
            border: "1px solid #ffeaa7",
            marginTop: "20px",
            textAlign: "center",
          }}
        >
          <h3>⚠️ Wallet Not Connected</h3>
          <p>
            Connect your wallet to stake your NFT cars and earn SPEEDY token
            rewards!
          </p>
        </div>
      )}

      {error && (
        <div
          style={{
            background: "#f8d7da",
            padding: "15px",
            borderRadius: "8px",
            border: "1px solid #f5c6cb",
            marginTop: "20px",
          }}
        >
          <h4>❌ Error:</h4>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
};

export default CarStaking;
