// components/WalletIntegration.tsx - FIXED VERSION with TypeScript errors resolved
import React, { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import { useHoneycomb } from "../hooks/useHoneycomb";

interface WalletIntegrationProps {
  onConnect: () => void;
  gameStarted?: boolean;
}

function WalletIntegration({
  onConnect,
  gameStarted = false,
}: WalletIntegrationProps) {
  const { connected, publicKey } = useWallet();
  const {
    playerProfile,
    loading,
    honeycombStatus,
    initializationRequired,
    profileReady,
    getTraitBonuses,
    getRecentAchievements,
  } = useHoneycomb();

  const [showHoneycombInfo, setShowHoneycombInfo] = useState(false);

  useEffect(() => {
    if (connected && publicKey) {
      console.log("🍯 Wallet connected:", publicKey.toBase58());
      onConnect();

      // Show info panel after profile is ready and game hasn't started
      if (playerProfile && profileReady && !loading && !gameStarted) {
        setTimeout(() => setShowHoneycombInfo(true), 500);
      }
    } else {
      setShowHoneycombInfo(false);
    }
  }, [
    connected,
    publicKey,
    playerProfile,
    profileReady,
    loading,
    gameStarted,
    onConnect,
  ]);

  // Function to request test SOL
  const requestTestSol = () => {
    if (!publicKey) return;

    const amount = 5;
    const command = `solana airdrop ${amount} ${publicKey.toString()} -u https://rpc.test.honeycombprotocol.com`;

    navigator.clipboard
      .writeText(command)
      .then(() => {
        alert(
          `💰 Airdrop command copied to clipboard!\n\nRun this in your terminal:\n${command}`
        );
      })
      .catch(() => {
        prompt("Copy this command:", command);
      });
  };

  // 🔧 Helper function to format trait bonus values safely
  const formatBonusValue = (key: string, value: unknown): string => {
    // Convert to number safely
    const numValue =
      typeof value === "number" ? value : parseFloat(String(value)) || 0;

    switch (key) {
      case "speedMultiplier":
        return `+${((numValue - 1) * 100).toFixed(0)}%`;
      case "bonusSpawnRate":
        return `+${((numValue - 1) * 100).toFixed(0)}%`;
      case "invisibilityDuration":
        return `+${numValue - 15}s`;
      default:
        return String(value); // Safely convert any value to string
    }
  };

  // 🔧 Helper function to get trait display name
  const getTraitDisplayName = (key: string): string => {
    switch (key) {
      case "speedMultiplier":
        return "🏃 Speed";
      case "bonusSpawnRate":
        return "💰 Bonus Rate";
      case "invisibilityDuration":
        return "⚡ Invisibility";
      default:
        return key;
    }
  };

  if (!connected) {
    return (
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
          color: "white",
          zIndex: 1000,
          background: "rgba(0,0,0,0.9)",
          padding: "40px",
          borderRadius: "20px",
          border: "2px solid #ffd700",
          maxWidth: "500px",
        }}
      >
        <div style={{ fontSize: "48px", marginBottom: "20px" }}>🍯</div>
        <h2 style={{ color: "#ffd700", marginBottom: "15px" }}>
          Honeycomb Car Racing
        </h2>
        <p style={{ marginBottom: "20px" }}>
          Connect your wallet to start racing with{" "}
          <strong>real on-chain progression</strong> powered by Honeycomb
          Protocol!
        </p>
        <div style={{ fontSize: "14px", opacity: 0.8, marginBottom: "20px" }}>
          <p>✨ Connected to Test Network</p>
          <p>🏆 Real blockchain achievements</p>
          <p>🎮 Permanent progress storage</p>
          <p>💰 Unlimited test SOL available</p>
        </div>

        <WalletMultiButton
          style={{
            background: "linear-gradient(45deg, #ffd700, #ffed4e)",
            border: "2px solid #ffd700",
            borderRadius: "10px",
            fontWeight: "bold",
            padding: "15px 25px",
            fontSize: "16px",
            color: "black",
          }}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{
          position: "fixed",
          top: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1000,
          background: "rgba(0,0,0,0.9)",
          color: "white",
          padding: "15px 25px",
          borderRadius: "10px",
          border: "2px solid #ffd700",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "20px", marginBottom: "5px" }}>🍯</div>
        <div>Initializing Honeycomb Protocol...</div>
        <div style={{ fontSize: "12px", opacity: 0.8, marginTop: "5px" }}>
          {honeycombStatus === "created"
            ? "✅ Connected to blockchain"
            : "Setting up blockchain integration"}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Wallet Button - Always visible when connected */}
      <div
        style={{
          position: "fixed",
          top: "20px",
          right: "20px",
          zIndex: 1001,
        }}
      >
        <WalletMultiButton
          style={{
            background: "linear-gradient(45deg, #667eea, #764ba2)",
            border: "2px solid #ffd700",
            borderRadius: "10px",
            fontWeight: "bold",
            padding: "10px 20px",
          }}
        />
      </div>

      {/* Honeycomb Profile Info - Fixed TypeScript errors */}
      {showHoneycombInfo && playerProfile && profileReady && !gameStarted && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            left: "20px",
            zIndex: 1000,
            background: "rgba(0,0,0,0.9)",
            color: "white",
            padding: "15px",
            borderRadius: "10px",
            border: "2px solid #ffd700",
            minWidth: "280px",
            maxWidth: "350px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "10px",
            }}
          >
            <h4 style={{ margin: 0, color: "#ffd700" }}>🍯 Player Profile</h4>
            <button
              onClick={() => setShowHoneycombInfo(false)}
              style={{
                background: "none",
                border: "none",
                color: "white",
                cursor: "pointer",
                fontSize: "16px",
              }}
            >
              ×
            </button>
          </div>

          <div style={{ fontSize: "14px", marginBottom: "10px" }}>
            <p style={{ margin: "5px 0" }}>
              <strong>Level {playerProfile.level}</strong> • XP:{" "}
              {playerProfile.totalXp}
            </p>
            <p style={{ margin: "5px 0" }}>
              High Score: {playerProfile.highScore.toLocaleString()}
            </p>
            <p style={{ margin: "5px 0" }}>
              Games Played: {playerProfile.gamesPlayed}
            </p>
            <p style={{ margin: "5px 0" }}>
              Total Distance: {playerProfile.totalDistance}m
            </p>
          </div>

          {/* Show initialization status */}
          <div style={{ marginBottom: "15px" }}>
            <p style={{ margin: "5px 0", fontSize: "12px", color: "#ffd700" }}>
              Blockchain Status:
            </p>
            <div style={{ fontSize: "11px", marginBottom: "5px" }}>
              Profile: {profileReady ? "✅ Ready" : "⏳ Loading"}
            </div>
            <div style={{ fontSize: "11px", marginBottom: "5px" }}>
              Honeycomb:{" "}
              {honeycombStatus === "created"
                ? "🚀 Connected"
                : honeycombStatus === "initializing"
                ? "⏳ Setting up"
                : initializationRequired
                ? "⚠️ Will initialize on game start"
                : "❌ Not connected"}
            </div>
            {initializationRequired && (
              <div
                style={{
                  fontSize: "10px",
                  color: "#ffaa00",
                  background: "rgba(255,170,0,0.1)",
                  padding: "5px",
                  borderRadius: "3px",
                  margin: "5px 0",
                }}
              >
                💡 Blockchain integration will start when you begin racing
              </div>
            )}
          </div>

          {/* ✅ FIXED: Show trait bonuses with proper TypeScript handling */}
          <div style={{ marginBottom: "15px" }}>
            <p style={{ margin: "5px 0", fontSize: "12px", color: "#ffd700" }}>
              Active Bonuses:
            </p>
            {(() => {
              const bonuses = getTraitBonuses();
              const bonusEntries = Object.entries(bonuses);

              if (bonusEntries.length === 0) {
                return (
                  <div style={{ fontSize: "10px", opacity: 0.6 }}>
                    Play more to unlock trait bonuses!
                  </div>
                );
              }

              return bonusEntries.map(([key, value]) => (
                <div
                  key={key}
                  style={{
                    fontSize: "11px",
                    margin: "2px 0",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span>{getTraitDisplayName(key)}</span>
                  <span>{formatBonusValue(key, value)}</span>
                </div>
              ));
            })()}
          </div>

          {/* ✅ FIXED: Show achievements with proper type handling */}
          <div style={{ marginBottom: "15px" }}>
            <p style={{ margin: "5px 0", fontSize: "12px", color: "#ffd700" }}>
              Recent Achievements:
            </p>
            {(() => {
              const achievements = getRecentAchievements();

              if (!achievements || achievements.length === 0) {
                return (
                  <div style={{ fontSize: "10px", opacity: 0.6 }}>
                    Start playing to earn achievements!
                  </div>
                );
              }

              return achievements.slice(-3).map((achievement, index) => (
                <div
                  key={`achievement-${index}`}
                  style={{
                    fontSize: "10px",
                    margin: "2px 0",
                    opacity: 0.8,
                  }}
                >
                  🏆 {String(achievement)}
                </div>
              ));
            })()}
          </div>

          {/* Game Stats */}
          <div style={{ marginBottom: "15px" }}>
            <p style={{ margin: "5px 0", fontSize: "12px", color: "#ffd700" }}>
              Career Stats:
            </p>
            <div style={{ fontSize: "10px", opacity: 0.8 }}>
              <div>
                🏁 Best Lap:{" "}
                {playerProfile.bestLapTime > 0
                  ? `${playerProfile.bestLapTime.toFixed(1)}s`
                  : "N/A"}
              </div>
              <div>
                🚧 Obstacles Avoided: {playerProfile.totalObstaclesAvoided}
              </div>
              <div>
                🍯 Bonus Collected: {playerProfile.totalBonusBoxesCollected}
              </div>
            </div>
          </div>

          {/* Test SOL Request Button */}
          <button
            onClick={requestTestSol}
            style={{
              width: "100%",
              background: "linear-gradient(45deg, #ffd700, #ffed4e)",
              border: "none",
              color: "black",
              padding: "8px 12px",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "12px",
              marginBottom: "10px",
            }}
          >
            💰 Get Test SOL
          </button>

          <div style={{ fontSize: "10px", opacity: 0.6, textAlign: "center" }}>
            Ready for Honeycomb Protocol ✅
            <br />
            Network: Test Network
          </div>
        </div>
      )}
    </>
  );
}

export default WalletIntegration;
