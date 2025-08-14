// components/DebugHoneycomb.tsx - Temporary debugging component
import React from "react";
import { useHoneycomb } from "../hooks/useHoneycomb";

const DebugHoneycomb: React.FC = () => {
  const {
    playerProfile,
    gameResources,
    loading,
    updateGameStats,
    updateMissionProgress,
    clearAndRecreateProfile,
    // NEW: Honeycomb status
    honeycombStatus,
    honeycombProject,
    tryCreateHoneycombAssets,
  } = useHoneycomb();

  const testStatsUpdate = async () => {
    console.log("🧪 Testing stats update...");

    const testStats = {
      score: 150,
      distance: 75,
      obstaclesAvoided: 3,
      bonusBoxesCollected: 2,
      gameCompleted: true,
    };

    console.log("📤 Sending test stats:", testStats);

    try {
      await updateGameStats(testStats);
      console.log("✅ Test stats update completed");
    } catch (error) {
      console.error("❌ Test stats update failed:", error);
    }
  };

  const testMissionUpdate = async () => {
    console.log("🎯 Testing mission update...");

    try {
      await updateMissionProgress("first_ride", 1);
      await updateMissionProgress("daily_racer", 1);
      console.log("✅ Test mission update completed");
    } catch (error) {
      console.error("❌ Test mission update failed:", error);
    }
  };

  if (loading) {
    return <div>Loading Honeycomb...</div>;
  }

  return (
    <div
      style={{
        position: "fixed",
        top: "10px",
        right: "10px",
        zIndex: 2000,
        background: "rgba(0,0,0,0.8)",
        color: "white",
        padding: "15px",
        borderRadius: "10px",
        fontSize: "12px",
        maxWidth: "300px",
      }}
    >
      <h3 style={{ color: "#ffd700", margin: "0 0 10px 0" }}>🐛 Debug Panel</h3>

      <div style={{ marginBottom: "10px" }}>
        <strong>Profile Status:</strong>{" "}
        {playerProfile ? "✅ Loaded" : "❌ Not Found"}
      </div>

      <div style={{ marginBottom: "10px" }}>
        <strong>Honeycomb Status:</strong>{" "}
        {honeycombStatus === "created"
          ? "🍯 Connected"
          : honeycombStatus === "creating"
          ? "⏳ Creating..."
          : honeycombStatus === "error"
          ? "❌ Failed"
          : "⚠️ Local Only"}
      </div>

      {playerProfile?.honeycombCreated && (
        <div
          style={{ marginBottom: "10px", fontSize: "10px", color: "#90EE90" }}
        >
          📍 Project: {playerProfile.honeycombProjectId?.slice(0, 8)}...
          <br />
          📍 Profile: {playerProfile.honeycombProfileAddress?.slice(0, 8)}...
        </div>
      )}

      {playerProfile && (
        <div style={{ marginBottom: "10px", fontSize: "10px" }}>
          <div>Level: {playerProfile.level}</div>
          <div>XP: {playerProfile.totalXp}</div>
          <div>High Score: {playerProfile.highScore}</div>
          <div>Games: {playerProfile.gamesPlayed}</div>
          <div>Distance: {playerProfile.totalDistance}m</div>
          <div>Obstacles: {playerProfile.totalObstaclesAvoided}</div>
          <div>Bonuses: {playerProfile.totalBonusBoxesCollected}</div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
        <button
          onClick={testStatsUpdate}
          style={{
            background: "#4CAF50",
            color: "white",
            border: "none",
            padding: "5px 10px",
            borderRadius: "5px",
            cursor: "pointer",
            fontSize: "10px",
          }}
        >
          🧪 Test Stats Update
        </button>

        <button
          onClick={testMissionUpdate}
          style={{
            background: "#2196F3",
            color: "white",
            border: "none",
            padding: "5px 10px",
            borderRadius: "5px",
            cursor: "pointer",
            fontSize: "10px",
          }}
        >
          🎯 Test Mission Update
        </button>

        <button
          onClick={clearAndRecreateProfile}
          style={{
            background: "#ff6b6b",
            color: "white",
            border: "none",
            padding: "5px 10px",
            borderRadius: "5px",
            cursor: "pointer",
            fontSize: "10px",
          }}
        >
          🗑️ Clear & Recreate Profile
        </button>

        {honeycombStatus !== "created" && honeycombStatus !== "creating" && (
          <button
            onClick={tryCreateHoneycombAssets}
            style={{
              background: "#FFA500",
              color: "white",
              border: "none",
              padding: "5px 10px",
              borderRadius: "5px",
              cursor: "pointer",
              fontSize: "10px",
            }}
          >
            🍯 Create Honeycomb Assets
          </button>
        )}
      </div>

      <div style={{ marginTop: "10px", fontSize: "10px", opacity: 0.7 }}>
        Check console for detailed logs
      </div>
    </div>
  );
};

export default DebugHoneycomb;
