// App.tsx - COMPREHENSIVE HONEYCOMB RACING GAME
import React, { useState, useMemo, useEffect } from "react";
import WalletIntegration from "./components/WalletIntegration";
import HoneycombCarGame from "./components/HoneycombCarGame";
import ProjectCreator from "./components/ProjectCreator";
import HoneycombSetup from "./components/HoneycombSetup";
import DailyChallenges from "./components/DailyChallenges";
import TournamentSystem from "./components/TournamentSystem";
import CarStaking from "./components/CarStaking";
import CarMinting from "./components/CarMinting";
import CarSelectionPage from "./components/CarSelectionPage";
import ErrorBoundary from "./components/ErrorBoundary";

import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

type ViewType = 'menu' | 'game' | 'project' | 'setup' | 'challenges' | 'tournaments' | 'staking' | 'minting' | 'car-selection';

function App() {
  const [currentView, setCurrentView] = useState<ViewType>('menu');
  const [walletConnected, setWalletConnected] = useState(false);

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );


  // Use test network endpoint
  const endpoint = "https://rpc.test.honeycombprotocol.com";

  const handleWalletConnect = () => {
    setWalletConnected(true);
  };

  const startGame = () => {
    if (!walletConnected) {
      alert("Please connect your wallet first!");
      return;
    }

    // Check if project address is configured
    const projectAddress = import.meta.env
      .VITE_PUBLIC_HONEYCOMB_PROJECT_ADDRESS;
    if (!projectAddress) {
      alert(
        "⚠️ No Honeycomb project found!\n\nPlease create a project first using the Project Creator."
      );
      setCurrentView('project');
      return;
    }

    setCurrentView('game');
  };

  const navigateToView = (view: ViewType) => {
    if (view !== 'menu' && view !== 'project' && !walletConnected) {
      alert("Please connect your wallet first!");
      return;
    }
    setCurrentView(view);
  };

  const renderNavigationHeader = () => (
    <div style={{
      position: 'absolute',
      top: '20px',
      left: '20px',
      right: '20px',
      zIndex: 1000,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <div>
        {currentView !== 'menu' && (
          <button
            onClick={() => navigateToView('menu')}
            style={{
              background: "rgba(0,0,0,0.8)",
              border: "2px solid #ffd700",
              color: "#ffd700",
              padding: "10px 15px",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "bold",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#ffd700";
              e.currentTarget.style.color = "black";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(0,0,0,0.8)";
              e.currentTarget.style.color = "#ffd700";
            }}
          >
            ← Menu
          </button>
        )}
      </div>
      
      {/* Project Status Indicator */}
      <div style={{
        background: import.meta.env.VITE_PUBLIC_HONEYCOMB_PROJECT_ADDRESS ? 
          'rgba(40, 167, 69, 0.8)' : 'rgba(220, 53, 69, 0.8)',
        color: 'white',
        padding: '6px 12px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 'bold'
      }}>
        {import.meta.env.VITE_PUBLIC_HONEYCOMB_PROJECT_ADDRESS ? 
          '✅ Project Setup' : '⚠️ Setup Required'}
      </div>
    </div>
  );

  const renderContent = () => {
    switch (currentView) {
      case 'game':
        return <HoneycombCarGame />;
      case 'project':
        return <ProjectCreator />;
      case 'setup':
        return <HoneycombSetup />;
      case 'challenges':
        return <DailyChallenges />;
      case 'tournaments':
        return <TournamentSystem />;
      case 'staking':
        return <CarStaking />;
      case 'minting':
        return <CarMinting />;
      case 'car-selection':
        return <CarSelectionPage />;
      case 'menu':
      default:
        return renderMainMenu();
    }
  };

  const renderMainMenu = () => (
    <>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
          padding: "40px",
          background: "rgba(0,0,0,0.3)",
          borderRadius: "20px",
          border: "2px solid #ffd700",
          maxWidth: "900px",
          width: "90%",
        }}
      >
        <h1
          style={{
            margin: "0 0 20px 0",
            fontSize: "48px",
            background: "linear-gradient(45deg, #ffd700, #ffed4e)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          🍯 Honeycomb Racer
        </h1>

        <p style={{ margin: "0 0 25px 0", fontSize: "20px" }}>
          Complete blockchain racing ecosystem with NFTs, tokens & tournaments!
        </p>

        {/* Feature Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px',
          margin: '30px 0'
        }}>
          <div style={{
            background: 'rgba(255, 215, 0, 0.1)',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 215, 0, 0.3)'
          }}>
            <h3 style={{ color: '#ffd700', margin: '0 0 10px 0' }}>🏁 Racing Game</h3>
            <p style={{ fontSize: '14px', margin: 0 }}>
              High-speed racing with NFT car selection, blockchain achievements and permanent progression
            </p>
            <button
              onClick={startGame}
              disabled={!walletConnected}
              style={{
                width: '100%',
                background: walletConnected ? '#28a745' : '#6c757d',
                color: 'white',
                border: 'none',
                padding: '10px',
                borderRadius: '6px',
                cursor: walletConnected ? 'pointer' : 'not-allowed',
                marginTop: '10px',
                fontWeight: 'bold'
              }}
            >
              🏁 Start Racing
            </button>
          </div>

          <div style={{
            background: 'rgba(255, 107, 53, 0.1)',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 107, 53, 0.3)'
          }}>
            <h3 style={{ color: '#ff6b35', margin: '0 0 10px 0' }}>🏎️ NFT Cars</h3>
            <p style={{ fontSize: '14px', margin: 0 }}>
              Mint, collect, and stake racing cars to earn SPEEDY token rewards
            </p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button
                onClick={() => navigateToView('minting')}
                style={{
                  flex: 1,
                  background: '#ff6b35',
                  color: 'white',
                  border: 'none',
                  padding: '10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '12px'
                }}
              >
                🎯 Mint
              </button>
              <button
                onClick={() => navigateToView('car-selection')}
                style={{
                  flex: 1,
                  background: '#007bff',
                  color: 'white',
                  border: 'none',
                  padding: '10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '12px'
                }}
              >
                🏎️ Select
              </button>
            </div>
          </div>

          <div style={{
            background: 'rgba(40, 167, 69, 0.1)',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid rgba(40, 167, 69, 0.3)'
          }}>
            <h3 style={{ color: '#28a745', margin: '0 0 10px 0' }}>🎯 Car Staking</h3>
            <p style={{ fontSize: '14px', margin: 0 }}>
              Stake your NFT cars to earn passive SPEEDY token rewards over time
            </p>
            <button
              onClick={() => navigateToView('staking')}
              style={{
                width: '100%',
                background: '#28a745',
                color: 'white',
                border: 'none',
                padding: '10px',
                borderRadius: '6px',
                cursor: 'pointer',
                marginTop: '10px',
                fontWeight: 'bold'
              }}
            >
              💰 Stake Cars
            </button>
          </div>

          <div style={{
            background: 'rgba(23, 162, 184, 0.1)',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid rgba(23, 162, 184, 0.3)'
          }}>
            <h3 style={{ color: '#17a2b8', margin: '0 0 10px 0' }}>📅 Daily Challenges</h3>
            <p style={{ fontSize: '14px', margin: 0 }}>
              Complete daily challenges to earn SPEEDY tokens and unlock achievements
            </p>
            <button
              onClick={() => navigateToView('challenges')}
              style={{
                width: '100%',
                background: '#17a2b8',
                color: 'white',
                border: 'none',
                padding: '10px',
                borderRadius: '6px',
                cursor: 'pointer',
                marginTop: '10px',
                fontWeight: 'bold'
              }}
            >
              🎯 View Challenges
            </button>
          </div>

          <div style={{
            background: 'rgba(102, 16, 242, 0.1)',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid rgba(102, 16, 242, 0.3)'
          }}>
            <h3 style={{ color: '#6610f2', margin: '0 0 10px 0' }}>🏆 Tournaments</h3>
            <p style={{ fontSize: '14px', margin: 0 }}>
              Compete in tournaments with entry fees and win massive SPEEDY prizes
            </p>
            <button
              onClick={() => navigateToView('tournaments')}
              style={{
                width: '100%',
                background: '#6610f2',
                color: 'white',
                border: 'none',
                padding: '10px',
                borderRadius: '6px',
                cursor: 'pointer',
                marginTop: '10px',
                fontWeight: 'bold'
              }}
            >
              🏅 Join Tournaments
            </button>
          </div>

          <div style={{
            background: 'rgba(253, 126, 20, 0.1)',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid rgba(253, 126, 20, 0.3)'
          }}>
            <h3 style={{ color: '#fd7e14', margin: '0 0 10px 0' }}>🛠️ Project Setup</h3>
            <p style={{ fontSize: '14px', margin: 0 }}>
              Create and manage your Honeycomb project with full blockchain integration
            </p>
            <button
              onClick={() => navigateToView('project')}
              style={{
                width: '100%',
                background: '#fd7e14',
                color: 'white',
                border: 'none',
                padding: '10px',
                borderRadius: '6px',
                cursor: 'pointer',
                marginTop: '10px',
                fontWeight: 'bold'
              }}
            >
              ⚙️ Manage Project
            </button>
          </div>

          {/* Honeycomb Official Setup */}
          <div style={{
            background: 'rgba(0, 123, 255, 0.1)',
            padding: '20px',
            borderRadius: '12px',
            border: '2px solid #007bff'
          }}>
            <h3 style={{ color: '#007bff', margin: '0 0 10px 0' }}>🏗️ Honeycomb Setup</h3>
            <p style={{ fontSize: '14px', margin: 0 }}>
              Run the official 4-step Honeycomb character assembly setup process
            </p>
            <button
              onClick={() => navigateToView('setup')}
              style={{
                width: '100%',
                background: '#007bff',
                color: 'white',
                border: 'none',
                padding: '10px',
                borderRadius: '6px',
                cursor: 'pointer',
                marginTop: '10px',
                fontWeight: 'bold'
              }}
            >
              🚀 Official Setup
            </button>
          </div>
        </div>

        {/* Project status check */}
        {!import.meta.env.VITE_PUBLIC_HONEYCOMB_PROJECT_ADDRESS && (
          <div
            style={{
              fontSize: "14px",
              color: "#ffaa00",
              marginBottom: "15px",
              background: "rgba(255,170,0,0.1)",
              padding: "15px",
              borderRadius: "8px",
              border: "1px solid #ffaa00",
            }}
          >
            ⚠️ <strong>Setup Required:</strong> Create your Honeycomb project first to enable all blockchain features
          </div>
        )}

        {!walletConnected && (
          <div
            style={{
              fontSize: "14px",
              color: "#ffaa00",
              marginBottom: "15px",
              background: "rgba(255,170,0,0.1)",
              padding: "10px",
              borderRadius: "8px",
            }}
          >
            ⚠️ Please connect your wallet to access all features
          </div>
        )}

        <div style={{
          marginTop: "20px",
          fontSize: "14px",
          opacity: 0.8,
          background: "rgba(255,215,0,0.1)",
          padding: "15px",
          borderRadius: "10px",
        }}>
          <strong>🎮 Complete Racing Ecosystem:</strong><br />
          • 🏁 High-speed racing with NFT car selection and blockchain rewards<br />
          • 🏎️ NFT car collection with 3 unique designs and gameplay bonuses<br />
          • 💰 SPEEDY token economy with staking rewards<br />
          • 📅 Daily challenges and achievement system<br />
          • 🏆 Competitive tournaments with prize pools<br />
          • 🔗 Permanent on-chain progression via Honeycomb Protocol
        </div>
      </div>

      {/* Background Animation */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          overflow: "hidden",
          zIndex: -1,
          opacity: 0.1,
        }}
      >
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: Math.random() * 100 + "%",
              top: Math.random() * 100 + "%",
              width: "6px",
              height: "20px",
              background: "#ffd700",
              transform: `rotate(${Math.random() * 360}deg)`,
              clipPath:
                "polygon(30% 0%, 70% 0%, 100% 50%, 70% 100%, 30% 100%, 0% 50%)",
              animation: `float ${3 + Math.random() * 4}s ease-in-out infinite ${Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.3; }
          50% { transform: translateY(-20px) rotate(180deg); opacity: 0.8; }
        }
      `}</style>
    </>
  );

  return (
    <ErrorBoundary>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets}>
          <WalletModalProvider>
            <div
              style={{
                width: "100vw",
                height: "100vh",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                position: "fixed",
                top: 0,
                left: 0,
                overflow: currentView === 'menu' || currentView === 'game' ? "hidden" : "auto",
                color: "white",
                fontFamily: "Arial, sans-serif",
              }}
            >
              {renderNavigationHeader()}
              
              <div style={{
                width: "100%",
                height: "100%",
                overflow: currentView === 'menu' || currentView === 'game' ? "hidden" : "auto",
                position: "relative",
              }}>
                <ErrorBoundary>
                  {renderContent()}
                </ErrorBoundary>
              </div>

              {/* Wallet Integration with proper props */}
              <WalletIntegration
                onConnect={handleWalletConnect}
                gameStarted={currentView === 'game'}
              />
            </div>
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </ErrorBoundary>
  );
}

export default App;
