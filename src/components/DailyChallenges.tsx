// Daily Challenges Component - Official Honeycomb Mission System
// Based on https://docs.honeycombprotocol.com/missions

import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { missionService, type CharacterMissionStatus } from '../services/missionService';

interface MissionData {
  address: string;
  name: string;
  description: string;
  duration: number; // Duration in hours
  costAmount: string;
  minXp: string;
  xpReward: { min: string; max: string };
  resourceReward: { min: string; max: string };
  icon: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

const AVAILABLE_MISSIONS: MissionData[] = [
  {
    address: '', // Will be populated after creation
    name: 'Daily Sprint',
    description: 'Quick 1-hour mission for fast rewards',
    duration: 1,
    costAmount: '50000', // 0.05 SPEEDY tokens
    minXp: '0',
    xpReward: { min: '25', max: '50' },
    resourceReward: { min: '25000', max: '75000' },
    icon: '🏃',
    difficulty: 'Easy'
  },
  {
    address: '',
    name: 'Speed Demon Challenge',
    description: 'Complete a 4-hour racing mission to earn XP and SPEEDY tokens',
    duration: 4,
    costAmount: '100000', // 0.1 SPEEDY tokens
    minXp: '0',
    xpReward: { min: '100', max: '200' },
    resourceReward: { min: '50000', max: '150000' },
    icon: '🏎️',
    difficulty: 'Medium'
  },
  {
    address: '',
    name: 'Endurance Race',
    description: 'Complete an 8-hour endurance mission for bigger rewards',
    duration: 8,
    costAmount: '200000', // 0.2 SPEEDY tokens
    minXp: '100',
    xpReward: { min: '250', max: '400' },
    resourceReward: { min: '150000', max: '300000' },
    icon: '🏁',
    difficulty: 'Hard'
  }
];

export const DailyChallenges: React.FC = () => {
  const { connected, publicKey, wallet, signTransaction, signAllTransactions } = useWallet();
  
  // Mission system state
  const [missionPoolAddress, setMissionPoolAddress] = useState<string | null>(null);
  const [availableMissions, setAvailableMissions] = useState<MissionData[]>(AVAILABLE_MISSIONS);
  const [characterMissionStatus, setCharacterMissionStatus] = useState<CharacterMissionStatus | null>(null);
  
  // UI state
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [setupLog, setSetupLog] = useState<string[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<string>('');
  const [userCharacters, setUserCharacters] = useState<any[]>([]);

  // Setup state
  const [setupComplete, setSetupComplete] = useState(false);

  const addLog = (message: string) => {
    console.log(message);
    setSetupLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  // Check for existing mission setup
  useEffect(() => {
    checkExistingSetup();
    if (connected && publicKey) {
      loadUserCharacters();
      if (selectedCharacter) {
        checkCharacterMissionStatus();
      }
    }
  }, [connected, publicKey, selectedCharacter]);

  const checkExistingSetup = () => {
    const saved = localStorage.getItem('honeycomb_mission_setup');
    if (saved) {
      try {
        const setup = JSON.parse(saved);
        setMissionPoolAddress(setup.missionPoolAddress);
        if (setup.missions) {
          setAvailableMissions(prev => prev.map((mission, index) => ({
            ...mission,
            address: setup.missions[index] || ''
          })));
        }
        setSetupComplete(!!setup.missionPoolAddress);
        addLog('✅ Found existing mission setup');
      } catch (error) {
        console.error('Error loading saved setup:', error);
      }
    }
  };

  const loadUserCharacters = async () => {
    if (!connected || !publicKey) return;

    try {
      // Load characters from localStorage or fetch from Honeycomb
      const savedCharacters = localStorage.getItem('user_characters');
      if (savedCharacters) {
        const characters = JSON.parse(savedCharacters);
        setUserCharacters(characters);
        
        // Check if there's a previously selected character
        const savedSelectedCharacter = localStorage.getItem('selected_character_address');
        if (savedSelectedCharacter && characters.some(char => char.address === savedSelectedCharacter)) {
          setSelectedCharacter(savedSelectedCharacter);
          console.log('✅ Loaded previously selected character:', savedSelectedCharacter);
        } else if (characters.length > 0 && !selectedCharacter) {
          setSelectedCharacter(characters[0].address);
        }
      }
    } catch (error) {
      console.error('Error loading user characters:', error);
    }
  };

  const checkCharacterMissionStatus = async () => {
    if (!selectedCharacter) return;

    try {
      const status = await missionService.getCharacterMissionStatus(selectedCharacter);
      setCharacterMissionStatus(status);
    } catch (error) {
      console.error('Error checking character mission status:', error);
    }
  };

  const resetMissionSetup = () => {
    // Clear ALL honeycomb related localStorage
    localStorage.removeItem('honeycomb_mission_setup');
    localStorage.removeItem('honeycomb_resources');
    localStorage.removeItem('honeycomb_missions');
    localStorage.removeItem('honeycomb_nft_config');
    localStorage.removeItem('selected_character_address');
    
    // Reset all component state
    setSetupComplete(false);
    setMissionPoolAddress(null);
    setAvailableMissions(AVAILABLE_MISSIONS.map(m => ({ ...m, address: '' })));
    setSelectedCharacter('');
    setUserCharacters([]);
    setCharacterMissionStatus(null);
    
    addLog('🔄 ALL mission data cleared - ready for fresh setup with new project');
    addLog('💡 Make sure to restart the app if issues persist');
  };



  const setupMissionSystem = async () => {
    if (!connected || !wallet || !publicKey) {
      addLog('❌ Please connect your wallet first');
      return;
    }

    setIsSettingUp(true);
    setSetupLog([]);

    try {
      addLog('🚀 Setting up Honeycomb Mission System...');
      addLog('📋 This will create mission pools and daily challenge missions');

      // Get character model address from localStorage
      const nftConfig = localStorage.getItem('honeycomb_nft_config');
      if (!nftConfig) {
        addLog('❌ No character model found. Please setup NFT infrastructure first.');
        return;
      }

      const config = JSON.parse(nftConfig);
      const characterModelAddress = config.characterModelAddress;
      addLog(`🔍 Using character model: ${characterModelAddress}`);

      // Step 1: Create Mission Pool
      addLog('🏊 Step 1: Creating mission pool...');
      const poolAddress = await missionService.createMissionPool(
        { publicKey, signTransaction, signAllTransactions, adapter: wallet.adapter },
        characterModelAddress,
        "Daily Racing Challenges"
      );
      setMissionPoolAddress(poolAddress);
      addLog(`✅ Mission pool created: ${poolAddress}`);

      // Step 1.5: Create fresh SPEEDY resource (clear ALL old cache)
      addLog('💎 Creating fresh SPEEDY token resource...');
      localStorage.removeItem('honeycomb_resources'); // Clear old cached resources
      localStorage.removeItem('honeycomb_missions'); // Clear old cached missions
      localStorage.removeItem('honeycomb_mission_setup'); // Clear old mission setup
      
      // Reset component state to ensure fresh setup
      setSetupComplete(false);
      setAvailableMissions(AVAILABLE_MISSIONS.map(m => ({ ...m, address: '' })));
      
      const resourceAddress = await missionService.createSpeedyResource(
        { publicKey, signTransaction, signAllTransactions, adapter: wallet.adapter }
      );
      addLog(`✅ SPEEDY resource created: ${resourceAddress}`);
      
      // Save new resource for future use
      const resources = { speedyToken: resourceAddress };
      localStorage.setItem('honeycomb_resources', JSON.stringify(resources));

      // Step 2: Create daily challenge missions
      addLog('🎯 Step 2: Creating daily challenge missions...');
      addLog(`🔍 Using resource address for missions: ${resourceAddress}`);
      
      if (!resourceAddress) {
        throw new Error('Resource address is empty - SPEEDY token import may have failed');
      }
      
      const missionAddresses = await missionService.createDefaultDailyChallenges(
        { publicKey, signTransaction, signAllTransactions, adapter: wallet.adapter },
        poolAddress,
        resourceAddress
      );

      // Update available missions with addresses
      setAvailableMissions(prev => prev.map((mission, index) => ({
        ...mission,
        address: missionAddresses[index] || ''
      })));

      // Save setup to localStorage
      const setupData = {
        missionPoolAddress: poolAddress,
        missions: missionAddresses,
        characterModel: characterModelAddress,
        resourceAddress: resourceAddress,
        createdAt: new Date().toISOString()
      };
      localStorage.setItem('honeycomb_mission_setup', JSON.stringify(setupData));

      setSetupComplete(true);
      addLog('');
      addLog('🎉 MISSION SYSTEM SETUP COMPLETE!');
      addLog('✅ Mission pool and daily challenges are ready');
      addLog('🚀 Players can now participate in daily missions');

    } catch (error: any) {
      addLog(`❌ Setup failed: ${error.message}`);
      console.error('Mission setup error:', error);
    } finally {
      setIsSettingUp(false);
    }
  };

  const startMission = async (mission: MissionData) => {
    if (!connected || !wallet || !selectedCharacter) {
      alert('Please connect wallet and select a character');
      return;
    }

    if (!mission.address) {
      alert('Mission not available. Please setup missions first.');
      return;
    }

    setIsLoading(true);
    try {
      addLog(`🚀 Starting mission: ${mission.name}`);
      addLog(`🔍 Mission address: ${mission.address}`);
      addLog(`🔍 Character address: ${selectedCharacter}`);
      
      // Check what resource was used in setup
      const setupData = localStorage.getItem('honeycomb_mission_setup');
      if (setupData) {
        const setup = JSON.parse(setupData);
        addLog(`🔍 Stored resource address: ${setup.resourceAddress}`);
      }
      
      const signatures = await missionService.sendCharacterOnMission(
        { publicKey, signTransaction, signAllTransactions, adapter: wallet.adapter },
        mission.address,
        selectedCharacter
      );

      addLog(`✅ Character sent on mission successfully!`);
      addLog(`📋 Signatures: ${signatures.join(', ')}`);
      
      // Refresh character status
      await checkCharacterMissionStatus();
      
    } catch (error: any) {
      addLog(`❌ Failed to start mission: ${error.message}`);
      console.error('Start mission error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const recallCharacter = async () => {
    if (!connected || !wallet || !characterMissionStatus) {
      return;
    }

    setIsLoading(true);
    try {
      addLog(`🏁 Recalling character from mission...`);
      
      const signatures = await missionService.recallCharacterFromMission(
        { publicKey, signTransaction, signAllTransactions, adapter: wallet.adapter },
        characterMissionStatus.missionAddress,
        characterMissionStatus.characterAddress
      );

      addLog(`✅ Character recalled successfully!`);
      addLog(`🎁 Rewards have been automatically claimed`);
      addLog(`📋 Signatures: ${signatures.join(', ')}`);
      
      // Refresh character status
      await checkCharacterMissionStatus();
      
    } catch (error: any) {
      addLog(`❌ Failed to recall character: ${error.message}`);
      console.error('Recall character error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimeRemaining = (endTime: number) => {
    const now = Date.now();
    const remaining = Math.max(0, endTime - now);
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy': return '#28a745';
      case 'Medium': return '#ffc107';
      case 'Hard': return '#dc3545';
      default: return '#6c757d';
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', color: 'white' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '30px' }}>
        🎯 Daily Challenges - Honeycomb Mission System
      </h2>

      {/* Connection Status */}
      <div style={{
        background: connected ? 'rgba(40, 167, 69, 0.2)' : 'rgba(220, 53, 69, 0.2)',
        padding: '15px',
        borderRadius: '10px',
        marginBottom: '20px',
        border: `1px solid ${connected ? '#28a745' : '#dc3545'}`
      }}>
        <h4>System Status</h4>
        <p><strong>Wallet:</strong> {connected ? `✅ ${publicKey?.toString().substring(0, 8)}...` : '❌ Not connected'}</p>
        <p><strong>Mission System:</strong> {setupComplete ? '✅ Ready' : '⚠️ Setup required'}</p>
        <p><strong>Selected Character:</strong> {selectedCharacter ? `✅ ${selectedCharacter.substring(0, 8)}...` : '❌ No character selected'}</p>
      </div>

      {/* Character Selection */}
      {userCharacters.length > 0 && (
        <div style={{
          background: 'rgba(0, 123, 255, 0.1)',
          padding: '15px',
          borderRadius: '10px',
          marginBottom: '20px',
          border: '1px solid #007bff'
        }}>
          <h4>Select Character for Missions</h4>
          <select
            value={selectedCharacter}
            onChange={(e) => {
              const newSelection = e.target.value;
              setSelectedCharacter(newSelection);
              localStorage.setItem('selected_character_address', newSelection);
              console.log('✅ Character selection updated:', newSelection);
            }}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '5px',
              background: 'rgba(255, 255, 255, 0.1)',
              color: 'white',
              border: '1px solid #007bff'
            }}
          >
            {userCharacters.map((char, index) => (
              <option key={char.address || index} value={char.address || ''} style={{ background: '#333' }}>
                {char.name || `Character ${index + 1}`} - {char.address?.substring(0, 8)}...
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Character Mission Status */}
      {characterMissionStatus && (
        <div style={{
          background: characterMissionStatus.isActive ? 'rgba(255, 193, 7, 0.2)' : 'rgba(40, 167, 69, 0.2)',
          padding: '20px',
          borderRadius: '10px',
          marginBottom: '20px',
          border: `1px solid ${characterMissionStatus.isActive ? '#ffc107' : '#28a745'}`
        }}>
          <h4>🎮 Character Mission Status</h4>
          {characterMissionStatus.isActive ? (
            <>
              <p><strong>Status:</strong> 🚀 On Mission</p>
              <p><strong>Time Remaining:</strong> {formatTimeRemaining(characterMissionStatus.endTime)}</p>
              <p><strong>Mission:</strong> {characterMissionStatus.missionAddress.substring(0, 8)}...</p>
            </>
          ) : (
            <>
              <p><strong>Status:</strong> ✅ Mission Complete - Ready to Recall</p>
              <button
                onClick={recallCharacter}
                disabled={isLoading}
                style={{
                  background: '#28a745',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  marginTop: '10px'
                }}
              >
                {isLoading ? '⏳ Recalling...' : '🎁 Recall & Claim Rewards'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Setup Section */}
      {!setupComplete && (
        <div style={{
          background: 'rgba(253, 126, 20, 0.1)',
          padding: '20px',
          borderRadius: '10px',
          marginBottom: '30px',
          border: '1px solid #fd7e14'
        }}>
          <h4>🛠️ Mission System Setup</h4>
          <p>Set up the Honeycomb mission system to enable daily challenges with real blockchain rewards.</p>
          <p style={{ fontSize: '14px', color: '#888', marginBottom: '15px' }}>
            This will import your existing SPEEDY token ({import.meta.env.VITE_SPEEDY_TOKEN_MINT?.substring(0, 8)}...) as a Honeycomb resource for missions with proper decimals configuration.
            <br/><strong>Important:</strong> Use the wallet that has authority over your SPEEDY token for this setup.
            <br/><strong style={{ color: '#28a745' }}>FIXED:</strong> Now properly handles decimals to resolve the BigNumber _bn error.
          </p>
          
          <button
            onClick={setupMissionSystem}
            disabled={!connected || isSettingUp}
            style={{
              background: connected ? '#fd7e14' : '#6c757d',
              color: 'white',
              border: 'none',
              padding: '15px 30px',
              borderRadius: '8px',
              cursor: connected ? 'pointer' : 'not-allowed',
              fontWeight: 'bold',
              fontSize: '16px'
            }}
          >
            {isSettingUp ? '⏳ Setting up...' : '🚀 Setup Mission System'}
          </button>
        </div>
      )}

      {/* Reset Section - Only show if setup exists but missions are failing */}
      {setupComplete && (
        <div style={{
          background: 'rgba(220, 53, 69, 0.1)',
          padding: '15px',
          borderRadius: '10px',
          marginBottom: '20px',
          border: '1px solid #dc3545'
        }}>
          <h4 style={{ color: '#dc3545', margin: '0 0 10px 0' }}>🔧 Mission System Reset</h4>
          <p style={{ margin: '0 0 15px 0', fontSize: '14px' }}>
            If missions are failing with "Resource does not exist" errors, reset and recreate the setup with your existing SPEEDY token.
          </p>
          
          <button
            onClick={resetMissionSetup}
            style={{
              background: '#dc3545',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              marginRight: '10px'
            }}
          >
            🔄 Reset & Recreate Setup
          </button>
        </div>
      )}

      {/* Available Missions */}
      {setupComplete && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
          gap: '20px',
          marginBottom: '30px'
        }}>
          {availableMissions.map((mission, index) => (
            <div
              key={index}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '20px',
                borderRadius: '15px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)'
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                <div style={{ fontSize: '48px', marginBottom: '10px' }}>{mission.icon}</div>
                <h3 style={{ margin: '0 0 5px 0', color: '#ffd700' }}>{mission.name}</h3>
                <span
                  style={{
                    background: getDifficultyColor(mission.difficulty),
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                >
                  {mission.difficulty}
                </span>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <p style={{ fontSize: '14px', opacity: 0.9, margin: '0 0 10px 0' }}>
                  {mission.description}
                </p>
                
                <div style={{ fontSize: '12px', opacity: 0.8 }}>
                  <p><strong>Duration:</strong> {mission.duration} hour{mission.duration > 1 ? 's' : ''}</p>
                  <p><strong>Cost:</strong> {(parseInt(mission.costAmount) / 1000000).toFixed(3)} SPEEDY</p>
                  <p><strong>XP Reward:</strong> {mission.xpReward.min}-{mission.xpReward.max}</p>
                  <p><strong>Token Reward:</strong> {(parseInt(mission.resourceReward.min) / 1000000).toFixed(3)}-{(parseInt(mission.resourceReward.max) / 1000000).toFixed(3)} SPEEDY</p>
                  {mission.minXp !== '0' && <p><strong>Min XP Required:</strong> {mission.minXp}</p>}
                </div>
              </div>

              <button
                onClick={() => startMission(mission)}
                disabled={
                  !connected || 
                  !selectedCharacter || 
                  isLoading || 
                  !mission.address ||
                  (characterMissionStatus && characterMissionStatus.isActive)
                }
                style={{
                  width: '100%',
                  background: mission.address && !characterMissionStatus?.isActive ? '#007bff' : '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '12px',
                  borderRadius: '8px',
                  cursor: mission.address && !characterMissionStatus?.isActive ? 'pointer' : 'not-allowed',
                  fontWeight: 'bold'
                }}
              >
                {isLoading ? '⏳ Starting...' : 
                 !mission.address ? '⚠️ Setup Required' :
                 characterMissionStatus?.isActive ? '🚀 Character On Mission' :
                 '🎯 Start Mission'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Setup Log */}
      {setupLog.length > 0 && (
        <div style={{
          background: 'rgba(0, 0, 0, 0.3)',
          padding: '20px',
          borderRadius: '10px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <h4>📝 Mission System Log</h4>
          <div style={{
            fontFamily: 'monospace',
            fontSize: '12px',
            maxHeight: '300px',
            overflowY: 'auto',
            background: '#000',
            color: '#00ff00',
            padding: '15px',
            borderRadius: '6px'
          }}>
            {setupLog.map((log, index) => (
              <div key={index}>{log}</div>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div style={{
        background: 'rgba(23, 162, 184, 0.1)',
        padding: '20px',
        borderRadius: '10px',
        marginTop: '20px',
        border: '1px solid #17a2b8'
      }}>
        <h4>📖 How Daily Challenges Work</h4>
        <ul style={{ paddingLeft: '20px' }}>
          <li><strong>Mission Pool:</strong> Groups related missions together based on character model</li>
          <li><strong>Mission Cost:</strong> Pay SPEEDY tokens to start missions</li>
          <li><strong>Mission Duration:</strong> Missions run for specified time periods</li>
          <li><strong>Character Status:</strong> Characters are busy while on missions</li>
          <li><strong>Rewards:</strong> Earn XP and SPEEDY tokens when missions complete</li>
          <li><strong>Recall:</strong> Claim rewards by recalling characters after mission ends</li>
        </ul>
        <p style={{ fontSize: '14px', fontStyle: 'italic', marginTop: '15px' }}>
          This system uses the official Honeycomb Protocol mission infrastructure for real blockchain rewards and character progression.
        </p>
      </div>
    </div>
  );
};

export default DailyChallenges;