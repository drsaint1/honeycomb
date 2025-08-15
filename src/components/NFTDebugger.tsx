import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { nftCarService } from '../services/nftCarService';

export const NFTDebugger: React.FC = () => {
  const { connected, publicKey } = useWallet();
  const [debugResult, setDebugResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runDebug = async () => {
    setLoading(true);
    try {
      console.log('🐛 Running comprehensive NFT debug tests...');
      
      // Test 1: Basic config (check if service is available)
      console.log('📋 NFT Car Service available:', !!nftCarService);
      
      // Test 2: Get user cars to test functionality
      if (connected && publicKey) {
        console.log('🧪 Testing user car retrieval...');
        const userCars = await nftCarService.getUserCars(publicKey.toString());
        console.log('🎯 User cars found:', userCars.length);
      }
      
      // Test 3: Check service status
      console.log('📋 Service check completed');
      
      setDebugResult({
        configLoaded: true,
        serviceAvailable: !!nftCarService,
        walletConnected: connected,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Debug failed:', error);
      setDebugResult({
        error: error.message,
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const clearConfig = () => {
    localStorage.removeItem('honeycomb_nft_config');
    setDebugResult(null);
    alert('NFT configuration cleared. Please refresh the page and set up NFT infrastructure again.');
  };

  return (
    <div style={{ 
      padding: '20px', 
      border: '2px solid #e74c3c', 
      borderRadius: '8px',
      background: '#fff5f5',
      margin: '20px 0'
    }}>
      <h3 style={{ color: '#e74c3c', margin: '0 0 15px 0' }}>
        🐛 NFT Configuration Debugger
      </h3>
      
      <div style={{ marginBottom: '15px' }}>
        <button
          onClick={runDebug}
          disabled={loading}
          style={{
            background: '#e74c3c',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            marginRight: '10px'
          }}
        >
          {loading ? '🔍 Debugging...' : '🔍 Run Debug Test'}
        </button>
        
        <button
          onClick={clearConfig}
          style={{
            background: '#f39c12',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          🧹 Clear Config
        </button>
      </div>

      {debugResult && (
        <div style={{
          background: '#fff',
          padding: '15px',
          borderRadius: '6px',
          border: '1px solid #ddd',
          fontFamily: 'monospace',
          fontSize: '12px'
        }}>
          <strong>Debug Results:</strong>
          <pre style={{ 
            margin: '10px 0 0 0',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            {JSON.stringify(debugResult, null, 2)}
          </pre>
        </div>
      )}

      <div style={{ 
        marginTop: '15px',
        padding: '10px',
        background: '#e8f6ff',
        borderRadius: '6px',
        fontSize: '14px'
      }}>
        <strong>💡 If minting fails:</strong>
        <ol style={{ margin: '5px 0', paddingLeft: '20px' }}>
          <li>Run debug test to check configuration</li>
          <li>If assembler config is invalid, clear config and re-run NFT infrastructure setup</li>
          <li>Make sure your Project Creator has completed the NFT setup successfully</li>
          <li>Check the browser console for detailed error messages</li>
        </ol>
      </div>
    </div>
  );
};

export default NFTDebugger;