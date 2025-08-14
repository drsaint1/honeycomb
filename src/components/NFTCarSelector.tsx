import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { nftCarService } from '../services/nftCarService';
import type { NFTCar } from '../services/nftCarService';

interface NFTCarSelectorProps {
  onCarSelected: (car: NFTCar | null) => void;
  selectedCar: NFTCar | null;
  show: boolean;
  onClose: () => void;
}

export const NFTCarSelector: React.FC<NFTCarSelectorProps> = ({
  onCarSelected,
  selectedCar,
  show,
  onClose
}) => {
  const { connected, publicKey } = useWallet();
  const [userCars, setUserCars] = useState<NFTCar[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (show && connected && publicKey) {
      loadUserCars();
    }
  }, [show, connected, publicKey]);

  const loadUserCars = async () => {
    if (!publicKey) return;

    setLoading(true);
    setError(null);
    try {
      const cars = await nftCarService.getUserCars(publicKey.toString());
      setUserCars(cars);
    } catch (error) {
      setError('Failed to load your NFT cars. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCarSelect = (car: NFTCar) => {
    onCarSelected(car);
    onClose();
  };

  const handlePlayWithoutNFT = () => {
    onCarSelected(null);
    onClose();
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

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.9)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '20px'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        padding: '30px',
        maxWidth: '900px',
        maxHeight: '80vh',
        overflow: 'auto',
        width: '100%',
        position: 'relative',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '15px',
            right: '15px',
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: '#666',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ×
        </button>

        <div style={{ textAlign: 'center', marginBottom: '25px' }}>
          <h2 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '28px' }}>
            🏎️ Select Your Racing Car
          </h2>
          <p style={{ margin: 0, color: '#666', fontSize: '16px' }}>
            Choose an NFT car to enhance your racing experience with special traits
          </p>
        </div>

        {loading && (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: '#666'
          }}>
            <div style={{ fontSize: '24px', marginBottom: '10px' }}>🔄</div>
            Loading your NFT cars...
          </div>
        )}

        {error && (
          <div style={{
            background: '#f8d7da',
            border: '1px solid #f5c6cb',
            color: '#721c24',
            padding: '15px',
            borderRadius: '8px',
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {userCars.length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '40px',
                background: '#f8f9fa',
                borderRadius: '12px',
                border: '2px dashed #dee2e6',
                marginBottom: '20px'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '15px' }}>🏎️</div>
                <h3 style={{ color: '#666', margin: '0 0 10px 0' }}>No NFT Cars Found</h3>
                <p style={{ color: '#888', margin: '0 0 15px 0' }}>
                  You don't have any NFT cars yet. You can still play with the default car,
                  or mint some NFT cars to unlock special abilities!
                </p>
                <button
                  onClick={() => {
                    onClose();
                    // Navigate to minting page - this would need to be passed as a prop
                  }}
                  style={{
                    background: '#ff6b35',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    marginRight: '10px'
                  }}
                >
                  🎯 Mint Cars
                </button>
              </div>
            )}

            {userCars.length > 0 && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '20px',
                marginBottom: '25px'
              }}>
                {userCars.map((car) => (
                  <div
                    key={car.id}
                    onClick={() => handleCarSelect(car)}
                    style={{
                      background: '#fff',
                      border: `3px solid ${
                        selectedCar?.id === car.id ? getRarityColor(car.traits.rarity) : '#e9ecef'
                      }`,
                      borderRadius: '12px',
                      padding: '20px',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      boxShadow: selectedCar?.id === car.id ? 
                        getRarityGlow(car.traits.rarity) : '0 4px 12px rgba(0, 0, 0, 0.1)',
                      transform: selectedCar?.id === car.id ? 'scale(1.02)' : 'scale(1)',
                    }}
                    onMouseEnter={(e) => {
                      if (selectedCar?.id !== car.id) {
                        e.currentTarget.style.transform = 'scale(1.02)';
                        e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.15)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedCar?.id !== car.id) {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                      }
                    }}
                  >
                    {selectedCar?.id === car.id && (
                      <div style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        background: getRarityColor(car.traits.rarity),
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '12px',
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
                        height: '160px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        marginBottom: '15px'
                      }}
                    />

                    <h4 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#333' }}>
                      {car.name}
                    </h4>

                    <div style={{
                      background: getRarityColor(car.traits.rarity),
                      color: 'white',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      display: 'inline-block',
                      marginBottom: '12px'
                    }}>
                      {car.traits.rarity.toUpperCase()}
                    </div>

                    <div style={{
                      background: '#f8f9fa',
                      padding: '12px',
                      borderRadius: '8px',
                      marginBottom: '12px'
                    }}>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '8px',
                        fontSize: '12px'
                      }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontWeight: 'bold', color: '#dc3545' }}>
                            ⚡ {car.traits.speed}
                          </div>
                          <div style={{ color: '#666' }}>Speed</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontWeight: 'bold', color: '#28a745' }}>
                            🚀 {car.traits.acceleration}
                          </div>
                          <div style={{ color: '#666' }}>Accel</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontWeight: 'bold', color: '#007bff' }}>
                            🎯 {car.traits.handling}
                          </div>
                          <div style={{ color: '#666' }}>Handle</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontWeight: 'bold', color: '#6f42c1' }}>
                            🛡️ {car.traits.durability}
                          </div>
                          <div style={{ color: '#666' }}>Durability</div>
                        </div>
                      </div>
                    </div>

                    {car.isStaked && (
                      <div style={{
                        background: '#fff3cd',
                        color: '#856404',
                        padding: '8px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        textAlign: 'center',
                        marginBottom: '8px'
                      }}>
                        🎯 Currently Staked - Earning Rewards!
                      </div>
                    )}

                    <div style={{
                      fontSize: '12px',
                      color: '#666',
                      textAlign: 'center'
                    }}>
                      Select to race with enhanced performance
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{
              borderTop: '1px solid #e9ecef',
              paddingTop: '20px',
              textAlign: 'center'
            }}>
              <button
                onClick={handlePlayWithoutNFT}
                style={{
                  background: selectedCar ? '#6c757d' : '#28a745',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  marginRight: '15px'
                }}
              >
                {selectedCar ? 'Clear Selection' : '🏁 Play with Default Car'}
              </button>

              {selectedCar && (
                <button
                  onClick={() => handleCarSelect(selectedCar)}
                  style={{
                    background: getRarityColor(selectedCar.traits.rarity),
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '16px',
                    boxShadow: getRarityGlow(selectedCar.traits.rarity)
                  }}
                >
                  🚗 Race with {selectedCar.name}
                </button>
              )}
            </div>

            <div style={{
              fontSize: '12px',
              color: '#888',
              textAlign: 'center',
              marginTop: '15px',
              background: '#f8f9fa',
              padding: '10px',
              borderRadius: '6px'
            }}>
              <strong>NFT Car Benefits:</strong> Higher stats provide gameplay advantages like increased speed,
              better handling, and enhanced acceleration. Staked cars continue earning rewards even while racing!
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default NFTCarSelector;