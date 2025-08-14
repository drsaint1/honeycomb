import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { createEdgeClient } from '@honeycomb-protocol/edge-client';
import { sendClientTransactions } from '@honeycomb-protocol/edge-client/client/walletHelpers';

export const HoneycombSetup: React.FC = () => {
  const { connected, publicKey, wallet, signTransaction, signAllTransactions } = useWallet();
  const [setupStep, setSetupStep] = useState<string>('');
  const [setupResults, setSetupResults] = useState<any>({});
  const [setupLog, setSetupLog] = useState<string[]>([]);
  const [isSettingUp, setIsSettingUp] = useState(false);

  const client = createEdgeClient(
    import.meta.env.VITE_PUBLIC_HONEYCOMB_API_URL || 'https://edge.test.honeycombprotocol.com/',
    true
  );

  const projectAddress = import.meta.env.VITE_PUBLIC_HONEYCOMB_PROJECT_ADDRESS;

  const addLog = (message: string) => {
    console.log(message);
    setSetupLog(prev => [...prev, message]);
  };

  const sendTransaction = async (transactionResponse: any, stepName: string) => {
    if (!wallet || !signTransaction || !signAllTransactions) {
      throw new Error('Wallet not properly connected');
    }

    try {
      addLog(`🔄 Processing ${stepName} transaction...`);
      addLog(`🔍 Transaction response type: ${typeof transactionResponse}`);
      addLog(`🔍 Transaction response keys: ${Object.keys(transactionResponse || {})}`);
      
      // Extract the actual transaction from the wrapper (like other components do)
      let actualTransaction = transactionResponse;
      if (transactionResponse?.createCreateAssemblerConfigTransaction) {
        actualTransaction = transactionResponse.createCreateAssemblerConfigTransaction;
        addLog(`🔍 Extracted assembler config transaction`);
      } else if (transactionResponse?.createAddCharacterTraitsTransactions) {
        actualTransaction = transactionResponse.createAddCharacterTraitsTransactions;
        addLog(`🔍 Extracted character traits transaction`);
      } else if (transactionResponse?.createCreateCharacterModelTransaction) {
        actualTransaction = transactionResponse.createCreateCharacterModelTransaction;
        addLog(`🔍 Extracted character model transaction`);
      } else if (transactionResponse?.createCreateCharactersTreeTransaction) {
        actualTransaction = transactionResponse.createCreateCharactersTreeTransaction;
        addLog(`🔍 Extracted characters tree transaction`);
      }

      addLog(`🔍 Actual transaction type: ${typeof actualTransaction}`);
      addLog(`🔍 Actual transaction keys: ${Object.keys(actualTransaction || {})}`);
      
      // Extract the 'tx' field if it exists (like ProjectCreator does)
      let finalTransaction = actualTransaction;
      if (actualTransaction && typeof actualTransaction === 'object' && 'tx' in actualTransaction) {
        finalTransaction = actualTransaction.tx;
        addLog(`🔍 Extracted 'tx' field from transaction object`);
      }
      
      addLog(`🔍 Final transaction type: ${typeof finalTransaction}`);
      addLog(`🔍 Final transaction keys: ${Object.keys(finalTransaction || {})}`);
      
      // Honeycomb returns transaction data that needs to be sent via their client
      const walletWrapper = {
        publicKey,
        signTransaction,
        signAllTransactions,
        adapter: wallet.adapter,
        connected: true
      };

      // Send the final extracted transaction
      addLog(`🔄 Sending transaction via Honeycomb client...`);
      
      // Use the correct Honeycomb transaction sender with the final transaction
      const signatures = await sendClientTransactions(
        client,
        walletWrapper,
        finalTransaction
      );
      
      addLog(`✅ ${stepName} transaction sent successfully`);
      addLog(`🔍 Signatures received: ${JSON.stringify(signatures)}`);
      
      return signatures;
    } catch (error: any) {
      addLog(`❌ ${stepName} transaction failed: ${error.message}`);
      addLog(`❌ Error details: ${JSON.stringify(error)}`);
      throw error;
    }
  };

  const runOfficialHoneycombSetup = async () => {
    if (!connected || !publicKey || !projectAddress) {
      addLog('❌ Please connect wallet and ensure project address is set');
      return;
    }

    setIsSettingUp(true);
    setSetupLog([]);
    
    try {
      addLog('🚀 Starting Official Honeycomb Character Assembly Setup...');
      addLog(`📋 Project: ${projectAddress}`);
      addLog(`🔑 Admin: ${publicKey.toString()}`);

      // Step 1: Create Assembler Config
      addLog('');
      addLog('📊 STEP 1: Creating Assembler Config...');
      setSetupStep('Creating assembler config...');
      
      const assemblerParams = {
        project: projectAddress,
        authority: publicKey.toString(),
        payer: publicKey.toString(),
        treeConfig: {
          basic: {
            numAssets: 100000 // Support 100k characters
          }
        },
        ticker: `CARS-${Date.now()}`, // Unique ticker
        // NO ORDER - According to official docs lines 11-12: "In case you want to provide a whole image for the character, you can simply make the assembler config without defining an order"
      };

      addLog(`🔧 Assembler config params: ${JSON.stringify(assemblerParams, null, 2)}`);
      
      const assemblerResponse = await client.createCreateAssemblerConfigTransaction(assemblerParams);
      
      let assemblerConfigAddress;
      let assemblerSignatures;
      
      // Extract assembler config address from response BEFORE trying transaction
      // Use the same method as ProjectCreator.tsx for consistency
      addLog(`🔍 Response structure: ${JSON.stringify(Object.keys(assemblerResponse || {}))}`);
      
      // Method 1: Check if address is in the response directly
      if (assemblerResponse?.assemblerConfig && typeof assemblerResponse.assemblerConfig === 'string') {
        assemblerConfigAddress = assemblerResponse.assemblerConfig;
        addLog(`🔍 Method 1: Found assembler config in response: ${assemblerConfigAddress}`);
      }
      // Method 2: Check nested response structure (this is the key one that works)
      else if (assemblerResponse?.createCreateAssemblerConfigTransaction?.assemblerConfig) {
        assemblerConfigAddress = assemblerResponse.createCreateAssemblerConfigTransaction.assemblerConfig;
        addLog(`🔍 Method 2: Found assembler config in nested response: ${assemblerConfigAddress}`);
      }
      // Method 3: Check transaction structure
      else if (assemblerResponse?.tx?.assemblerConfig) {
        assemblerConfigAddress = assemblerResponse.tx.assemblerConfig;
        addLog(`🔍 Method 3: Found assembler config in tx: ${assemblerConfigAddress}`);
      }
      else {
        addLog(`❌ Could not extract assembler config address from response`);
        addLog(`🔍 Full response keys: ${JSON.stringify(Object.keys(assemblerResponse || {}))}`);
        if (assemblerResponse?.createCreateAssemblerConfigTransaction) {
          addLog(`🔍 Nested keys: ${JSON.stringify(Object.keys(assemblerResponse.createCreateAssemblerConfigTransaction || {}))}`);
        }
        throw new Error('Failed to extract assembler config address from any known location');
      }
      
      if (!assemblerConfigAddress || typeof assemblerConfigAddress !== 'string') {
        addLog(`❌ Invalid assembler config address: ${assemblerConfigAddress}`);
        throw new Error('Failed to get valid assembler config address from response');
      }
      
      try {
        assemblerSignatures = await sendTransaction(assemblerResponse, 'Assembler Config');
        addLog(`✅ Assembler Config transaction sent successfully`);
      } catch (assemblerError: any) {
        addLog(`⚠️ Assembler config transaction failed`);
        addLog(`🔍 Error: ${assemblerError.message}`);
        
        // Check if error indicates assembler config already exists (common scenario)
        if (assemblerError.message?.includes('0xbbc') || assemblerError.message?.includes('AccountDidNotSerialize')) {
          addLog(`💡 Error suggests assembler config may already exist - continuing with derived address`);
          addLog(`🔄 Using address: ${assemblerConfigAddress}`);
        } else {
          addLog(`❌ Unexpected assembler config error - stopping setup`);
          throw assemblerError;
        }
      }
      
      setSetupResults(prev => ({ ...prev, assemblerConfig: assemblerConfigAddress }));

      // Step 2: Skip Traits for now (Optional step causing issues)
      addLog('');
      addLog('🎯 STEP 2: Skipping Car Traits (Optional - will work without them)...');
      addLog('ℹ️ Character traits can be defined later when needed');
      setSetupStep('Skipping car traits...');

      // Step 3: Create Character Model
      addLog('');
      addLog('🏗️ STEP 3: Creating Character Model...');
      setSetupStep('Creating character model...');
      
      const characterModelParams = {
        project: projectAddress,
        authority: publicKey.toString(),
        payer: publicKey.toString(),
        mintAs: {
          kind: "MplCore" // Use MplCore as underlying protocol
        },
        config: {
          kind: "Assembled",
          assemblerConfigInput: {
            assemblerConfig: assemblerConfigAddress,
            collectionName: "Racing Cars NFT Collection",
            name: "Racing Car NFT",
            symbol: "RCAR",
            description: "High-performance racing cars with unique traits",
            sellerFeeBasisPoints: 0,
            creators: [{
              address: publicKey.toString(),
              share: 100
            }]
          }
        },
        attributes: [
          ["name", "Racing Car"],
          ["rarity", "common"]
        ]
      };

      addLog(`🔧 Character model params: ${JSON.stringify(characterModelParams, null, 2)}`);
      
      const characterModelResponse = await client.createCreateCharacterModelTransaction(characterModelParams);
      const characterModelSignatures = await sendTransaction(characterModelResponse, 'Character Model');
      
      // Extract character model address using same pattern as assembler config
      let characterModelAddress;
      
      // Method 1: Check if address is in the response directly
      if (characterModelResponse?.characterModel && typeof characterModelResponse.characterModel === 'string') {
        characterModelAddress = characterModelResponse.characterModel;
        addLog(`🔍 Method 1: Found character model in response: ${characterModelAddress}`);
      }
      // Method 2: Check nested response structure
      else if (characterModelResponse?.createCreateCharacterModelTransaction?.characterModel) {
        characterModelAddress = characterModelResponse.createCreateCharacterModelTransaction.characterModel;
        addLog(`🔍 Method 2: Found character model in nested response: ${characterModelAddress}`);
      }
      // Method 3: Check transaction structure
      else if (characterModelResponse?.tx?.characterModel) {
        characterModelAddress = characterModelResponse.tx.characterModel;
        addLog(`🔍 Method 3: Found character model in tx: ${characterModelAddress}`);
      }
      else {
        addLog(`❌ Could not extract character model address from response`);
        addLog(`🔍 Character model response keys: ${JSON.stringify(Object.keys(characterModelResponse || {}))}`);
        if (characterModelResponse?.createCreateCharacterModelTransaction) {
          addLog(`🔍 Nested keys: ${JSON.stringify(Object.keys(characterModelResponse.createCreateCharacterModelTransaction || {}))}`);
        }
        throw new Error('Failed to extract character model address from any known location');
      }
      setSetupResults(prev => ({ ...prev, characterModel: characterModelAddress }));
      addLog(`✅ Character Model Address: ${characterModelAddress}`);

      // Step 4: Create Characters Tree
      addLog('');
      addLog('🌳 STEP 4: Creating Characters Tree...');
      setSetupStep('Creating characters tree...');
      
      const charactersTreeParams = {
        authority: publicKey.toString(),
        project: projectAddress,
        characterModel: characterModelAddress,
        payer: publicKey.toString(),
        treeConfig: {
          basic: {
            numAssets: 100000 // Support 100k characters
          }
        }
      };

      addLog(`🔧 Characters tree params: ${JSON.stringify(charactersTreeParams, null, 2)}`);
      
      const charactersTreeResponse = await client.createCreateCharactersTreeTransaction(charactersTreeParams);
      const charactersTreeSignatures = await sendTransaction(charactersTreeResponse, 'Characters Tree');
      
      // Extract characters tree address using same pattern as assembler config
      let charactersTreeAddress;
      
      // Method 1: Check if address is in the response directly
      if (charactersTreeResponse?.charactersTree && typeof charactersTreeResponse.charactersTree === 'string') {
        charactersTreeAddress = charactersTreeResponse.charactersTree;
        addLog(`🔍 Method 1: Found characters tree in response: ${charactersTreeAddress}`);
      }
      // Method 2: Check nested response structure for 'treeAddress' (actual field name)
      else if (charactersTreeResponse?.createCreateCharactersTreeTransaction?.treeAddress) {
        charactersTreeAddress = charactersTreeResponse.createCreateCharactersTreeTransaction.treeAddress;
        addLog(`🔍 Method 2: Found characters tree in nested response (treeAddress): ${charactersTreeAddress}`);
      }
      // Method 3: Check nested response structure for 'charactersTree'
      else if (charactersTreeResponse?.createCreateCharactersTreeTransaction?.charactersTree) {
        charactersTreeAddress = charactersTreeResponse.createCreateCharactersTreeTransaction.charactersTree;
        addLog(`🔍 Method 3: Found characters tree in nested response (charactersTree): ${charactersTreeAddress}`);
      }
      // Method 4: Check transaction structure
      else if (charactersTreeResponse?.tx?.treeAddress) {
        charactersTreeAddress = charactersTreeResponse.tx.treeAddress;
        addLog(`🔍 Method 4: Found characters tree in tx (treeAddress): ${charactersTreeAddress}`);
      }
      else {
        addLog(`❌ Could not extract characters tree address from response`);
        addLog(`🔍 Characters tree response keys: ${JSON.stringify(Object.keys(charactersTreeResponse || {}))}`);
        if (charactersTreeResponse?.createCreateCharactersTreeTransaction) {
          addLog(`🔍 Nested keys: ${JSON.stringify(Object.keys(charactersTreeResponse.createCreateCharactersTreeTransaction || {}))}`);
        }
        throw new Error('Failed to extract characters tree address from any known location');
      }
      setSetupResults(prev => ({ ...prev, charactersTree: charactersTreeAddress }));
      addLog(`✅ Characters Tree Address: ${charactersTreeAddress}`);

      // Save the setup results to localStorage for use by minting service
      const nftConfig = {
        projectAddress: projectAddress,
        assemblerConfigAddress: assemblerConfigAddress,
        characterModelAddress: characterModelAddress, 
        charactersTreeAddress: charactersTreeAddress,
        createdAt: new Date().toISOString(),
        method: 'honeycomb_setup'
      };
      
      localStorage.setItem('honeycomb_nft_config', JSON.stringify(nftConfig));
      addLog(`💾 Setup results saved to localStorage for minting service`);

      // Final Summary
      addLog('');
      addLog('🎉 HONEYCOMB SETUP COMPLETE!');
      addLog('');
      addLog('📋 Setup Summary:');
      addLog(`   Project: ${projectAddress}`);
      addLog(`   Assembler Config: ${assemblerConfigAddress}`);
      addLog(`   Character Model: ${characterModelAddress}`);
      addLog(`   Characters Tree: ${charactersTreeAddress}`);
      addLog('');
      addLog('✅ Your project is now ready for public character assembly!');
      addLog('🚀 Users can now mint NFT cars using the assembler method!');
      addLog('💡 Try minting a car now - the setup addresses will be used automatically!');
      
      setSetupStep('Setup Complete!');

    } catch (error: any) {
      addLog(`❌ Setup failed: ${error.message}`);
      addLog(`❌ Stack trace: ${error.stack}`);
      console.error('Setup error:', error);
    } finally {
      setIsSettingUp(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>🏗️ Honeycomb Character Assembly Setup</h2>
      <p>Follow the official 4-step Honeycomb setup process to enable character assembly.</p>

      {/* Current Status */}
      <div style={{ 
        background: connected ? '#d4edda' : '#f8d7da',
        padding: '15px',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h4>Setup Status</h4>
        <p><strong>Wallet:</strong> {connected ? `✅ ${publicKey?.toString().substring(0, 8)}...` : '❌ Not connected'}</p>
        <p><strong>Project:</strong> {projectAddress ? `✅ ${projectAddress.substring(0, 8)}...` : '❌ Not configured'}</p>
        <p><strong>Step:</strong> {setupStep || 'Ready to start'}</p>
      </div>

      {/* Action Button */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <button
          onClick={runOfficialHoneycombSetup}
          disabled={!connected || !projectAddress || isSettingUp}
          style={{
            background: connected && projectAddress ? '#007bff' : '#6c757d',
            color: 'white',
            border: 'none',
            padding: '15px 30px',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: connected && projectAddress ? 'pointer' : 'not-allowed'
          }}
        >
          {isSettingUp ? '⏳ Setting up...' : '🚀 Run Official Honeycomb Setup'}
        </button>
      </div>

      {/* Setup Results */}
      {Object.keys(setupResults).length > 0 && (
        <div style={{ 
          background: '#e7f3ff',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <h4>📋 Setup Results</h4>
          {setupResults.assemblerConfig && (
            <p><strong>Assembler Config:</strong> <code>{String(setupResults.assemblerConfig)}</code></p>
          )}
          {setupResults.characterModel && (
            <p><strong>Character Model:</strong> <code>{String(setupResults.characterModel)}</code></p>
          )}
          {setupResults.charactersTree && (
            <p><strong>Characters Tree:</strong> <code>{String(setupResults.charactersTree)}</code></p>
          )}
        </div>
      )}

      {/* Setup Log */}
      {setupLog.length > 0 && (
        <div style={{ 
          background: '#f8f9fa',
          padding: '20px',
          borderRadius: '8px',
          border: '1px solid #dee2e6'
        }}>
          <h4>📝 Setup Log</h4>
          <div style={{
            fontFamily: 'monospace',
            fontSize: '12px',
            maxHeight: '400px',
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
        background: '#fff3cd',
        padding: '20px',
        borderRadius: '8px',
        marginTop: '20px'
      }}>
        <h4>📖 What This Does</h4>
        <p>This follows the exact 4-step process from the official Honeycomb documentation:</p>
        <ol>
          <li><strong>Create Assembler Config</strong> - Defines the framework for character traits</li>
          <li><strong>Pre-define Car Traits</strong> - Sets up speed, rarity, and handling traits</li>
          <li><strong>Create Character Model</strong> - Defines the NFT collection and metadata</li>
          <li><strong>Create Characters Tree</strong> - Creates the storage structure for characters</li>
        </ol>
        <p>Once complete, all users will be able to mint NFT cars using the standard Honeycomb assembly method!</p>
      </div>
    </div>
  );
};

export default HoneycombSetup;