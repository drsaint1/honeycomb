import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { nftCarService, CAR_TEMPLATES } from '../services/nftCarService';

interface CarType {
  id: string;
  name: string;
  description: string;
  image: string;
  metadataUri: string;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Uncommon';
  attributes: {
    speed: number;
    acceleration: number;
    handling: number;
  };
  mintCost: number;
  maxSupply: number;
  currentSupply: number;
  rarityChance: number; // percentage chance to get this rarity
}

// Convert CAR_TEMPLATES to the CarType format for the UI
const CAR_TYPES: CarType[] = Object.entries(CAR_TEMPLATES).map(([id, template]) => ({
  id,
  name: template.name,
  description: template.description,
  image: template.image,
  metadataUri: template.image, // Will be updated when you upload metadata
  rarity: (template.traits.rarity.charAt(0).toUpperCase() + template.traits.rarity.slice(1)) as 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Uncommon',
  attributes: {
    speed: template.traits.speed * 10, // Convert 1-10 scale to percentage
    acceleration: template.traits.acceleration * 10,
    handling: template.traits.handling * 10
  },
  mintCost: template.traits.rarity === 'common' ? 1000 :
            template.traits.rarity === 'uncommon' ? 2500 :
            template.traits.rarity === 'rare' ? 5000 : 10000,
  maxSupply: template.traits.rarity === 'legendary' ? 100 :
             template.traits.rarity === 'rare' ? 500 :
             template.traits.rarity === 'uncommon' ? 1000 : 1000,
  currentSupply: 0, // Will be loaded from blockchain
  rarityChance: template.traits.rarity === 'common' ? 50 :
                template.traits.rarity === 'uncommon' ? 30 :
                template.traits.rarity === 'rare' ? 15 : 5
}));

