// components/HoneycombCarGame.tsx - FIXED: Updated for correct Honeycomb integration
import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { useWallet } from "@solana/wallet-adapter-react";
import { useHoneycomb } from "../hooks/useHoneycomb";
import { speedyTokenService } from "../services/speedyTokenService";
import { combinedTransactionService } from "../services/combinedTransactionService";
import NFTCarSelector from "./NFTCarSelector";
import type { NFTCar } from "../services/nftCarService";

// Define interfaces locally to avoid import issues
interface RaceStats {
  raceId: number;
  completed: boolean;
  won: boolean;
  distance: number;
  obstaclesAvoided: number;
  bonusBoxesCollected: number;
  lapTime: number;
  score: number;
}

interface TokenRewardResponse {
  success: boolean;
  tokensEarned: number;
  transactionSignature?: string;
  error?: string;
}

const HoneycombCarGame: React.FC = () => {
  const {
    connected,
    publicKey,
    signTransaction,
    signAllTransactions,
    signMessage,
    wallet: walletAdapter,
  } = useWallet();
  const wallet = {
    publicKey,
    signTransaction,
    signAllTransactions,
    signMessage,
    adapter: walletAdapter,
  };
  const honeycombHook = useHoneycomb();
  const {
    playerProfile,
    updateGameStats,
    getTraitBonuses,
    updateMissionProgress,
    getRecentAchievements,
    loading: honeycombLoading,
    profileReady,
    honeycombStatus,
    honeycombProfile,
    honeycombProject,
    initializationRequired,
    initializeHoneycombIntegration,
    createUserProfile, // New function for profile creation
  } = honeycombHook;

  // Track initialization state
  const [initializationStatus, setInitializationStatus] = useState<
    "not_started" | "in_progress" | "completed" | "failed"
  >("not_started");
  const [initializationError, setInitializationError] = useState<string | null>(
    null
  );
  const [gameReadyToStart, setGameReadyToStart] = useState(false);

  // SPEEDY Token states
  const [speedyBalance, setSpeedyBalance] = useState<number>(0);
  const [isAwardingTokens, setIsAwardingTokens] = useState(false);
  const [tokenRewardMessage, setTokenRewardMessage] = useState<string>("");

  // NFT Car Selection states
  const [selectedNFTCar, setSelectedNFTCar] = useState<NFTCar | null>(null);
  const [showCarSelector, setShowCarSelector] = useState(false);

  // Create a ref to store the entire Honeycomb hook for real-time access
  const honeycombRef = useRef(honeycombHook);

  // Update the ref whenever the hook changes
  useEffect(() => {
    honeycombRef.current = honeycombHook;
  }, [honeycombHook]);

  // Three.js refs
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>(null!);
  const rendererRef = useRef<THREE.WebGLRenderer>(null!);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null!);
  const carRef = useRef<THREE.Group>(null!);
  const roadRef = useRef<THREE.Mesh>(null!);
  const roadLinesRef = useRef<THREE.Mesh[]>([]);
  const obstaclesRef = useRef<THREE.Group[]>([]);
  const bonusBoxesRef = useRef<THREE.Group[]>([]);
  const goldenKeysRef = useRef<THREE.Group[]>([]);
  const invisibilityIndicatorRef = useRef<THREE.Mesh>(null!);
  const animationIdRef = useRef<number>(0);

  // Game state
  const [score, setScore] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const [gameRunning, setGameRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [showMissionComplete, setShowMissionComplete] = useState<string | null>(
    null
  );
  const [invisibilityActive, setInvisibilityActive] = useState(false);
  const [invisibilityCountdown, setInvisibilityCountdown] = useState(0);

  // Use ref for gameRunning in animate to avoid stale state
  const gameRunningRef = useRef(false);

  // Enhanced game stats tracking with refs for real-time updates
  const gameStatsRef = useRef({
    distance: 0,
    obstaclesAvoided: 0,
    bonusBoxesCollected: 0,
    gameStartTime: Date.now(),
    finalScore: 0,
    lapTime: 0,
  });

  // Separate state for display (synced from ref)
  const [gameStatsDisplay, setGameStatsDisplay] = useState({
    distance: 0,
    obstaclesAvoided: 0,
    bonusBoxesCollected: 0,
  });

  // Game variables with trait bonuses
  const gameStateRef = useRef({
    carPosition: 0,
    targetCarPosition: 0,
    baseGameSpeed: 0.008,
    speedMultiplier: 1.0,
    obstacleSpawnRate: 0.015,
    nextBonusThreshold: 70,
    gameStartTime: Date.now(),
    nextKeySpawnTime: 15,
    keySpawnInterval: 30,
    isInvisible: false,
    invisibilityTimer: 0,
    currentScore: 0,
    missionCheckpoints: {
      firstRide: false,
      speedRunner: false,
      collectorMaster: false,
      obstaclemaster: false,
      distanceLegend: false,
    },
  });

  // Input handling
  const keysRef = useRef({
    left: false,
    right: false,
    up: false,
    down: false,
  });

  // Get trait bonuses for gameplay (enhanced with NFT car traits)
  const getEnhancedTraitBonuses = useCallback(() => {
    const baseTraitBonuses = getTraitBonuses();
    
    if (!selectedNFTCar) {
      return baseTraitBonuses;
    }

    // Apply NFT car trait bonuses on top of base bonuses
    const nftBonuses = {
      speedMultiplier: (baseTraitBonuses.speedMultiplier || 1) * (1 + (selectedNFTCar.traits.speed - 5) * 0.05), // 5% per point above 5
      bonusSpawnRate: (baseTraitBonuses.bonusSpawnRate || 1) * (1 + (selectedNFTCar.traits.handling - 5) * 0.03), // 3% per point above 5  
      invisibilityDuration: (baseTraitBonuses.invisibilityDuration || 15) + Math.floor((selectedNFTCar.traits.durability - 5) / 2), // +1s per 2 points above 5
      accelerationBonus: 1 + (selectedNFTCar.traits.acceleration - 5) * 0.04, // 4% per point above 5
    };

    return nftBonuses;
  }, [getTraitBonuses, selectedNFTCar]);

  const traitBonuses = getEnhancedTraitBonuses();

  // NFT Car selection handlers
  const handleCarSelected = useCallback((car: NFTCar | null) => {
    setSelectedNFTCar(car);
    updateCarAppearance(car);
  }, []);

  const updateCarAppearance = useCallback((car: NFTCar | null) => {
    if (!carRef.current) return;

    const carGroup = carRef.current;
    
    // Update car color based on NFT car or rarity
    let carColor = 0xff4444; // Default red
    let logoVisible = true;

    if (car) {
      // Set color based on rarity
      switch (car.traits.rarity.toLowerCase()) {
        case 'common':
          carColor = 0x6c757d; // Gray
          break;
        case 'uncommon':
          carColor = 0x28a745; // Green
          break;
        case 'rare':
          carColor = 0x007bff; // Blue
          break;
        case 'epic':
          carColor = 0x6610f2; // Purple
          break;
        case 'legendary':
          carColor = 0xfd7e14; // Orange/Gold
          break;
        default:
          carColor = 0xff4444; // Red
      }
    } else {
      carColor = connected ? 0xff4444 : 0x666666;
    }

    // Update body color
    const bodyMesh = carGroup.children.find(child => 
      child instanceof THREE.Mesh && 
      child.geometry instanceof THREE.BoxGeometry &&
      (child.geometry as THREE.BoxGeometry).parameters.width === 2.2
    );
    
    if (bodyMesh && bodyMesh instanceof THREE.Mesh) {
      if (bodyMesh.material instanceof THREE.MeshLambertMaterial) {
        bodyMesh.material.color.setHex(carColor);
      }
    }

    // Update roof color (slightly darker)
    const roofMesh = carGroup.children.find(child => 
      child instanceof THREE.Mesh && 
      child.geometry instanceof THREE.BoxGeometry &&
      (child.geometry as THREE.BoxGeometry).parameters.width === 1.8
    );
    
    if (roofMesh && roofMesh instanceof THREE.Mesh) {
      if (roofMesh.material instanceof THREE.MeshLambertMaterial) {
        const darkerColor = new THREE.Color(carColor).multiplyScalar(0.8);
        roofMesh.material.color.copy(darkerColor);
      }
    }
  }, [connected]);

  // Initialize Honeycomb when game component mounts - Background initialization only
  useEffect(() => {
    if (connected && initializationStatus === "not_started") {
      console.log(
        "🍯 Connected - initializing Honeycomb in background without wallet popups"
      );

      // Initialize game first
      setInitializationStatus("completed");
      setGameReadyToStart(true);

      // Initialize Honeycomb in background (this won't trigger wallet popups, just checks existing profiles)
      const initializeBackground = async () => {
        try {
          console.log("🔄 Background Honeycomb initialization starting...");
          await initializeHoneycombIntegration();
          console.log("✅ Background Honeycomb initialization completed");
        } catch (error: any) {
          if (
            error.message?.includes("Failed to fetch") ||
            error.message?.includes("ERR_NAME_NOT_RESOLVED") ||
            error.message?.includes("Network")
          ) {
            console.log(
              "🌐 Honeycomb API unavailable - will use local stats only"
            );
          } else {
            console.log(
              "⚠️ Background Honeycomb initialization failed:",
              error.message
            );
          }
        }
      };

      // Run initialization in background after a short delay
      setTimeout(initializeBackground, 1000);
    }
  }, [connected, initializationStatus]); // Removed initializeHoneycombIntegration to prevent loops

  const showPopup = useCallback((text: string) => {
    setShowMissionComplete(text);
    setTimeout(() => setShowMissionComplete(null), 3000);
  }, []);

  // Real-time mission progress checker
  const checkRealTimeMissions = useCallback(async () => {
    const currentHoneycomb = honeycombRef.current;
    if (!currentHoneycomb.playerProfile || !currentHoneycomb.profileReady)
      return;

    const currentStats = gameStatsRef.current;
    const gameState = gameStateRef.current;

    if (
      !gameState.missionCheckpoints.speedRunner &&
      currentStats.distance >= 1000
    ) {
      console.log("🏆 Speed Runner achievement triggered!");
      await currentHoneycomb.updateMissionProgress("speed_runner", 1);
      gameState.missionCheckpoints.speedRunner = true;
      showPopup("🏆 Mission Complete: Speed Runner!");
    }
  }, [showPopup]);

  // Enhanced mission progress checking with all cumulative stats
  const checkAllMissionProgress = useCallback(async () => {
    const currentHoneycomb = honeycombRef.current;
    if (!currentHoneycomb.playerProfile || !currentHoneycomb.profileReady)
      return;

    const currentStats = gameStatsRef.current;
    const gameState = gameStateRef.current;

    console.log(
      "🎯 Checking ALL mission progress with final stats:",
      currentStats
    );

    try {
      if (
        !gameState.missionCheckpoints.firstRide &&
        currentHoneycomb.playerProfile.gamesPlayed === 0
      ) {
        console.log("🏆 First Ride mission triggered!");
        await currentHoneycomb.updateMissionProgress("first_ride", 1);
        gameState.missionCheckpoints.firstRide = true;
        showPopup("🏆 Mission Complete: First Ride!");
      }

      if (
        currentStats.bonusBoxesCollected > 0 &&
        !gameState.missionCheckpoints.collectorMaster
      ) {
        console.log(
          `🏆 Collector Master progress: +${currentStats.bonusBoxesCollected} boxes`
        );
        await currentHoneycomb.updateMissionProgress(
          "collector_master",
          currentStats.bonusBoxesCollected
        );
        gameState.missionCheckpoints.collectorMaster = true;
      }

      if (
        currentStats.obstaclesAvoided > 0 &&
        !gameState.missionCheckpoints.obstaclemaster
      ) {
        console.log(
          `🏆 Obstacle Master progress: +${currentStats.obstaclesAvoided} obstacles`
        );
        await currentHoneycomb.updateMissionProgress(
          "obstacle_master",
          currentStats.obstaclesAvoided
        );
        gameState.missionCheckpoints.obstaclemaster = true;
      }

      if (
        currentStats.distance > 0 &&
        !gameState.missionCheckpoints.distanceLegend
      ) {
        console.log(`🏆 Distance Legend progress: +${currentStats.distance}m`);
        await currentHoneycomb.updateMissionProgress(
          "distance_legend",
          currentStats.distance
        );
        gameState.missionCheckpoints.distanceLegend = true;
      }

      console.log("✅ All mission progress checks completed");
    } catch (error) {
      console.error("❌ Error checking mission progress:", error);
    }
  }, [showPopup]);

  // Updated stats sync function
  const updateDisplayStats = useCallback(() => {
    setGameStatsDisplay({
      distance: gameStatsRef.current.distance,
      obstaclesAvoided: gameStatsRef.current.obstaclesAvoided,
      bonusBoxesCollected: gameStatsRef.current.bonusBoxesCollected,
    });
  }, []);

  // Create road lines properly
  const createRoadLines = useCallback(() => {
    if (!sceneRef.current) return;

    roadLinesRef.current.forEach((line) => {
      if (sceneRef.current) {
        sceneRef.current.remove(line);
      }
    });
    roadLinesRef.current = [];

    const lineSpacing = 8;
    const lineLength = 4;
    const numLines = 500;

    for (let i = 0; i < numLines; i++) {
      const zPosition = i * lineSpacing - 2000;

      const lineGeometry = new THREE.PlaneGeometry(0.2, lineLength);
      const lineMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
      const line = new THREE.Mesh(lineGeometry, lineMaterial);
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, 0.005, zPosition);
      sceneRef.current.add(line);
      roadLinesRef.current.push(line);

      const leftLine = new THREE.Mesh(
        lineGeometry.clone(),
        lineMaterial.clone()
      );
      leftLine.rotation.x = -Math.PI / 2;
      leftLine.position.set(-3, 0.005, zPosition);
      sceneRef.current.add(leftLine);
      roadLinesRef.current.push(leftLine);

      const rightLine = new THREE.Mesh(
        lineGeometry.clone(),
        lineMaterial.clone()
      );
      rightLine.rotation.x = -Math.PI / 2;
      rightLine.position.set(3, 0.005, zPosition);
      sceneRef.current.add(rightLine);
      roadLinesRef.current.push(rightLine);
    }
  }, []);

  const createObstacle = useCallback((carZ: number) => {
    if (!sceneRef.current) return;

    const obstacleGroup = new THREE.Group();
    const obstacleType = Math.random();

    if (obstacleType < 0.4) {
      const geometry = new THREE.BoxGeometry(1.2, 1.2, 1.2);
      const material = new THREE.MeshLambertMaterial({
        color: new THREE.Color().setHSL(Math.random(), 0.8, 0.5),
      });
      const obstacle = new THREE.Mesh(geometry, material);
      obstacle.position.y = 0.6;
      obstacle.castShadow = true;
      obstacleGroup.add(obstacle);
    } else if (obstacleType < 0.7) {
      const geometry = new THREE.ConeGeometry(0.6, 2);
      const material = new THREE.MeshLambertMaterial({ color: 0xff8800 });
      const obstacle = new THREE.Mesh(geometry, material);
      obstacle.position.y = 1;
      obstacle.castShadow = true;
      obstacleGroup.add(obstacle);
    } else {
      const geometry = new THREE.SphereGeometry(0.8);
      const material = new THREE.MeshLambertMaterial({ color: 0x8844ff });
      const obstacle = new THREE.Mesh(geometry, material);
      obstacle.position.y = 0.8;
      obstacle.castShadow = true;
      obstacleGroup.add(obstacle);
    }

    const lanes = [-4.5, -1.5, 1.5, 4.5];
    const laneIndex = Math.floor(Math.random() * lanes.length);
    const randomDistance = Math.random() * 300 + 50;
    obstacleGroup.position.set(lanes[laneIndex], 0, carZ - randomDistance);

    sceneRef.current.add(obstacleGroup);
    obstaclesRef.current.push(obstacleGroup);
  }, []);

  const createBonusBox = useCallback(
    (carZ: number) => {
      if (!sceneRef.current) return;

      const bonusGroup = new THREE.Group();

      const boxGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
      const boxMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
      const box = new THREE.Mesh(boxGeometry, boxMaterial);
      box.position.y = 0.75;
      box.castShadow = true;
      bonusGroup.add(box);

      const symbolGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 6);
      const symbolMaterial = new THREE.MeshLambertMaterial({ color: 0xffd700 });
      const symbol = new THREE.Mesh(symbolGeometry, symbolMaterial);
      symbol.position.y = 1.6;
      symbol.rotation.x = -Math.PI / 2;
      symbol.castShadow = true;
      bonusGroup.add(symbol);

      const lanes = [-4.5, -1.5, 1.5, 4.5];
      const laneIndex = Math.floor(Math.random() * lanes.length);

      const bonusSpawnMultiplier = traitBonuses.bonusSpawnRate || 1;
      const randomDistance = Math.random() * (200 / bonusSpawnMultiplier) + 100;
      const finalPosition = carZ - randomDistance;

      bonusGroup.position.set(lanes[laneIndex], 0, finalPosition);

      sceneRef.current.add(bonusGroup);
      bonusBoxesRef.current.push(bonusGroup);
    },
    [traitBonuses.bonusSpawnRate]
  );

  const createGoldenKey = useCallback((carZ: number) => {
    if (!sceneRef.current) return;

    const keyGroup = new THREE.Group();
    const handleGeometry = new THREE.TorusGeometry(0.6, 0.15);
    const keyMaterial = new THREE.MeshLambertMaterial({
      color: 0xffd700,
      emissive: 0x332200,
    });
    const handle = new THREE.Mesh(handleGeometry, keyMaterial);
    handle.position.y = 1;
    handle.castShadow = true;
    keyGroup.add(handle);

    const shaftGeometry = new THREE.BoxGeometry(0.2, 0.2, 1.5);
    const shaft = new THREE.Mesh(shaftGeometry, keyMaterial);
    shaft.position.set(0, 1, -0.75);
    shaft.castShadow = true;
    keyGroup.add(shaft);

    (keyGroup as any).userData = { rotationSpeed: 0.05 };

    const lanes = [-4.5, -1.5, 1.5, 4.5];
    const laneIndex = Math.floor(Math.random() * lanes.length);
    const randomDistance = Math.random() * 400 + 200;
    keyGroup.position.set(lanes[laneIndex], 0, carZ - randomDistance);

    sceneRef.current.add(keyGroup);
    goldenKeysRef.current.push(keyGroup);
  }, []);

  const activateInvisibility = useCallback(() => {
    console.log("🔥 ACTIVATING INVISIBILITY!");

    const baseDuration = 15000;
    const bonusDuration = (traitBonuses.invisibilityDuration || 15) - 15;
    const totalDuration = baseDuration + bonusDuration * 1000;

    gameStateRef.current.isInvisible = true;
    gameStateRef.current.invisibilityTimer = totalDuration;
    setInvisibilityActive(true);
    setInvisibilityCountdown(Math.ceil(totalDuration / 1000));

    if (invisibilityIndicatorRef.current) {
      invisibilityIndicatorRef.current.visible = true;
    }

    if (carRef.current) {
      carRef.current.children.forEach((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(mat => {
              mat.transparent = true;
              (mat as any).opacity = 0.7;
            });
          } else {
            mesh.material.transparent = true;
            (mesh.material as any).opacity = 0.7;
          }
        }
      });
    }

    showPopup(
      `⚡ INVISIBLE MODE ACTIVATED (${Math.ceil(totalDuration / 1000)}s) ⚡`
    );
  }, [showPopup, traitBonuses.invisibilityDuration]);

  const deactivateInvisibility = useCallback(() => {
    console.log("🔥 DEACTIVATING INVISIBILITY!");

    gameStateRef.current.isInvisible = false;
    gameStateRef.current.invisibilityTimer = 0;
    setInvisibilityActive(false);
    setInvisibilityCountdown(0);

    if (invisibilityIndicatorRef.current) {
      invisibilityIndicatorRef.current.visible = false;
    }

    if (carRef.current) {
      carRef.current.children.forEach((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(mat => {
              mat.transparent = false;
              (mat as any).opacity = 1.0;
            });
          } else {
            mesh.material.transparent = false;
            (mesh.material as any).opacity = 1.0;
          }
        }
      });
    }

    console.log("⚠️ Invisibility deactivated");
  }, []);

  // Animation function - moved before functions that depend on it
  const animate = useCallback(() => {
    if (
      !gameRunningRef.current ||
      !rendererRef.current ||
      !sceneRef.current ||
      !cameraRef.current ||
      !carRef.current
    ) {
      return;
    }

    const car = carRef.current;
    const camera = cameraRef.current;
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const road = roadRef.current;
    const roadLines = roadLinesRef.current;

    const baseSpeedMultiplier = traitBonuses.speedMultiplier || 1;
    const accelerationBonus = traitBonuses.accelerationBonus || 1;
    const accelerationRate = 0.02 * accelerationBonus;

    if (keysRef.current.up) {
      gameStateRef.current.speedMultiplier = Math.min(
        2.0 * baseSpeedMultiplier,
        gameStateRef.current.speedMultiplier + accelerationRate
      );
    }
    if (keysRef.current.down) {
      gameStateRef.current.speedMultiplier = Math.max(
        0.2,
        gameStateRef.current.speedMultiplier - accelerationRate
      );
    }

    const currentGameSpeed =
      gameStateRef.current.baseGameSpeed *
      gameStateRef.current.speedMultiplier *
      baseSpeedMultiplier;
    setSpeed(gameStateRef.current.speedMultiplier * baseSpeedMultiplier);

    if (gameStateRef.current.isInvisible) {
      gameStateRef.current.invisibilityTimer -= 16;

      const secondsLeft = Math.ceil(
        gameStateRef.current.invisibilityTimer / 1000
      );
      setInvisibilityCountdown(Math.max(0, secondsLeft));

      if (invisibilityIndicatorRef.current) {
        invisibilityIndicatorRef.current.rotation.y += 0.1;
      }

      if (gameStateRef.current.invisibilityTimer <= 0) {
        deactivateInvisibility();
      }
    }

    car.position.z -= currentGameSpeed * 30;

    const newDistance = Math.floor(
      (Date.now() - gameStatsRef.current.gameStartTime) / 100
    );
    gameStatsRef.current.distance = newDistance;

    if (newDistance % 10 === 0) {
      updateDisplayStats();
    }

    camera.position.z = car.position.z + 15;
    camera.lookAt(car.position.x, 0, car.position.z - 5);

    if (road) road.position.z = car.position.z - 1000;

    roadLines.forEach((line) => {
      if (line.position.z > car.position.z + 50) {
        line.position.z -= 4000;
      }
    });

    if (keysRef.current.left && gameStateRef.current.carPosition > -1) {
      gameStateRef.current.carPosition -= 0.08;
      gameStateRef.current.targetCarPosition = gameStateRef.current.carPosition;
    }
    if (keysRef.current.right && gameStateRef.current.carPosition < 1) {
      gameStateRef.current.carPosition += 0.08;
      gameStateRef.current.targetCarPosition = gameStateRef.current.carPosition;
    }

    if (
      Math.abs(
        gameStateRef.current.targetCarPosition -
          gameStateRef.current.carPosition
      ) > 0.01
    ) {
      const moveSpeed = 0.12;
      if (
        gameStateRef.current.targetCarPosition >
        gameStateRef.current.carPosition
      ) {
        gameStateRef.current.carPosition = Math.min(
          gameStateRef.current.targetCarPosition,
          gameStateRef.current.carPosition + moveSpeed
        );
      } else {
        gameStateRef.current.carPosition = Math.max(
          gameStateRef.current.targetCarPosition,
          gameStateRef.current.carPosition - moveSpeed
        );
      }
    }

    gameStateRef.current.carPosition = Math.max(
      -1,
      Math.min(1, gameStateRef.current.carPosition)
    );
    car.position.x = gameStateRef.current.carPosition * 4.5;

    if (Math.random() < gameStateRef.current.obstacleSpawnRate) {
      createObstacle(car.position.z);
    }

    if (
      gameStateRef.current.currentScore >=
      gameStateRef.current.nextBonusThreshold
    ) {
      createBonusBox(car.position.z);
      gameStateRef.current.nextBonusThreshold += 70;
    }

    const gameTimeElapsed =
      (Date.now() - gameStateRef.current.gameStartTime) / 1000;
    if (gameTimeElapsed >= gameStateRef.current.nextKeySpawnTime) {
      createGoldenKey(car.position.z);
      gameStateRef.current.nextKeySpawnTime +=
        gameStateRef.current.keySpawnInterval;
    }

    goldenKeysRef.current.forEach((key) => {
      key.rotation.y += (key as any).userData.rotationSpeed;
    });

    // Collision detection
    for (let i = obstaclesRef.current.length - 1; i >= 0; i--) {
      const obstacle = obstaclesRef.current[i];

      if (obstacle.position.z > car.position.z + 10) {
        scene.remove(obstacle);
        obstaclesRef.current.splice(i, 1);

        gameStateRef.current.currentScore += 5;
        setScore(gameStateRef.current.currentScore);

        gameStatsRef.current.obstaclesAvoided++;

        checkRealTimeMissions();
      } else if (
        !gameStateRef.current.isInvisible &&
        Math.abs(obstacle.position.z - car.position.z) < 2.5 &&
        Math.abs(obstacle.position.x - car.position.x) < 1.9
      ) {
        console.log("💥 COLLISION - GAME OVER!");
        endGame();
        return;
      }
    }

    // Bonus box collisions
    for (let i = bonusBoxesRef.current.length - 1; i >= 0; i--) {
      const bonusBox = bonusBoxesRef.current[i];

      if (bonusBox.position.z > car.position.z + 10) {
        scene.remove(bonusBox);
        bonusBoxesRef.current.splice(i, 1);
      } else if (
        Math.abs(bonusBox.position.z - car.position.z) < 2.5 &&
        Math.abs(bonusBox.position.x - car.position.x) < 1.9
      ) {
        scene.remove(bonusBox);
        bonusBoxesRef.current.splice(i, 1);

        gameStateRef.current.currentScore += 30;
        setScore(gameStateRef.current.currentScore);

        gameStatsRef.current.bonusBoxesCollected++;

        showPopup("+30 HONEYCOMB POINTS! 🍯");

        checkRealTimeMissions();
      }
    }

    // Golden key collisions
    for (let i = goldenKeysRef.current.length - 1; i >= 0; i--) {
      const key = goldenKeysRef.current[i];

      if (key.position.z > car.position.z + 10) {
        scene.remove(key);
        goldenKeysRef.current.splice(i, 1);
      } else if (
        Math.abs(key.position.z - car.position.z) < 2.5 &&
        Math.abs(key.position.x - car.position.x) < 1.9
      ) {
        scene.remove(key);
        goldenKeysRef.current.splice(i, 1);
        activateInvisibility();
      }
    }

    gameStateRef.current.baseGameSpeed += 0.000015;
    gameStateRef.current.obstacleSpawnRate = Math.min(
      0.04,
      gameStateRef.current.obstacleSpawnRate + 0.000008
    );

    renderer.render(scene, camera);
    animationIdRef.current = requestAnimationFrame(animate);
  }, [
    createObstacle,
    createBonusBox,
    createGoldenKey,
    activateInvisibility,
    deactivateInvisibility,
    showPopup,
    traitBonuses,
    checkRealTimeMissions,
    updateDisplayStats,
  ]);

  const endGame = useCallback(async () => {
    setGameRunning(false);
    gameRunningRef.current = false;
    setGameOver(true);

    const gameEndTime = Date.now();
    const lapTime = (gameEndTime - gameStatsRef.current.gameStartTime) / 1000;
    gameStatsRef.current.lapTime = lapTime;
    gameStatsRef.current.finalScore = gameStateRef.current.currentScore;

    updateDisplayStats();
    const currentHoneycomb = honeycombRef.current;

    try {
      await checkAllMissionProgress();

      let profileCreationNeeded = false;
      if (
        currentHoneycomb.honeycombProfile?.address === "pending-user-creation"
      ) {
        profileCreationNeeded = true;
      }

      // Check if we can do combined transaction (needs signAllTransactions support)
      const canDoCombinedTransaction = !!(
        (currentHoneycomb.honeycombStatus === "created" ||
          currentHoneycomb.honeycombStatus === "ready") &&
        currentHoneycomb.honeycombProfile &&
        currentHoneycomb.honeycombProject &&
        currentHoneycomb.playerProfile &&
        connected &&
        wallet.publicKey &&
        wallet.signAllTransactions
      );

      // Check if we can do Honeycomb blockchain update (needs signTransaction support)
      const canDoHoneycombBlockchain = !!(
        currentHoneycomb.honeycombStatus === "created" &&
        currentHoneycomb.honeycombProfile?.address !==
          "pending-user-creation" &&
        currentHoneycomb.honeycombProfile &&
        currentHoneycomb.honeycombProject &&
        currentHoneycomb.playerProfile &&
        connected &&
        wallet.publicKey &&
        wallet.signTransaction
      );

      if (canDoCombinedTransaction) {
        try {
          if (profileCreationNeeded) {
            showPopup(
              "🔧 Creating your blockchain profile for on-chain stats..."
            );

            const profileCreated = await currentHoneycomb.createUserProfile();
            if (profileCreated) {
              console.log("✅ Blockchain profile created successfully!");
              await new Promise((resolve) => setTimeout(resolve, 2000));
              await currentHoneycomb.initializeHoneycombIntegration();
            } else {
              throw new Error("Failed to create blockchain profile");
            }
          }

          // Prepare race stats for SPEEDY tokens
          const elapsedTime = Date.now() - gameStatsRef.current.gameStartTime;
          const raceStats = {
            raceId: Date.now(),
            completed: true,
            won: gameStateRef.current.currentScore > 0,
            distance: Math.floor(gameStatsRef.current.distance),
            obstaclesAvoided: gameStatsRef.current.obstaclesAvoided,
            bonusBoxesCollected: gameStatsRef.current.bonusBoxesCollected,
            lapTime: Math.floor(elapsedTime / 1000),
            score: Math.floor(gameStateRef.current.currentScore),
          };

          // Prepare game stats for Honeycomb
          const gameStats = {
            score: gameStatsRef.current.finalScore,
            distance: gameStatsRef.current.distance,
            obstaclesAvoided: gameStatsRef.current.obstaclesAvoided,
            bonusBoxesCollected: gameStatsRef.current.bonusBoxesCollected,
            lapTime: gameStatsRef.current.lapTime,
            gameCompleted: true,
          };

          const result =
            await combinedTransactionService.executeCombinedTransaction(
              wallet,
              raceStats,
              gameStats,
              currentHoneycomb.playerProfile,
              currentHoneycomb.honeycombProfile,
              currentHoneycomb.honeycombProject
            );

          if (result.success) {
            await loadSpeedyBalance();
            await currentHoneycomb.refreshHoneycombProfile();

            // Calculate XP display info
            const simpleXpCalculation = calculateSimpleXp({
              gameTime: gameStatsRef.current.lapTime,
              finalScore: gameStatsRef.current.finalScore,
              distanceTraveled: gameStatsRef.current.distance,
              obstaclesAvoided: gameStatsRef.current.obstaclesAvoided || 0,
            });

            // Create comprehensive success message
            let resultMessage = `🏁 Race Complete!\n\n📊 Final Stats:\n• Score: ${gameStatsRef.current.finalScore.toLocaleString()}\n• Distance: ${
              gameStatsRef.current.distance
            }m\n• Time: ${gameStatsRef.current.lapTime}s`;

            if (result.speedyTokensEarned > 0) {
              resultMessage += `\n\n💰 Earned ${result.speedyTokensEarned} SPEEDY tokens!`;
            }

            if (simpleXpCalculation.xpEarned > 0) {
              resultMessage += `\n\n🏆 Earned ${simpleXpCalculation.xpEarned} XP!`;
              resultMessage += `\n${simpleXpCalculation.breakdown}`;
            }

            resultMessage += `\n\n🚀 All data saved to blockchain! ⛓️`;
            showPopup(resultMessage);
            return;
          } else {
            const localSuccess = await currentHoneycomb.updateGameStats({
              score: gameStatsRef.current.finalScore,
              distance: gameStatsRef.current.distance,
              obstaclesAvoided: gameStatsRef.current.obstaclesAvoided,
              bonusBoxesCollected: gameStatsRef.current.bonusBoxesCollected,
              lapTime: gameStatsRef.current.lapTime,
              gameCompleted: true,
            });

            if (localSuccess) {
              showPopup(
                `⚠️ Blockchain update failed, but stats saved locally!\n\nError: ${
                  result.error || "Unknown error"
                }`
              );
            } else {
              showPopup(
                `❌ Both blockchain and local stats update failed!\n\nError: ${
                  result.error || "Unknown error"
                }`
              );
            }
          }
        } catch (combinedError) {
          showPopup(`❌ Combined transaction failed: ${combinedError.message}`);
        }
      } else if (canDoHoneycombBlockchain) {
        try {
          // First: Update Honeycomb blockchain stats
          const honeycombSuccess = await currentHoneycomb.updateOnChainStats(
            calculateSimpleXp({
              gameTime: gameStatsRef.current.lapTime,
              finalScore: gameStatsRef.current.finalScore,
              distanceTraveled: gameStatsRef.current.distance,
              obstaclesAvoided: gameStatsRef.current.obstaclesAvoided || 0,
            }).xpEarned,
            {
              gamesPlayed: (
                currentHoneycomb.playerProfile.gamesPlayed + 1
              ).toString(),
              highScore: Math.max(
                currentHoneycomb.playerProfile.highScore,
                gameStatsRef.current.finalScore
              ).toString(),
              totalDistance: (
                currentHoneycomb.playerProfile.totalDistance +
                gameStatsRef.current.distance
              ).toString(),
              totalObstaclesAvoided: (
                currentHoneycomb.playerProfile.totalObstaclesAvoided +
                gameStatsRef.current.obstaclesAvoided
              ).toString(),
              totalBonusBoxesCollected: (
                currentHoneycomb.playerProfile.totalBonusBoxesCollected +
                gameStatsRef.current.bonusBoxesCollected
              ).toString(),
            }
          );

          if (honeycombSuccess) {
            console.log("✅ Honeycomb blockchain stats updated!");
            // Update local profile as well
            const localSuccess = await currentHoneycomb.updateGameStats({
              score: gameStatsRef.current.finalScore,
              distance: gameStatsRef.current.distance,
              obstaclesAvoided: gameStatsRef.current.obstaclesAvoided,
              bonusBoxesCollected: gameStatsRef.current.bonusBoxesCollected,
              lapTime: gameStatsRef.current.lapTime,
              gameCompleted: true,
            });

            // Calculate display info
            const simpleXpCalculation = calculateSimpleXp({
              gameTime: gameStatsRef.current.lapTime,
              finalScore: gameStatsRef.current.finalScore,
              distanceTraveled: gameStatsRef.current.distance,
              obstaclesAvoided: gameStatsRef.current.obstaclesAvoided || 0,
            });

            let resultMessage = `🏁 Race Complete!\n\n📊 Final Stats:\n• Score: ${gameStatsRef.current.finalScore.toLocaleString()}\n• Distance: ${
              gameStatsRef.current.distance
            }m\n• Time: ${gameStatsRef.current.lapTime}s`;

            if (simpleXpCalculation.xpEarned > 0) {
              resultMessage += `\n\n🏆 Earned ${simpleXpCalculation.xpEarned} XP!`;
              resultMessage += `\n${simpleXpCalculation.breakdown}`;
            }

            resultMessage += `\n\n🚀 Stats saved to blockchain! ⛓️`;
            showPopup(resultMessage);

            await handleSpeedyTokenRewards();
          } else {
            throw new Error("Failed to update Honeycomb blockchain stats");
          }
        } catch (blockchainError) {
          console.error(
            "❌ Honeycomb blockchain update failed:",
            blockchainError
          );
          if (
            blockchainError.message?.includes("Failed to fetch") ||
            blockchainError.message?.includes("ERR_NAME_NOT_RESOLVED") ||
            blockchainError.message?.includes("Network")
          ) {
            showPopup("⚠️ Network issue - stats saved locally instead");
          } else {
            showPopup(
              `❌ Blockchain update failed: ${blockchainError.message}`
            );
          }

          // Fall back to local stats
          const localSuccess = await currentHoneycomb.updateGameStats({
            score: gameStatsRef.current.finalScore,
            distance: gameStatsRef.current.distance,
            obstaclesAvoided: gameStatsRef.current.obstaclesAvoided,
            bonusBoxesCollected: gameStatsRef.current.bonusBoxesCollected,
            lapTime: gameStatsRef.current.lapTime,
            gameCompleted: true,
          });

          if (localSuccess) {
            // Calculate display info for local success
            const simpleXpCalculation = calculateSimpleXp({
              gameTime: gameStatsRef.current.lapTime,
              finalScore: gameStatsRef.current.finalScore,
              distanceTraveled: gameStatsRef.current.distance,
              obstaclesAvoided: gameStatsRef.current.obstaclesAvoided || 0,
            });

            let resultMessage = `🏁 Race Complete!\n\n📊 Final Stats:\n• Score: ${gameStatsRef.current.finalScore.toLocaleString()}\n• Distance: ${
              gameStatsRef.current.distance
            }m\n• Time: ${gameStatsRef.current.lapTime}s`;

            if (simpleXpCalculation.xpEarned > 0) {
              resultMessage += `\n\n🏆 Earned ${simpleXpCalculation.xpEarned} XP!`;
              resultMessage += `\n${simpleXpCalculation.breakdown}`;
            }

            resultMessage += `\n\n📊 Stats saved locally (blockchain unavailable)`;
            showPopup(resultMessage);

            await handleSpeedyTokenRewards();
          }
        }
      } else {
        const success = await currentHoneycomb.updateGameStats({
          score: gameStatsRef.current.finalScore,
          distance: gameStatsRef.current.distance,
          obstaclesAvoided: gameStatsRef.current.obstaclesAvoided,
          bonusBoxesCollected: gameStatsRef.current.bonusBoxesCollected,
          lapTime: gameStatsRef.current.lapTime,
          gameCompleted: true,
        });

        if (success) {
          showPopup(
            "📊 Stats saved locally! Connect to blockchain for full features."
          );
          await handleSpeedyTokenRewards();
        } else {
          showPopup("❌ Stats update failed!");
        }
      }
    } catch (error) {
      showPopup("⚠️ Game ended with errors");
    }
  }, [checkAllMissionProgress, updateDisplayStats, showPopup]);

  const loadSpeedyBalance = useCallback(async () => {
    if (!wallet.publicKey) {
      setSpeedyBalance(0);
      return;
    }

    try {
      const balance = await speedyTokenService.getTokenBalance(
        wallet.publicKey.toString()
      );
      setSpeedyBalance(balance);
    } catch (error) {
      setSpeedyBalance(0);
    }
  }, [wallet.publicKey]);

  const handleSpeedyTokenRewards = useCallback(async () => {
    try {
      if (connected && wallet.publicKey && wallet.signTransaction) {
        const elapsedTime = Date.now() - gameStatsRef.current.gameStartTime;
        const raceStats: RaceStats = {
          raceId: Date.now(),
          completed: true,
          won: gameStateRef.current.currentScore > 0,
          distance: Math.floor(gameStatsRef.current.distance),
          obstaclesAvoided: gameStatsRef.current.obstaclesAvoided,
          bonusBoxesCollected: gameStatsRef.current.bonusBoxesCollected,
          lapTime: Math.floor(elapsedTime / 1000),
          score: Math.floor(gameStateRef.current.currentScore),
        };

        const tokenResult = await speedyTokenService.awardRaceTokens(
          wallet,
          raceStats
        );
        if (tokenResult.success) {
          await loadSpeedyBalance();
          showPopup(`🎉 Earned ${tokenResult.tokensEarned} SPEEDY tokens!`);
        } else {
          showPopup("⚠️ Token reward failed - stats still saved!");
        }
      }
    } catch (tokenError) {
      showPopup("⚠️ Token reward failed");
    }
  }, [connected, wallet, showPopup, loadSpeedyBalance]);

  const calculateSimpleXp = (gameData: {
    gameTime: number;
    finalScore: number;
    distanceTraveled: number;
    obstaclesAvoided: number;
  }) => {
    let xpEarned = 0;
    const breakdown: string[] = [];

    // Time-based XP (1 XP per minute played)
    const timeXp = Math.floor(gameData.gameTime / 60);
    if (timeXp > 0) {
      xpEarned += timeXp;
      breakdown.push(`⏱️ Time: +${timeXp} XP`);
    }

    // Score-based XP (5 XP per 500 points)
    const scoreXp = Math.floor(gameData.finalScore / 500) * 5;
    if (scoreXp > 0) {
      xpEarned += scoreXp;
      breakdown.push(`🎯 Score: +${scoreXp} XP`);
    }

    // Distance-based XP (10 XP per 1000m)
    const distanceXp = Math.floor(gameData.distanceTraveled / 1000) * 10;
    if (distanceXp > 0) {
      xpEarned += distanceXp;
      breakdown.push(`🏁 Distance: +${distanceXp} XP`);
    }

    // Obstacle avoidance bonus
    const avoidanceXp = Math.floor(gameData.obstaclesAvoided / 10) * 2;
    if (avoidanceXp > 0) {
      xpEarned += avoidanceXp;
      breakdown.push(`🚧 Avoidance: +${avoidanceXp} XP`);
    }

    return {
      xpEarned,
      breakdown: breakdown.join("\n"),
    };
  };

  // Removed standalone awardSpeedyTokens function - now integrated into endGame()

  // Removed standalone awardWelcomeBonus function - welcome bonus will be offered after first game

  // Load balance when wallet connects - NO WELCOME BONUS DURING STARTUP
  useEffect(() => {
    if (connected && wallet.publicKey) {
      loadSpeedyBalance();
      // Welcome bonus will be offered after first game completion to avoid startup wallet popup
    } else {
      setSpeedyBalance(0);
    }
  }, [connected, wallet.publicKey]);

  const restartGame = useCallback(async () => {
    console.log("🏁 STARTING GAME - NO WALLET APPROVALS DURING GAME START");

    // Allow game to start immediately - profile creation will happen AFTER game ends
    // This eliminates all wallet popups during game startup

    setGameRunning(false);
    gameRunningRef.current = false;

    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
    }

    if (sceneRef.current) {
      obstaclesRef.current.forEach((obstacle) =>
        sceneRef.current!.remove(obstacle)
      );
      bonusBoxesRef.current.forEach((box) => sceneRef.current!.remove(box));
      goldenKeysRef.current.forEach((key) => sceneRef.current!.remove(key));
    }

    obstaclesRef.current = [];
    bonusBoxesRef.current = [];
    goldenKeysRef.current = [];

    setScore(0);
    setSpeed(1.0);
    setGameOver(false);
    setInvisibilityActive(false);
    setInvisibilityCountdown(0);
    setShowMissionComplete(null);

    gameStateRef.current = {
      carPosition: 0,
      targetCarPosition: 0,
      baseGameSpeed: 0.008,
      speedMultiplier: 1.0,
      obstacleSpawnRate: 0.015,
      nextBonusThreshold: 70,
      gameStartTime: Date.now(),
      nextKeySpawnTime: 15,
      keySpawnInterval: 30,
      isInvisible: false,
      invisibilityTimer: 0,
      currentScore: 0,
      missionCheckpoints: {
        firstRide: false,
        speedRunner: false,
        collectorMaster: false,
        obstaclemaster: false,
        distanceLegend: false,
      },
    };

    gameStatsRef.current = {
      distance: 0,
      obstaclesAvoided: 0,
      bonusBoxesCollected: 0,
      gameStartTime: Date.now(),
      finalScore: 0,
      lapTime: 0,
    };

    setGameStatsDisplay({
      distance: 0,
      obstaclesAvoided: 0,
      bonusBoxesCollected: 0,
    });

    if (carRef.current) {
      carRef.current.position.set(0, 0, 8);
      carRef.current.children.forEach((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(mat => {
              mat.transparent = false;
              (mat as any).opacity = 1.0;
            });
          } else {
            mesh.material.transparent = false;
            (mesh.material as any).opacity = 1.0;
          }
        }
      });
    }

    if (invisibilityIndicatorRef.current) {
      invisibilityIndicatorRef.current.visible = false;
    }

    createRoadLines();

    setTimeout(() => {
      console.log("🚀 Starting new game");
      setGameRunning(true);
      gameRunningRef.current = true;
      setTimeout(() => {
        animate();
      }, 50);
    }, 100);
  }, [createRoadLines, animate]);

  // Initialize Three.js scene
  const init = useCallback(() => {
    if (!mountRef.current) {
      console.log("❌ Mount ref not available");
      return;
    }

    console.log("🎮 Initializing Three.js scene...");

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x888888, 70, 150);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 12, 15);
    camera.lookAt(0, 0, -5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x87ceeb, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    while (mountRef.current.firstChild) {
      mountRef.current.removeChild(mountRef.current.firstChild);
    }
    mountRef.current.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const roadGeometry = new THREE.PlaneGeometry(12, 4000);
    const roadMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const road = new THREE.Mesh(roadGeometry, roadMaterial);
    road.rotation.x = -Math.PI / 2;
    road.position.y = -0.01;
    road.position.z = -1000;
    road.receiveShadow = true;
    scene.add(road);
    roadRef.current = road;

    createRoadLines();

    const carGroup = new THREE.Group();

    const bodyGeometry = new THREE.BoxGeometry(2.2, 0.6, 3);
    const bodyMaterial = new THREE.MeshLambertMaterial({
      color: connected ? 0xff4444 : 0x666666,
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.8;
    body.castShadow = true;
    carGroup.add(body);

    if (connected) {
      const logoGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.05, 6);
      const logoMaterial = new THREE.MeshLambertMaterial({ color: 0xffd700 });
      const logo = new THREE.Mesh(logoGeometry, logoMaterial);
      logo.position.set(0, 1.1, 0.5);
      logo.rotation.x = -Math.PI / 2;
      carGroup.add(logo);
    }

    const roofGeometry = new THREE.BoxGeometry(1.8, 0.4, 1.5);
    const roofMaterial = new THREE.MeshLambertMaterial({
      color: connected ? 0xcc3333 : 0x555555,
    });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = 1.2;
    roof.position.z = -0.2;
    roof.castShadow = true;
    carGroup.add(roof);

    const wheelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.2);
    const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 });
    [
      [-1.0, 0.3, 1.2],
      [1.0, 0.3, 1.2],
      [-1.0, 0.3, -1.2],
      [1.0, 0.3, -1.2],
    ].forEach((pos) => {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(pos[0], pos[1], pos[2]);
      wheel.castShadow = true;
      carGroup.add(wheel);
    });

    const indicatorGeometry = new THREE.SphereGeometry(0.3);
    const indicatorMaterial = new THREE.MeshLambertMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.8,
    });
    const invisibilityIndicator = new THREE.Mesh(
      indicatorGeometry,
      indicatorMaterial
    );
    invisibilityIndicator.position.set(0, 2, 0);
    invisibilityIndicator.visible = false;
    carGroup.add(invisibilityIndicator);
    invisibilityIndicatorRef.current = invisibilityIndicator;

    carGroup.position.set(0, 0, 8);
    scene.add(carGroup);
    carRef.current = carGroup;

    // Apply NFT car appearance if one is selected
    updateCarAppearance(selectedNFTCar);

    // Initialize stats
    gameStatsRef.current = {
      distance: 0,
      obstaclesAvoided: 0,
      bonusBoxesCollected: 0,
      gameStartTime: Date.now(),
      finalScore: 0,
      lapTime: 0,
    };

    updateDisplayStats();

    console.log("✅ Three.js scene initialized successfully");
    console.log("🚀 Starting game");

    setGameRunning(true);
    gameRunningRef.current = true;

    setTimeout(() => {
      console.log("🎮 Starting animation loop...");
      animate();
    }, 50);
  }, [connected, createRoadLines, updateDisplayStats, animate]);

  // Start the game immediately when ready - NO PROFILE CHECKS
  useEffect(() => {
    if (gameReadyToStart && !gameRunning && !gameOver) {
      console.log(
        "🎮 Game ready to start - initializing Three.js scene (no wallet approvals)..."
      );
      const timer = setTimeout(() => {
        init();
      }, 500);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [gameReadyToStart, gameRunning, gameOver, init]);

  // Setup controls
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.code) {
        case "KeyA":
        case "ArrowLeft":
          keysRef.current.left = true;
          break;
        case "KeyD":
        case "ArrowRight":
          keysRef.current.right = true;
          break;
        case "ArrowUp":
          keysRef.current.up = true;
          break;
        case "ArrowDown":
          keysRef.current.down = true;
          break;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      switch (event.code) {
        case "KeyA":
        case "ArrowLeft":
          keysRef.current.left = false;
          break;
        case "KeyD":
        case "ArrowRight":
          keysRef.current.right = false;
          break;
        case "ArrowUp":
          keysRef.current.up = false;
          break;
        case "ArrowDown":
          keysRef.current.down = false;
          break;
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!gameRunningRef.current || !rendererRef.current) return;

      const rect = rendererRef.current.domElement.getBoundingClientRect();
      const mouseXNormalized =
        ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const mouseYNormalized =
        ((event.clientY - rect.top) / rect.height) * 2 - 1;

      gameStateRef.current.targetCarPosition = Math.max(
        -1,
        Math.min(1, mouseXNormalized)
      );

      const baseSpeedMultiplier = traitBonuses.speedMultiplier || 1;
      gameStateRef.current.speedMultiplier = Math.max(
        0.2,
        Math.min(2.0 * baseSpeedMultiplier, 1.0 - mouseYNormalized * 0.5)
      );
    };

    const handleResize = () => {
      if (cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = window.innerWidth / window.innerHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(window.innerWidth, window.innerHeight);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    document.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("resize", handleResize);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
      document.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
    };
  }, [traitBonuses.speedMultiplier]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (rendererRef.current && mountRef.current) {
        try {
          if (mountRef.current.contains(rendererRef.current.domElement)) {
            mountRef.current.removeChild(rendererRef.current.domElement);
          }
          rendererRef.current.dispose();
        } catch (error) {
          console.error("Cleanup error:", error);
        }
      }
    };
  }, []);

  // Show loading screen if not connected
  if (!connected) {
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
          fontSize: "24px",
          textAlign: "center",
        }}
      >
        <div>
          <div style={{ fontSize: "48px", marginBottom: "20px" }}>🍯</div>
          <div>Please connect your wallet to start racing!</div>
          <div style={{ fontSize: "16px", opacity: 0.8, marginTop: "10px" }}>
            Your Honeycomb profile will be created automatically
          </div>
        </div>
      </div>
    );
  }

  // Show initialization screen
  if (initializationStatus === "in_progress" || honeycombLoading) {
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
          fontSize: "24px",
          textAlign: "center",
        }}
      >
        <div>
          <div style={{ fontSize: "48px", marginBottom: "20px" }}>🍯</div>
          <div>Initializing Honeycomb Protocol...</div>
          <div style={{ fontSize: "16px", opacity: 0.8, marginTop: "10px" }}>
            Setting up your on-chain racing profile
          </div>
          <div
            style={{
              fontSize: "14px",
              opacity: 0.6,
              marginTop: "15px",
              maxWidth: "400px",
            }}
          >
            This will prompt your wallet for approval to create your blockchain
            profile. This only happens once per wallet.
          </div>

          {initializationStatus === "in_progress" && (
            <div
              style={{ fontSize: "12px", color: "#ffaa00", marginTop: "20px" }}
            >
              ⏳ Please approve the transaction in your wallet...
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show initialization error screen
  if (initializationStatus === "failed" && !gameReadyToStart) {
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
          fontSize: "24px",
          textAlign: "center",
        }}
      >
        <div>
          <div style={{ fontSize: "48px", marginBottom: "20px" }}>⚠️</div>
          <div>Blockchain Integration Failed</div>
          <div
            style={{
              fontSize: "16px",
              opacity: 0.8,
              marginTop: "10px",
              maxWidth: "400px",
            }}
          >
            {initializationError || "Could not connect to Honeycomb Protocol"}
          </div>
          <div
            style={{ fontSize: "14px", color: "#88ff88", marginTop: "15px" }}
          >
            Don't worry! You can still play the game with local progress saving.
          </div>

          <button
            onClick={() => setGameReadyToStart(true)}
            style={{
              background: "linear-gradient(45deg, #ffd700, #ffed4e)",
              border: "none",
              color: "black",
              padding: "15px 30px",
              fontSize: "18px",
              borderRadius: "10px",
              cursor: "pointer",
              fontWeight: "bold",
              marginTop: "25px",
            }}
          >
            Continue with Local Mode
          </button>
        </div>
      </div>
    );
  }

  // Remove profile creation requirement screen - allow immediate gameplay

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        zIndex: 1,
      }}
    >
      <div
        ref={mountRef}
        style={{
          width: "100%",
          height: "100%",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      />

      {/* Game UI */}
      <div
        style={{
          position: "absolute",
          top: "80px",
          left: "20px",
          color: "white",
          fontSize: "24px",
          fontWeight: "bold",
          textShadow: "2px 2px 4px rgba(0,0,0,0.5)",
        }}
      >
        <div>Score: {score.toLocaleString()}</div>
        <div>Speed: {speed.toFixed(1)}x</div>
        <div style={{ fontSize: "16px" }}>
          Distance: {gameStatsDisplay.distance}m
        </div>
        <div style={{ fontSize: "14px", opacity: 0.8 }}>
          Obstacles Avoided: {gameStatsDisplay.obstaclesAvoided}
        </div>
        <div style={{ fontSize: "14px", opacity: 0.8 }}>
          Bonus Collected: {gameStatsDisplay.bonusBoxesCollected}
        </div>
        {playerProfile && (
          <div style={{ fontSize: "14px", marginTop: "10px" }}>
            <div>
              Level {playerProfile.level} • XP: {playerProfile.totalXp}
            </div>
            <div style={{ fontSize: "12px", opacity: 0.8 }}>
              High Score: {playerProfile.highScore.toLocaleString()}
            </div>
            <div style={{ fontSize: "12px", opacity: 0.8 }}>
              Games Played: {playerProfile.gamesPlayed}
            </div>
          </div>
        )}

        {/* SPEEDY Token Balance */}
        <div
          style={{
            fontSize: "16px",
            marginTop: "15px",
            padding: "8px",
            background: "rgba(255, 215, 0, 0.2)",
            borderRadius: "6px",
            border: "1px solid rgba(255, 215, 0, 0.5)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "18px" }}>🚀</span>
            <span style={{ color: "#FFD700" }}>
              SPEEDY: {speedyBalance.toLocaleString()}
            </span>
          </div>
          {isAwardingTokens && (
            <div
              style={{
                fontSize: "12px",
                color: "#FFD700",
                marginTop: "4px",
                opacity: 0.8,
              }}
            >
              {tokenRewardMessage}
            </div>
          )}
        </div>

        {/* Selected NFT Car Info */}
        {selectedNFTCar && (
          <div
            style={{
              fontSize: "14px",
              marginTop: "10px",
              padding: "8px",
              background: "rgba(255, 107, 53, 0.2)",
              borderRadius: "6px",
              border: "1px solid rgba(255, 107, 53, 0.5)",
            }}
          >
            <div style={{ color: "#ff6b35", fontWeight: "bold", marginBottom: "4px" }}>
              🏎️ {selectedNFTCar.name}
            </div>
            <div style={{ fontSize: "12px", color: "#FFD700" }}>
              {selectedNFTCar.traits.rarity.toUpperCase()} • Speed: {selectedNFTCar.traits.speed}
            </div>
          </div>
        )}

        <div style={{ fontSize: "12px", marginTop: "5px" }}>
          Status: {profileReady ? "✅ Ready" : "⏳ Loading"} | Honeycomb:{" "}
          {honeycombStatus === "created"
            ? "🚀 On-Chain"
            : honeycombStatus === "error"
            ? "❌ Error"
            : honeycombStatus === "ready" &&
              honeycombProfile?.address === "pending-user-creation"
            ? "🆕 Profile Needed"
            : initializationStatus === "completed"
            ? "✅ Ready"
            : initializationStatus === "failed"
            ? "❌ Failed"
            : "⏳ Connecting"}
        </div>

        {honeycombStatus === "created" && (
          <div style={{ fontSize: "11px", color: "#00ff88", marginTop: "2px" }}>
            🔗 Profile created on Solana blockchain
          </div>
        )}
        {initializationStatus === "failed" && (
          <div style={{ fontSize: "11px", color: "#ffaa00", marginTop: "2px" }}>
            📱 Playing in local mode
          </div>
        )}
        {invisibilityActive && (
          <div
            style={{ color: "#ffff00", fontSize: "20px", marginTop: "10px" }}
          >
            ⚡ INVISIBLE MODE: {invisibilityCountdown}s ⚡
          </div>
        )}
      </div>

      {/* NFT Car Selector Button */}
      <div
        style={{
          position: "absolute",
          top: "80px",
          right: "20px",
          zIndex: 100,
        }}
      >
        <button
          onClick={() => setShowCarSelector(true)}
          disabled={!connected || gameRunning}
          style={{
            background: selectedNFTCar 
              ? "linear-gradient(45deg, #ff6b35, #ffa726)" 
              : "rgba(0,0,0,0.7)",
            border: selectedNFTCar ? "2px solid #ff6b35" : "2px solid #ffd700",
            color: "white",
            padding: "10px 15px",
            borderRadius: "8px",
            cursor: connected && !gameRunning ? "pointer" : "not-allowed",
            fontSize: "14px",
            fontWeight: "bold",
            textShadow: "1px 1px 2px rgba(0,0,0,0.5)",
            marginBottom: "10px",
            opacity: connected && !gameRunning ? 1 : 0.5,
          }}
        >
          🏎️ {selectedNFTCar ? `${selectedNFTCar.name}` : 'Select NFT Car'}
        </button>

        {/* Trait Bonuses Display */}
        {Object.keys(traitBonuses).length > 0 && (
          <div
            style={{
              color: "white",
              fontSize: "13px",
              textShadow: "2px 2px 4px rgba(0,0,0,0.5)",
              background: "rgba(0,0,0,0.7)",
              padding: "10px",
              borderRadius: "8px",
              border: selectedNFTCar ? "1px solid #ff6b35" : "1px solid #ffd700",
              maxWidth: "200px",
            }}
          >
            <div style={{ 
              color: selectedNFTCar ? "#ff6b35" : "#ffd700", 
              marginBottom: "5px",
              fontWeight: "bold" 
            }}>
              {selectedNFTCar ? "🏎️ NFT Car Bonuses:" : "🍯 Active Bonuses:"}
            </div>
            {traitBonuses.speedMultiplier && traitBonuses.speedMultiplier > 1 && (
              <div style={{ fontSize: "12px", marginBottom: "2px" }}>
                🏃 Speed: +{((traitBonuses.speedMultiplier - 1) * 100).toFixed(0)}%
              </div>
            )}
            {traitBonuses.bonusSpawnRate && traitBonuses.bonusSpawnRate > 1 && (
              <div style={{ fontSize: "12px", marginBottom: "2px" }}>
                💰 Bonus Rate: +{((traitBonuses.bonusSpawnRate - 1) * 100).toFixed(0)}%
              </div>
            )}
            {traitBonuses.invisibilityDuration && traitBonuses.invisibilityDuration > 15 && (
              <div style={{ fontSize: "12px", marginBottom: "2px" }}>
                ⚡ Invisibility: +{traitBonuses.invisibilityDuration - 15}s
              </div>
            )}
            {traitBonuses.accelerationBonus && traitBonuses.accelerationBonus > 1 && (
              <div style={{ fontSize: "12px", marginBottom: "2px" }}>
                🚀 Acceleration: +{((traitBonuses.accelerationBonus - 1) * 100).toFixed(0)}%
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div
        style={{
          position: "absolute",
          bottom: "20px",
          left: "20px",
          zIndex: 100,
          color: "white",
          fontSize: "16px",
          textShadow: "2px 2px 4px rgba(0,0,0,0.5)",
        }}
      >
        Use A/D or Arrow Keys to move • Up/Down arrows or mouse Y-axis to
        control speed
        <br />
        🍯 Honeycomb boxes = +30 points • 🗝️ Golden keys = Invisibility power-up
        <br />
        🏎️ Click "Select NFT Car" to race with enhanced performance from your collection!
      </div>

      {/* Game Over Screen */}
      {gameOver && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 200,
            background: "rgba(0,0,0,0.9)",
            color: "white",
            padding: "40px",
            borderRadius: "20px",
            textAlign: "center",
            border: "3px solid #ffd700",
            maxWidth: "500px",
          }}
        >
          <div style={{ fontSize: "48px", marginBottom: "15px" }}>🍯</div>
          <h2 style={{ color: "#ffd700" }}>Race Complete!</h2>
          <div style={{ marginBottom: "20px" }}>
            <p>
              <strong>Score:</strong> {score.toLocaleString()}
            </p>
            <p>
              <strong>Distance:</strong> {gameStatsDisplay.distance}m
            </p>
            <p>
              <strong>Obstacles Avoided:</strong>{" "}
              {gameStatsDisplay.obstaclesAvoided}
            </p>
            <p>
              <strong>Honeycomb Collected:</strong>{" "}
              {gameStatsDisplay.bonusBoxesCollected}
            </p>
            <p>
              <strong>Lap Time:</strong>{" "}
              {gameStatsRef.current.lapTime > 0
                ? `${gameStatsRef.current.lapTime.toFixed(1)}s`
                : "N/A"}
            </p>
            {playerProfile && (
              <div style={{ marginTop: "15px", fontSize: "14px" }}>
                <p style={{ color: "#ffd700" }}>
                  <strong>Player Level:</strong> {playerProfile.level} (XP:{" "}
                  {playerProfile.totalXp})
                </p>
                <p>
                  <strong>Career High Score:</strong>{" "}
                  {playerProfile.highScore.toLocaleString()}
                </p>
                <p>
                  <strong>Total Games:</strong> {playerProfile.gamesPlayed}
                </p>
                <p
                  style={{ fontSize: "12px", opacity: 0.8, marginTop: "10px" }}
                >
                  {honeycombStatus === "created"
                    ? "🔗 Profile exists on Solana blockchain via Honeycomb Protocol"
                    : initializationStatus === "failed"
                    ? "📱 Stats saved locally"
                    : "📊 Stats saved locally"}
                </p>
              </div>
            )}
          </div>

          {/* Show recent achievements */}
          {playerProfile && getRecentAchievements().length > 0 && (
            <div style={{ marginBottom: "20px", fontSize: "12px" }}>
              <p style={{ color: "#ffd700" }}>Recent Achievements:</p>
              {getRecentAchievements()
                .slice(-3)
                .map((achievement, index) => (
                  <div key={index} style={{ margin: "2px 0" }}>
                    🏆 {achievement}
                  </div>
                ))}
            </div>
          )}

          <button
            onClick={restartGame}
            style={{
              background: "linear-gradient(45deg, #ffd700, #ffed4e)",
              border: "none",
              color: "black",
              padding: "15px 30px",
              fontSize: "18px",
              borderRadius: "10px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            🏁 Race Again!
          </button>
        </div>
      )}

      {/* Mission Complete Popup */}
      {showMissionComplete && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 150,
            background: "rgba(0,0,0,0.9)",
            color: "#ffd700",
            padding: "20px 30px",
            borderRadius: "10px",
            fontSize: "24px",
            fontWeight: "bold",
            textAlign: "center",
            border: "2px solid #ffd700",
          }}
        >
          {showMissionComplete}
        </div>
      )}

      {/* NFT Car Selector Modal */}
      <NFTCarSelector
        onCarSelected={handleCarSelected}
        selectedCar={selectedNFTCar}
        show={showCarSelector}
        onClose={() => setShowCarSelector(false)}
      />
    </div>
  );
};

export default HoneycombCarGame;
