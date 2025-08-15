import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { nftCarService, CAR_TEMPLATES } from '../services/nftCarService';
import type { NFTCar } from '../services/nftCarService';

interface CarSelectionPageProps {
  onCarSelected?: (car: NFTCar | null) => void;
}

export const CarSelectionPage: React.FC<CarSelectionPageProps> = ({ onCarSelected }) => {
  const { connected, publicKey } = useWallet();
  const [userCars, setUserCars] = useState<NFTCar[]>([]);
  const [selectedCar, setSelectedCar] = useState<NFTCar | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (connected && publicKey) {
      loadUserCars();
    }
  }, [connected, publicKey]);

  const loadUserCars = async () => {
    if (!publicKey) return;

    setLoading(true);
    setError(null);
    try {
      let cars = await nftCarService.getUserCars(publicKey.toString());
      
      // Apply car template mappings
      const manualMappings = JSON.parse(localStorage.getItem('manual_car_mappings') || '{}');
      
      if (cars.length > 0) {
        // Apply manual mappings first
        cars = cars.map((car, index) => {
          const mappingKey = car.id || car.mintAddress || `car_${index}`;
          const carType = manualMappings[mappingKey];
          
          if (carType && CAR_TEMPLATES[carType as keyof typeof CAR_TEMPLATES]) {
            const template = CAR_TEMPLATES[carType as keyof typeof CAR_TEMPLATES];
            return {
              ...car,
              name: template.name,
              image: template.image,
              description: template.description,
              traits: template.traits
            };
          }
          return car;
        });
        
        // Default mappings for unmapped cars
        const defaultMappings: Partial<NFTCar>[] = [
          { name: "Nitro Runner", image: "https://arweave.net/AUgjbSGUbXzvjfX_0y2hHG9mVRH1Syk_ZI0iqmN8OAw", description: "A high-speed racing machine with blazing acceleration", traits: { speed: 10, handling: 6, acceleration: 9, durability: 5, rarity: "legendary" as const }},
          { name: "Drift Master", image: "https://arweave.net/zsDN0qpQw49dlVGIV5J84qONMlIBz29QmCI2RzSN4R0", description: "A balanced car with great handling for tight turns", traits: { speed: 7, handling: 9, acceleration: 7, durability: 7, rarity: "rare" as const }},
          { name: "Titan Cruiser", image: "https://arweave.net/JDrAc2F2v5fPROokIQLiXuQhFaiXPQK2R_Ly4jRDtmc", description: "A bulky car with massive control but slower acceleration", traits: { speed: 6, handling: 10, acceleration: 4, durability: 9, rarity: "uncommon" as const }}
        ];
        
        cars = cars.map((car, index) => {
          if (car.name === "Assembled Racing Car" && index < defaultMappings.length) {
            return { ...car, ...defaultMappings[index] } as NFTCar;
          }
          return car;
        });
      }
      
      setUserCars(cars);
      
      // Save characters to localStorage in format expected by Daily Challenges
      const charactersForMissions = cars.map((car, index) => ({
        address: car.id || car.mintAddress || `character_${index}`,
        name: car.name || `Character ${index + 1}`,
        model: car.traits?.rarity || 'common',
        xp: 0,
        isAssembled: true,
        traits: car.traits
      }));
      
      localStorage.setItem('user_characters', JSON.stringify(charactersForMissions));
      console.log('✅ Characters saved for mission system:', charactersForMissions);
      
    } catch (error) {
      setError('Failed to load your NFT cars. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCarSelect = (car: NFTCar) => {
    setSelectedCar(car);
    
    // Save selected character for mission system
    const selectedCharacterAddress = car.id || car.mintAddress || `character_${userCars.indexOf(car)}`;
    localStorage.setItem('selected_character_address', selectedCharacterAddress);
    console.log('✅ Selected character saved for missions:', selectedCharacterAddress);
    
    if (onCarSelected) {
      onCarSelected(car);
    }
  };

  const handleDefaultCarSelect = () => {
    setSelectedCar(null);
    
    // Clear selected character for mission system
    localStorage.removeItem('selected_character_address');
    console.log('✅ Selected character cleared for missions');
    
    if (onCarSelected) {
      onCarSelected(null);
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity.toLowerCase()) {
      case 'common': return '#6c757d';
      case 'uncommon': return '#28a745';
      case 'rare': return '#007bff';
      case 'epic': return '#6610f2';
      case 'legendary': return '#fd7e14';
      default: return '#6c757d';
    }
  };

  const getRarityGlow = (rarity: string) => {
    switch (rarity.toLowerCase()) {
      case 'common': return '0 0 10px rgba(108, 117, 125, 0.3)';
      case 'uncommon': return '0 0 12px rgba(40, 167, 69, 0.4)';
      case 'rare': return '0 0 15px rgba(0, 123, 255, 0.4)';
      case 'epic': return '0 0 20px rgba(102, 16, 242, 0.5)';
      case 'legendary': return '0 0 25px rgba(253, 126, 20, 0.6)';
      default: return 'none';
    }
  };

  return (
    <div style={{
      padding: '80px 20px 20px 20px',
      maxWidth: '1200px',
      margin: '0 auto',
      minHeight: '100vh'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ 
          margin: '0 0 15px 0', 
          fontSize: '42px',
          background: 'linear-gradient(45deg, #ffd700, #ffed4e)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          🏎️ Select Your Racing Car
        </h1>
        <p style={{ margin: 0, color: '#ccc', fontSize: '18px' }}>
          Choose an NFT car to enhance your racing experience with special traits and abilities
        </p>
      </div>

      {/* Wallet Connection Check */}
      {!connected && (
        <div style={{
          background: 'rgba(255, 193, 7, 0.1)',
          border: '2px solid #ffc107',
          borderRadius: '12px',
          padding: '30px',
          textAlign: 'center',
          marginBottom: '30px'
        }}>
          <h3 style={{ color: '#ffc107', margin: '0 0 15px 0' }}>⚠️ Wallet Not Connected</h3>
          <p style={{ margin: '0 0 20px 0', color: '#ccc' }}>
            Connect your wallet to view and select your NFT racing cars
          </p>
        </div>
      )}

      {/* Loading State */}
      {loading && connected && (
        <div style={{
          textAlign: 'center',
          padding: '60px',
          color: '#ccc'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>🔄</div>
          <h3>Loading your NFT cars...</h3>
          <p>Fetching your collection from the blockchain...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div style={{
          background: 'rgba(220, 53, 69, 0.1)',
          border: '2px solid #dc3545',
          borderRadius: '12px',
          padding: '20px',
          textAlign: 'center',
          marginBottom: '30px'
        }}>
          <h4 style={{ color: '#dc3545', margin: '0 0 10px 0' }}>❌ Error Loading Cars</h4>
          <p style={{ color: '#ccc', margin: '0 0 15px 0' }}>{error}</p>
          <button
            onClick={loadUserCars}
            style={{
              background: '#dc3545',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            🔄 Retry
          </button>
        </div>
      )}

      {/* Default Car Option */}
      {connected && !loading && (
        <div style={{
          background: 'rgba(108, 117, 125, 0.1)',
          border: selectedCar === null ? '3px solid #6c757d' : '2px solid rgba(108, 117, 125, 0.3)',
          borderRadius: '16px',
          padding: '25px',
          marginBottom: '30px',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          boxShadow: selectedCar === null ? '0 0 15px rgba(108, 117, 125, 0.4)' : 'none'
        }}
        onClick={handleDefaultCarSelect}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{
              width: '80px',
              height: '80px',
              background: 'linear-gradient(45deg, #6c757d, #495057)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px'
            }}>
              🏁
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ color: '#fff', margin: '0 0 8px 0' }}>Default Racing Car</h3>
              <p style={{ color: '#ccc', margin: '0 0 8px 0', fontSize: '14px' }}>
                Standard racing car with balanced performance - always available
              </p>
              <div style={{ display: 'flex', gap: '15px', fontSize: '12px' }}>
                <span style={{ color: '#dc3545' }}>⚡ Speed: 5</span>
                <span style={{ color: '#28a745' }}>🚀 Acceleration: 5</span>
                <span style={{ color: '#007bff' }}>🎯 Handling: 5</span>
                <span style={{ color: '#6f42c1' }}>🛡️ Durability: 5</span>
              </div>
            </div>
            {selectedCar === null && (
              <div style={{
                background: '#6c757d',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 'bold'
              }}>
                SELECTED
              </div>
            )}
          </div>
        </div>
      )}

      {/* NFT Cars Grid */}
      {connected && !loading && userCars.length > 0 && (
        <>
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ color: '#fff', margin: '0 0 10px 0' }}>Your NFT Racing Cars ({userCars.length})</h2>
            <p style={{ color: '#ccc', margin: 0 }}>
              Select an NFT car to gain enhanced performance and unique abilities
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '25px',
            marginBottom: '40px'
          }}>
            {userCars.map((car) => (
              <div
                key={car.id}
                onClick={() => handleCarSelect(car)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: selectedCar?.id === car.id ? 
                    `3px solid ${getRarityColor(car.traits.rarity)}` : 
                    '2px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '16px',
                  padding: '25px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: selectedCar?.id === car.id ? 
                    getRarityGlow(car.traits.rarity) : 
                    '0 4px 15px rgba(0, 0, 0, 0.2)',
                  transform: selectedCar?.id === car.id ? 'scale(1.02)' : 'scale(1)',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  if (selectedCar?.id !== car.id) {
                    e.currentTarget.style.transform = 'scale(1.02)';
                    e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedCar?.id !== car.id) {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
                  }
                }}
              >
                {selectedCar?.id === car.id && (
                  <div style={{
                    position: 'absolute',
                    top: '15px',
                    right: '15px',
                    background: getRarityColor(car.traits.rarity),
                    color: 'white',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    SELECTED
                  </div>
                )}

                <img
                  src={car.image}
                  alt={car.name}
                  style={{
                    width: '100%',
                    height: '180px',
                    objectFit: 'cover',
                    borderRadius: '12px',
                    marginBottom: '20px'
                  }}
                />

                <h3 style={{ color: '#fff', margin: '0 0 10px 0', fontSize: '22px' }}>
                  {car.name}
                </h3>

                <div style={{
                  background: getRarityColor(car.traits.rarity),
                  color: 'white',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  display: 'inline-block',
                  marginBottom: '15px'
                }}>
                  {car.traits.rarity.toUpperCase()}
                </div>

                <p style={{ 
                  color: '#ccc', 
                  fontSize: '14px', 
                  margin: '0 0 20px 0',
                  lineHeight: '1.4'
                }}>
                  {car.description}
                </p>

                <div style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  padding: '15px',
                  borderRadius: '10px',
                  marginBottom: '15px'
                }}>
                  <h4 style={{ color: '#fff', margin: '0 0 10px 0', fontSize: '14px' }}>Performance Stats</h4>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px',
                    fontSize: '13px'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 'bold', color: '#dc3545', marginBottom: '4px' }}>
                        ⚡ {car.traits.speed}
                      </div>
                      <div style={{ color: '#ccc' }}>Speed</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 'bold', color: '#28a745', marginBottom: '4px' }}>
                        🚀 {car.traits.acceleration}
                      </div>
                      <div style={{ color: '#ccc' }}>Acceleration</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 'bold', color: '#007bff', marginBottom: '4px' }}>
                        🎯 {car.traits.handling}
                      </div>
                      <div style={{ color: '#ccc' }}>Handling</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 'bold', color: '#6f42c1', marginBottom: '4px' }}>
                        🛡️ {car.traits.durability}
                      </div>
                      <div style={{ color: '#ccc' }}>Durability</div>
                    </div>
                  </div>
                </div>

                {car.isStaked && (
                  <div style={{
                    background: 'rgba(255, 193, 7, 0.1)',
                    border: '1px solid #ffc107',
                    color: '#ffc107',
                    padding: '10px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    textAlign: 'center',
                    marginBottom: '10px'
                  }}>
                    🎯 Currently Staked - Earning Rewards!
                  </div>
                )}

                <div style={{
                  fontSize: '11px',
                  color: '#888',
                  textAlign: 'center',
                  fontStyle: 'italic'
                }}>
                  Select to race with enhanced performance
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* No Cars Found */}
      {connected && !loading && userCars.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '60px 40px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '20px',
          border: '2px dashed rgba(255, 255, 255, 0.2)'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>🏎️</div>
          <h3 style={{ color: '#fff', margin: '0 0 15px 0' }}>No NFT Cars Found</h3>
          <p style={{ color: '#ccc', margin: '0 0 25px 0', fontSize: '16px' }}>
            You don't have any NFT cars yet, but you can still race with the default car.<br/>
            Mint some NFT cars to unlock special abilities and enhanced performance!
          </p>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => window.location.hash = 'minting'}
              style={{
                background: 'linear-gradient(45deg, #ff6b35, #f7931e)',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '14px'
              }}
            >
              🎯 Mint NFT Cars
            </button>
          </div>
        </div>
      )}

      {/* Selection Summary */}
      {connected && !loading && (
        <div style={{
          background: 'rgba(40, 167, 69, 0.1)',
          border: '2px solid #28a745',
          borderRadius: '12px',
          padding: '20px',
          marginTop: '30px',
          textAlign: 'center'
        }}>
          <h4 style={{ color: '#28a745', margin: '0 0 10px 0' }}>
            {selectedCar ? `🏎️ Selected: ${selectedCar.name}` : '🏁 Using Default Car'}
          </h4>
          <p style={{ color: '#ccc', margin: 0, fontSize: '14px' }}>
            {selectedCar ? 
              'Your NFT car is selected and ready for enhanced racing performance!' :
              'Default car selected - you can change your selection anytime.'
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default CarSelectionPage;