export const CarMinting: React.FC = () => {
  const { connected, publicKey, wallet, signTransaction, signAllTransactions } = useWallet();
  const [error, setError] = useState<string | null>(null);
  // Track individual minting states for each car type
  const [mintingStates, setMintingStates] = useState<Record<string, boolean>>({});
  // Removed SPEEDY token balance - minting only requires SOL for gas fees
  const [ownedCars, setOwnedCars] = useState<string[]>([]);
  const [mintingHistory, setMintingHistory] = useState<any[]>([]);
  const [showMintSuccess, setShowMintSuccess] = useState<any>(null);
  const [publicMintingEnabled, setPublicMintingEnabled] = useState(false);

  const projectAddress = import.meta.env.VITE_PUBLIC_HONEYCOMB_PROJECT_ADDRESS;

  useEffect(() => {
    loadUserData();
    // Check if public minting is already enabled
    const publicMintingFlag = localStorage.getItem('allow_all_users_mint') === 'true';
    setPublicMintingEnabled(publicMintingFlag);
  }, [publicKey]);

  const loadUserData = async () => {
    if (publicKey) {
      try {
        const realCars = await nftCarService.getUserCars(publicKey.toString());
        setOwnedCars(realCars.map(car => car.mintAddress || car.id));
      } catch (error) {
        setOwnedCars([]);
      }
      
      const history = JSON.parse(
        localStorage.getItem(`minting_history_${publicKey.toString()}`) || '[]'
      );
      setMintingHistory(history);
    }
  };

  const mintCar = async (carTypeId: string) => {
    if (!connected || !publicKey || !projectAddress) {
      setError('Please connect wallet and ensure project is set up');
      return;
    }

    const carType = CAR_TYPES.find(c => c.id === carTypeId);
    if (!carType) return;

    // No SPEEDY token requirement - only SOL for gas fees needed

    setMintingStates(prev => ({ ...prev, [carTypeId]: true }));
    setError(null);

    try {
      // Use the actual wallet object instead of creating a custom one
      const walletForMinting = {
        publicKey,
        signTransaction,
        signAllTransactions,
        adapter: wallet?.adapter,
        // Pass the original wallet for signMessage to maintain proper context
        originalWallet: wallet
      };

      if (!walletForMinting.signTransaction) {
        throw new Error('Wallet must support transaction signing to mint NFT cars');
      }

      if (!wallet?.adapter?.signMessage) {
        throw new Error('Wallet must support message signing for authentication');
      }

      const result = await nftCarService.mintCar(
        walletForMinting,
        carTypeId as keyof typeof CAR_TEMPLATES,
        publicKey.toString()
      );

      if (result.success && result.mintAddress) {
        const mintAddressString = String(result.mintAddress);
        
        // Refresh NFT cars after blockchain indexing
        setTimeout(async () => {
          try {
            const realCars = await nftCarService.getUserCars(publicKey.toString());
            setOwnedCars(realCars.map(car => car.mintAddress || car.id));
          } catch (error) {
            // Ignore refresh errors
          }
        }, 5000);

        // Add to recent mints for character matching
        const recentMints = JSON.parse(localStorage.getItem('recent_mints') || '[]');
        const recentMint = {
          mintAddress: mintAddressString,
          carType: carTypeId, // Use carTypeId (like 'nitrorunner') for template matching
          timestamp: Date.now()
        };
        recentMints.unshift(recentMint);
        // Keep only last 50 recent mints
        recentMints.splice(50);
        localStorage.setItem('recent_mints', JSON.stringify(recentMints));

        // Create permanent character mapping
        const characterMapping = JSON.parse(localStorage.getItem('character_mapping') || '{}');
        
        setTimeout(async () => {
          try {
            const cars = await nftCarService.getUserCars(publicKey.toString());
            const unmappedCars = cars.filter(car => 
              car.name === "Assembled Racing Car" && 
              !characterMapping[car.id] && 
              !characterMapping[car.mintAddress || '']
            );
            
            if (unmappedCars.length > 0) {
              const newChar = unmappedCars[0];
              characterMapping[newChar.id] = carTypeId;
              if (newChar.mintAddress) {
                characterMapping[newChar.mintAddress] = carTypeId;
              }
              
              if (newChar.id !== newChar.mintAddress && newChar.mintAddress) {
                characterMapping[newChar.mintAddress] = carTypeId;
              }
              
              localStorage.setItem('character_mapping', JSON.stringify(characterMapping));
              await loadUserData();
            }
          } catch (error) {
            // Ignore mapping errors
          }
        }, 8000);

        // Add to minting history for display purposes only
        const mintRecord = {
          carType: carType.name,
          mintAddress: mintAddressString,
          cost: 0, // Free minting (only gas fees)
          timestamp: new Date().toISOString(),
          rarity: carType.rarity,
          attributes: carType.attributes,
          transactionSignature: mintAddressString
        };
        
        const updatedHistory = [mintRecord, ...mintingHistory];
        setMintingHistory(updatedHistory);
        localStorage.setItem(
          `minting_history_${publicKey.toString()}`,
          JSON.stringify(updatedHistory)
        );

        // Show success modal with real mint address
        setShowMintSuccess({
          car: carType,
          mintAddress: mintAddressString,
          serialNumber: carType.currentSupply + 1
        });

        // Update supply count (in real implementation, this would come from blockchain)
        carType.currentSupply += 1;

      } else {
        throw new Error(result.error || 'Minting transaction failed');
      }

    } catch (error: any) {
      // Provide specific error messages for common issues
      let errorMessage = error.message;
      
      if (error.message.includes('insufficient funds')) {
        errorMessage = 'Insufficient SOL for transaction fees. Please add SOL to your wallet.';
      } else if (error.message.includes('user rejected')) {
        errorMessage = 'Transaction was cancelled by user.';
      } else if (error.message.includes('character model')) {
        errorMessage = 'NFT infrastructure is not set up. Please contact the administrator.';
      } else if (error.message.includes('Unauthorized')) {
        errorMessage = 'Authentication failed. Please try connecting your wallet again.';
      } else if (error.message.includes('network')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      }
      
      setError(errorMessage);
    } finally {
      setMintingStates(prev => ({ ...prev, [carTypeId]: false }));
    }
  };

  const enablePublicMinting = () => {
    localStorage.setItem('allow_all_users_mint', 'true');
    setPublicMintingEnabled(true);
    console.log('✅ Public minting enabled for all players!');
  };

  const randomMint = async () => {
    // Don't allow random mint if any individual mint is in progress
    if (Object.values(mintingStates).some(state => state)) {
      return;
    }

    // Pick a random car based on rarity chances
    const random = Math.random() * 100;
    let cumulativeChance = 0;
    let selectedCar = CAR_TYPES[0]; // fallback
    
    for (const car of CAR_TYPES) {
      cumulativeChance += car.rarityChance;
      if (random <= cumulativeChance) {
        selectedCar = car;
        break;
      }
    }
    
    await mintCar(selectedCar.id);
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'Common': return '#6c757d';
      case 'Uncommon': return '#28a745';
      case 'Rare': return '#007bff';
      case 'Epic': return '#6610f2';
      case 'Legendary': return '#fd7e14';
      default: return '#6c757d';
    }
  };

  const getRarityGlow = (rarity: string) => {
    switch (rarity) {
      case 'Common': return '0 0 10px rgba(108, 117, 125, 0.3)';
      case 'Uncommon': return '0 0 12px rgba(40, 167, 69, 0.4)';
      case 'Rare': return '0 0 15px rgba(0, 123, 255, 0.4)';
      case 'Epic': return '0 0 20px rgba(102, 16, 242, 0.5)';
      case 'Legendary': return '0 0 25px rgba(253, 126, 20, 0.6)';
      default: return 'none';
    }
  };

  const totalSupply = CAR_TYPES.reduce((sum, car) => sum + car.currentSupply, 0);
  const totalMaxSupply = CAR_TYPES.reduce((sum, car) => sum + car.maxSupply, 0);

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h2>🏎️ NFT Car Minting</h2>

      {/* User Stats */}
      {connected && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '15px',
          marginBottom: '30px'
        }}>
          <div style={{
            background: '#e7f3ff',
            padding: '15px',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: '0 0 5px 0', color: '#0066cc' }}>Cars Owned</h3>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
              {ownedCars.length}
            </p>
          </div>
          
          <div style={{
            background: '#d4edda',
            padding: '15px',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: '0 0 5px 0', color: '#155724' }}>Total Minted</h3>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
              {totalSupply}/{totalMaxSupply}
            </p>
          </div>

          <div style={{
            background: '#fff3cd',
            padding: '15px',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: '0 0 5px 0', color: '#856404' }}>Minting Cost</h3>
            <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#28a745' }}>
              FREE + Gas Fees
            </p>
          </div>
        </div>
      )}

      {/* Public Minting Control - Show if not enabled yet */}
      {connected && !publicMintingEnabled && (
        <div style={{
          background: 'linear-gradient(135deg, #dc3545, #ffc107)',
          padding: '25px',
          borderRadius: '12px',
          marginBottom: '30px',
          color: 'white',
          textAlign: 'center'
        }}>
          <h3 style={{ margin: '0 0 10px 0' }}>🔒 Public Minting Disabled</h3>
          <p style={{ margin: '0 0 20px 0', fontSize: '14px', opacity: 0.9 }}>
            Currently, only project administrators can mint NFT cars. Click below to enable public minting for all players.
          </p>
          <button
            onClick={enablePublicMinting}
            style={{
              background: '#28a745',
              border: 'none',
              color: 'white',
              padding: '12px 30px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '16px'
            }}
          >
            🚀 Enable Public Minting
          </button>
        </div>
      )}

      {/* Public Minting Status - Show when enabled */}
      {connected && publicMintingEnabled && (
        <div style={{
          background: 'linear-gradient(135deg, #28a745, #20c997)',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '30px',
          color: 'white',
          textAlign: 'center'
        }}>
          <h4 style={{ margin: '0 0 5px 0' }}>✅ Public Minting Enabled</h4>
          <p style={{ margin: 0, fontSize: '12px', opacity: 0.9 }}>
            All players can now mint NFT cars for free (plus gas fees)!
          </p>
        </div>
      )}

      {/* Random Mint Section */}
      <div style={{
        background: 'linear-gradient(135deg, #ff6b35, #f7931e)',
        padding: '25px',
        borderRadius: '12px',
        marginBottom: '30px',
        color: 'white',
        textAlign: 'center'
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>🎲 Mystery Car Minting</h3>
        <p style={{ margin: '0 0 20px 0', fontSize: '14px', opacity: 0.9 }}>
          Let chance decide your fate! Get a random car based on rarity distribution.
        </p>
        <div style={{ marginBottom: '15px', fontSize: '12px' }}>
          <span style={{ marginRight: '15px' }}>🟤 Rare: 30%</span>
          <span style={{ marginRight: '15px' }}>🟣 Epic: 15%</span>
          <span>🟠 Legendary: 5%</span>
        </div>
        <button
          onClick={randomMint}
          disabled={Object.values(mintingStates).some(state => state) || !connected}
          style={{
            background: 'rgba(255, 255, 255, 0.2)',
            border: '2px solid white',
            color: 'white',
            padding: '12px 30px',
            borderRadius: '8px',
            cursor: connected && !Object.values(mintingStates).some(state => state) ? 'pointer' : 'not-allowed',
            fontWeight: 'bold',
            fontSize: '16px'
          }}
        >
          {Object.values(mintingStates).some(state => state) ? '🎲 Rolling...' : 
           !connected ? '🔌 Connect Wallet' :
           '🎲 Random Mint (FREE + Gas)'}
        </button>
      </div>

      {/* Car Types Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
        gap: '25px',
        marginBottom: '30px'
      }}>
        {CAR_TYPES.map((carType) => {
          const isCurrentlyMinting = mintingStates[carType.id] || false;
          const canMint = connected && publicKey && 
                         carType.currentSupply < carType.maxSupply && 
                         !isCurrentlyMinting; // Any connected user can mint
          const isSoldOut = carType.currentSupply >= carType.maxSupply;
          const supplyPercentage = (carType.currentSupply / carType.maxSupply) * 100;

          return (
            <div
              key={carType.id}
              style={{
                background: '#fff',
                border: `2px solid ${getRarityColor(carType.rarity)}`,
                borderRadius: '12px',
                padding: '20px',
                position: 'relative',
                boxShadow: getRarityGlow(carType.rarity),
                opacity: isSoldOut ? 0.7 : 1
              }}
            >
              {isSoldOut && (
                <div style={{
                  position: 'absolute',
                  top: '15px',
                  right: '15px',
                  background: '#dc3545',
                  color: 'white',
                  padding: '5px 10px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  transform: 'rotate(15deg)'
                }}>
                  SOLD OUT
                </div>
              )}

              <img
                src={carType.image}
                alt={carType.name}
                style={{
                  width: '100%',
                  height: '200px',
                  objectFit: 'cover',
                  borderRadius: '8px',
                  marginBottom: '15px'
                }}
              />

              <div style={{ marginBottom: '10px' }}>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '20px' }}>
                  {carType.name}
                </h3>
                <span style={{
                  background: getRarityColor(carType.rarity),
                  color: 'white',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  {carType.rarity}
                </span>
              </div>

              <p style={{ 
                fontSize: '13px', 
                color: '#666',
                lineHeight: '1.4',
                marginBottom: '15px',
                minHeight: '40px'
              }}>
                {carType.description}
              </p>

              {/* Attributes */}
              <div style={{
                background: '#f8f9fa',
                padding: '12px',
                borderRadius: '6px',
                marginBottom: '15px'
              }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Performance Stats:</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '12px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 'bold', color: '#dc3545' }}>⚡ {carType.attributes.speed}</div>
                    <div style={{ color: '#666' }}>Speed</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 'bold', color: '#28a745' }}>🚀 {carType.attributes.acceleration}</div>
                    <div style={{ color: '#666' }}>Accel</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 'bold', color: '#007bff' }}>🎯 {carType.attributes.handling}</div>
                    <div style={{ color: '#666' }}>Handle</div>
                  </div>
                </div>
              </div>

              {/* Supply and Cost */}
              <div style={{ marginBottom: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#28a745' }}>
                    FREE + Gas Fees
                  </span>
                  <span style={{ fontSize: '12px', color: '#666' }}>
                    {carType.currentSupply}/{carType.maxSupply} minted
                  </span>
                </div>
                
                {/* Supply Progress Bar */}
                <div style={{
                  background: '#e9ecef',
                  height: '8px',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    background: supplyPercentage > 80 ? '#dc3545' : supplyPercentage > 50 ? '#ffc107' : '#28a745',
                    height: '100%',
                    width: `${supplyPercentage}%`,
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                <div style={{ fontSize: '10px', color: '#666', textAlign: 'center', marginTop: '2px' }}>
                  {supplyPercentage.toFixed(1)}% minted
                </div>
              </div>

              {/* Mint Button */}
              <button
                onClick={() => mintCar(carType.id)}
                disabled={!canMint || isSoldOut}
                style={{
                  width: '100%',
                  background: isSoldOut ? '#dc3545' :
                            !canMint && !isCurrentlyMinting ? '#6c757d' : 
                            getRarityColor(carType.rarity),
                  color: 'white',
                  border: 'none',
                  padding: '12px',
                  borderRadius: '8px',
                  cursor: canMint && !isSoldOut ? 'pointer' : 'not-allowed',
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}
              >
                {isCurrentlyMinting ? '🔄 Minting...' :
                 isSoldOut ? '❌ Sold Out' :
                 !connected ? '🔌 Connect Wallet' :
                 `🎯 Mint ${carType.name} (FREE)`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Minting History */}
      {mintingHistory.length > 0 && connected && (
        <div style={{ marginBottom: '30px' }}>
          <h3>📜 Your Minting History</h3>
          <div style={{
            background: '#f8f9fa',
            borderRadius: '8px',
            padding: '15px',
            maxHeight: '300px',
            overflowY: 'auto'
          }}>
            {mintingHistory.map((record, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px',
                  background: '#fff',
                  borderRadius: '6px',
                  marginBottom: '8px',
                  fontSize: '13px'
                }}
              >
                <div>
                  <strong>{record.carType}</strong>
                  <span style={{
                    marginLeft: '8px',
                    background: getRarityColor(record.rarity),
                    color: 'white',
                    padding: '1px 6px',
                    borderRadius: '8px',
                    fontSize: '10px'
                  }}>
                    {record.rarity}
                  </span>
                </div>
                <div style={{ textAlign: 'right', color: '#666' }}>
                  <div style={{ color: '#28a745' }}>FREE</div>
                  <div style={{ fontSize: '10px' }}>
                    {new Date(record.timestamp).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showMintSuccess && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '400px',
            textAlign: 'center',
            boxShadow: getRarityGlow(showMintSuccess.car.rarity)
          }}>
            <h2 style={{ margin: '0 0 15px 0', color: '#28a745' }}>
              🎉 Minting Successful!
            </h2>
            
            <img
              src={showMintSuccess.car.image}
              alt={showMintSuccess.car.name}
              style={{
                width: '150px',
                height: '150px',
                objectFit: 'cover',
                borderRadius: '12px',
                marginBottom: '15px',
                border: `3px solid ${getRarityColor(showMintSuccess.car.rarity)}`
              }}
            />
            
            <h3 style={{ margin: '0 0 5px 0' }}>
              {showMintSuccess.car.name} #{showMintSuccess.serialNumber}
            </h3>
            
            <span style={{
              background: getRarityColor(showMintSuccess.car.rarity),
              color: 'white',
              padding: '4px 12px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 'bold'
            }}>
              {showMintSuccess.car.rarity}
            </span>
            
            <div style={{
              background: '#f8f9fa',
              padding: '15px',
              borderRadius: '8px',
              margin: '15px 0',
              fontSize: '12px'
            }}>
              <div><strong>Mint Address:</strong></div>
              <div style={{ 
                wordBreak: 'break-all', 
                fontFamily: 'monospace',
                color: '#666',
                fontSize: '10px' 
              }}>
                {showMintSuccess.mintAddress}
              </div>
            </div>
            
            <button
              onClick={() => setShowMintSuccess(null)}
              style={{
                background: '#28a745',
                color: 'white',
                border: 'none',
                padding: '12px 30px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Awesome! 🚗
            </button>
          </div>
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
          <p>Connect your wallet to mint NFT cars and start your racing collection!</p>
        </div>
      )}

      {connected && !projectAddress && (
        <div style={{
          background: '#f8d7da',
          padding: '20px',
          borderRadius: '8px',
          border: '1px solid #f5c6cb',
          textAlign: 'center'
        }}>
          <h3>🏗️ Project Not Set Up</h3>
          <p>Please set up your Honeycomb project first using the Project Creator to enable NFT minting.</p>
        </div>
      )}

      {error && (
        <div style={{
          background: '#f8d7da',
          padding: '15px',
          borderRadius: '8px',
          border: '1px solid #f5c6cb'
        }}>
          <h4>❌ Error:</h4>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
};

export default CarMinting;