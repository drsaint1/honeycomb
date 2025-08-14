import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { nftCarService } from '../services/nftCarService';

interface StakingPoolConfig {
  name: string;
  rewardsPerSecond: number;
  maxDuration: number; // in seconds
  minDuration: number; // in seconds
  resetStake: boolean;
}

const POOL_PRESETS: StakingPoolConfig[] = [
  {
    name: "Fast Rewards Pool",
    rewardsPerSecond: 0.01, // ~36 tokens per hour
    maxDuration: 86400, // 1 day
    minDuration: 3600, // 1 hour
    resetStake: false
  },
  {
    name: "Long Term Pool", 
    rewardsPerSecond: 0.02, // ~72 tokens per hour
    maxDuration: 2592000, // 30 days
    minDuration: 86400, // 1 day
    resetStake: true
  },
  {
    name: "High Yield Pool",
    rewardsPerSecond: 0.05, // ~180 tokens per hour
    maxDuration: 604800, // 7 days
    minDuration: 21600, // 6 hours
    resetStake: false
  }
];

export const StakingPoolManager: React.FC = () => {
  const { connected, publicKey, wallet, signTransaction, signAllTransactions } = useWallet();
  const [selectedPreset, setSelectedPreset] = useState<StakingPoolConfig>(POOL_PRESETS[0]);
  const [customConfig, setCustomConfig] = useState<StakingPoolConfig>({
    name: '',
    rewardsPerSecond: 0.01,
    maxDuration: 86400,
    minDuration: 3600,
    resetStake: false
  });
  const [useCustom, setUseCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdPools, setCreatedPools] = useState<string[]>([]);

  useEffect(() => {
    // Load created pools from localStorage
    if (publicKey) {
      const saved = localStorage.getItem(`created_pools_${publicKey.toString()}`);
      if (saved) {
        setCreatedPools(JSON.parse(saved));
      }
    }
  }, [publicKey]);

  const createStakingPool = async () => {
    if (!connected || !publicKey) {
      setError('Please connect your wallet first');
      return;
    }

    const config = useCustom ? customConfig : selectedPreset;
    
    if (!config.name.trim()) {
      setError('Pool name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🏊 Creating staking pool with config:', config);

      // Create proper wallet object for Honeycomb
      const walletForPool = {
        publicKey,
        signMessage: wallet?.adapter?.signMessage,
        signTransaction,
        signAllTransactions,
        adapter: wallet?.adapter
      };

      // Validate wallet has required methods
      if (!walletForPool.signTransaction) {
        throw new Error('Wallet must support transaction signing to create staking pools');
      }

      const result = await nftCarService.createStakingPool(walletForPool, config);

      if (result.success && result.poolAddress) {
        console.log('✅ Staking pool created successfully:', result.poolAddress);

        // Add to created pools list
        const updatedPools = [...createdPools, result.poolAddress];
        setCreatedPools(updatedPools);
        localStorage.setItem(`created_pools_${publicKey.toString()}`, JSON.stringify(updatedPools));

        // Store pool configuration
        const poolData = {
          address: result.poolAddress,
          config: config,
          createdAt: new Date().toISOString(),
          creator: publicKey.toString()
        };
        localStorage.setItem(`pool_${result.poolAddress}`, JSON.stringify(poolData));

        alert(`🎉 Staking pool "${config.name}" created successfully!\n\nPool Address: ${result.poolAddress.slice(0, 8)}...${result.poolAddress.slice(-8)}\n\nRewards: ${(config.rewardsPerSecond * 3600).toFixed(2)} tokens/hour`);

        // Reset form
        if (useCustom) {
          setCustomConfig({
            name: '',
            rewardsPerSecond: 0.01,
            maxDuration: 86400,
            minDuration: 3600,
            resetStake: false
          });
        }
      } else {
        throw new Error(result.error || 'Failed to create staking pool');
      }
    } catch (error: any) {
      console.error('❌ Staking pool creation failed:', error);
      
      let errorMessage = error.message;
      if (error.message.includes('insufficient funds')) {
        errorMessage = 'Insufficient SOL for transaction fees. Please add SOL to your wallet.';
      } else if (error.message.includes('user rejected')) {
        errorMessage = 'Transaction was cancelled by user.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 3600) return `${seconds / 60} minutes`;
    if (seconds < 86400) return `${seconds / 3600} hours`;
    return `${seconds / 86400} days`;
  };

  const calculateHourlyReward = (rewardsPerSecond: number): number => {
    return rewardsPerSecond * 3600;
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>🏊 Staking Pool Manager</h2>
      <p style={{ color: '#666', marginBottom: '30px' }}>
        Create and manage staking pools for NFT cars. Only project administrators should create pools.
      </p>

      {/* Pool Configuration Options */}
      <div style={{ marginBottom: '30px' }}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
            <input
              type="radio"
              checked={!useCustom}
              onChange={() => setUseCustom(false)}
              style={{ marginRight: '8px' }}
            />
            Use Preset Configuration
          </label>
          
          {!useCustom && (
            <div style={{ 
              background: '#f8f9fa', 
              padding: '15px', 
              borderRadius: '8px',
              marginLeft: '20px'
            }}>
              <select
                value={POOL_PRESETS.indexOf(selectedPreset)}
                onChange={(e) => setSelectedPreset(POOL_PRESETS[parseInt(e.target.value)])}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  marginBottom: '15px'
                }}
              >
                {POOL_PRESETS.map((preset, index) => (
                  <option key={index} value={index}>
                    {preset.name} - {calculateHourlyReward(preset.rewardsPerSecond).toFixed(2)} tokens/hour
                  </option>
                ))}
              </select>

              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '10px',
                fontSize: '14px',
                color: '#666'
              }}>
                <div>
                  <strong>Min Duration:</strong> {formatDuration(selectedPreset.minDuration)}
                </div>
                <div>
                  <strong>Max Duration:</strong> {formatDuration(selectedPreset.maxDuration)}
                </div>
                <div>
                  <strong>Hourly Rewards:</strong> {calculateHourlyReward(selectedPreset.rewardsPerSecond).toFixed(2)} tokens
                </div>
                <div>
                  <strong>Reset on Stake:</strong> {selectedPreset.resetStake ? 'Yes' : 'No'}
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <label style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
            <input
              type="radio"
              checked={useCustom}
              onChange={() => setUseCustom(true)}
              style={{ marginRight: '8px' }}
            />
            Custom Configuration
          </label>

          {useCustom && (
            <div style={{ 
              background: '#f8f9fa', 
              padding: '15px', 
              borderRadius: '8px',
              marginLeft: '20px'
            }}>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '15px',
                marginBottom: '15px'
              }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>
                    Pool Name
                  </label>
                  <input
                    type="text"
                    value={customConfig.name}
                    onChange={(e) => setCustomConfig({...customConfig, name: e.target.value})}
                    placeholder="My Staking Pool"
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '4px',
                      border: '1px solid #ddd'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>
                    Rewards per Second
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={customConfig.rewardsPerSecond}
                    onChange={(e) => setCustomConfig({...customConfig, rewardsPerSecond: parseFloat(e.target.value) || 0})}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '4px',
                      border: '1px solid #ddd'
                    }}
                  />
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                    ≈ {calculateHourlyReward(customConfig.rewardsPerSecond).toFixed(2)} tokens/hour
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>
                    Min Duration (hours)
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={customConfig.minDuration / 3600}
                    onChange={(e) => setCustomConfig({...customConfig, minDuration: parseFloat(e.target.value) * 3600 || 3600})}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '4px',
                      border: '1px solid #ddd'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>
                    Max Duration (hours)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={customConfig.maxDuration / 3600}
                    onChange={(e) => setCustomConfig({...customConfig, maxDuration: parseFloat(e.target.value) * 3600 || 86400})}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '4px',
                      border: '1px solid #ddd'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px' }}>
                  <input
                    type="checkbox"
                    checked={customConfig.resetStake}
                    onChange={(e) => setCustomConfig({...customConfig, resetStake: e.target.checked})}
                    style={{ marginRight: '8px' }}
                  />
                  Reset stake on reward claim (users keep accumulating time vs reset to 0)
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Button */}
      <div style={{ marginBottom: '30px' }}>
        <button
          onClick={createStakingPool}
          disabled={loading || !connected}
          style={{
            background: connected ? '#ff6b35' : '#6c757d',
            color: 'white',
            border: 'none',
            padding: '15px 30px',
            borderRadius: '8px',
            cursor: connected ? 'pointer' : 'not-allowed',
            fontSize: '16px',
            fontWeight: 'bold',
            width: '100%'
          }}
        >
          {loading ? '🏊 Creating Pool...' : 
           !connected ? '🔌 Connect Wallet' :
           `🏊 Create Staking Pool "${useCustom ? customConfig.name : selectedPreset.name}"`}
        </button>
      </div>

      {/* Created Pools */}
      {createdPools.length > 0 && (
        <div style={{ marginBottom: '30px' }}>
          <h3>🏊 Your Created Pools ({createdPools.length})</h3>
          <div style={{ 
            background: '#f8f9fa',
            borderRadius: '8px',
            padding: '15px'
          }}>
            {createdPools.map((poolAddress, index) => {
              const poolData = localStorage.getItem(`pool_${poolAddress}`);
              const config = poolData ? JSON.parse(poolData).config : null;
              
              return (
                <div 
                  key={index}
                  style={{
                    background: '#fff',
                    padding: '12px',
                    borderRadius: '6px',
                    marginBottom: '10px',
                    border: '1px solid #e9ecef'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{config?.name || 'Staking Pool'}</strong>
                      <div style={{ fontSize: '12px', color: '#666', fontFamily: 'monospace' }}>
                        {poolAddress.slice(0, 12)}...{poolAddress.slice(-12)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '14px', color: '#666' }}>
                      {config && (
                        <>
                          <div>{calculateHourlyReward(config.rewardsPerSecond).toFixed(2)} tokens/hour</div>
                          <div>{formatDuration(config.minDuration)} - {formatDuration(config.maxDuration)}</div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div style={{
          background: '#f8d7da',
          color: '#721c24',
          padding: '15px',
          borderRadius: '8px',
          border: '1px solid #f5c6cb',
          marginBottom: '20px'
        }}>
          <strong>❌ Error:</strong> {error}
        </div>
      )}

      {/* Connection Status */}
      {!connected && (
        <div style={{
          background: '#fff3cd',
          padding: '20px',
          borderRadius: '8px',
          border: '1px solid #ffeaa7',
          textAlign: 'center'
        }}>
          <h3>⚠️ Wallet Not Connected</h3>
          <p>Connect your wallet to create and manage staking pools for NFT cars.</p>
        </div>
      )}

      {/* Instructions */}
      <div style={{
        background: '#e7f3ff',
        padding: '20px',
        borderRadius: '8px',
        border: '1px solid #bee5eb',
        marginTop: '30px'
      }}>
        <h3>📖 Instructions</h3>
        <ol style={{ marginLeft: '20px', lineHeight: '1.6' }}>
          <li>Only project administrators should create staking pools</li>
          <li>Each pool has configurable reward rates and duration limits</li>
          <li>Users will stake their NFT cars in these pools to earn rewards</li>
          <li>Pool addresses can be shared with users or set as default in environment variables</li>
          <li>Monitor pool performance and adjust parameters as needed</li>
        </ol>
        <p style={{ marginTop: '15px', fontSize: '14px', color: '#666' }}>
          <strong>💡 Tip:</strong> Start with preset configurations and create custom pools once you understand the reward economics.
        </p>
      </div>
    </div>
  );
};

export default StakingPoolManager;