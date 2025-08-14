import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { createEdgeClient } from '@honeycomb-protocol/edge-client';
import { sendClientTransactions } from '@honeycomb-protocol/edge-client/client/walletHelpers';

interface Tournament {
  id: string;
  name: string;
  description: string;
  entryFee: number;
  prizePool: number;
  maxParticipants: number;
  currentParticipants: number;
  startTime: Date;
  endTime: Date;
  status: 'upcoming' | 'active' | 'completed';
  difficulty: 'Rookie' | 'Pro' | 'Elite';
  requirements: string[];
  rewards: {
    first: number;
    second: number;
    third: number;
    participation: number;
  };
  participants: TournamentParticipant[];
}

interface TournamentParticipant {
  walletAddress: string;
  username: string;
  score: number;
  rank: number;
  carUsed?: string;
  completedAt?: Date;
}

const SAMPLE_TOURNAMENTS: Tournament[] = [
  {
    id: 'weekly_speedster',
    name: 'Weekly Speedster Cup',
    description: 'High-speed tournament for the fastest racers. Reach top speeds to win!',
    entryFee: 1000,
    prizePool: 50000,
    maxParticipants: 50,
    currentParticipants: 23,
    startTime: new Date(Date.now() + 3600000), // 1 hour from now
    endTime: new Date(Date.now() + 86400000 * 3), // 3 days from now
    status: 'upcoming',
    difficulty: 'Pro',
    requirements: ['Own at least 1 NFT car', 'Minimum 5 races completed'],
    rewards: {
      first: 20000,
      second: 15000,
      third: 10000,
      participation: 500
    },
    participants: []
  },
  {
    id: 'rookie_rally',
    name: 'Rookie Rally Championship',
    description: 'Perfect for new racers! Learn the ropes and earn your first tournament rewards.',
    entryFee: 500,
    prizePool: 25000,
    maxParticipants: 100,
    currentParticipants: 67,
    startTime: new Date(Date.now() - 3600000), // Started 1 hour ago
    endTime: new Date(Date.now() + 86400000), // 1 day remaining
    status: 'active',
    difficulty: 'Rookie',
    requirements: ['Complete tutorial race'],
    rewards: {
      first: 10000,
      second: 7000,
      third: 5000,
      participation: 250
    },
    participants: []
  },
  {
    id: 'elite_masters',
    name: 'Elite Masters Grand Prix',
    description: 'The ultimate challenge for legendary racers. Only the best need apply!',
    entryFee: 5000,
    prizePool: 200000,
    maxParticipants: 20,
    currentParticipants: 18,
    startTime: new Date(Date.now() + 86400000 * 2), // 2 days from now
    endTime: new Date(Date.now() + 86400000 * 5), // 5 days from now
    status: 'upcoming',
    difficulty: 'Elite',
    requirements: ['Own all 3 NFT car types', 'Win at least 10 tournaments', 'Minimum 100 races'],
    rewards: {
      first: 100000,
      second: 60000,
      third: 40000,
      participation: 1000
    },
    participants: []
  }
];

export const TournamentSystem: React.FC = () => {
  const { connected, publicKey, wallet, signTransaction, signAllTransactions } = useWallet();
  const [tournaments, setTournaments] = useState<Tournament[]>(SAMPLE_TOURNAMENTS);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userTokenBalance, setUserTokenBalance] = useState(10000); // Mock balance
  const [userTournamentHistory, setUserTournamentHistory] = useState<string[]>([]);

  const client = createEdgeClient(
    import.meta.env.VITE_PUBLIC_HONEYCOMB_API_URL || 'https://edge.test.honeycombprotocol.com/',
    true
  );

  const projectAddress = import.meta.env.VITE_PUBLIC_HONEYCOMB_PROJECT_ADDRESS;
  const speedyTokenMint = import.meta.env.VITE_SPEEDY_TOKEN_MINT;

  useEffect(() => {
    loadUserTournamentHistory();
  }, [publicKey]);

  const loadUserTournamentHistory = () => {
    if (publicKey) {
      const history = JSON.parse(
        localStorage.getItem(`tournament_history_${publicKey.toString()}`) || '[]'
      );
      setUserTournamentHistory(history);
    }
  };

  const joinTournament = async (tournamentId: string) => {
    if (!connected || !publicKey || !projectAddress) {
      setError('Please connect wallet and ensure project is set up');
      return;
    }

    const tournament = tournaments.find(t => t.id === tournamentId);
    if (!tournament) return;

    if (userTokenBalance < tournament.entryFee) {
      setError(`Insufficient SPEEDY tokens. Need ${tournament.entryFee}, you have ${userTokenBalance}`);
      return;
    }

    if (tournament.currentParticipants >= tournament.maxParticipants) {
      setError('Tournament is full');
      return;
    }

    if (userTournamentHistory.includes(tournamentId)) {
      setError('You are already registered for this tournament');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create tournament entry transaction
      const entryParams = {
        project: projectAddress,
        payer: publicKey.toString(),
        amount: tournament.entryFee,
        spendType: 'TournamentEntry' // From the IDL
      };

      // This would use your SPEEDY token contract to spend tokens for tournament entry
      // For demo purposes, we'll simulate the transaction
      
      // Simulate spending tokens and joining tournament
      setUserTokenBalance(prev => prev - tournament.entryFee);
      
      // Add participant to tournament
      const updatedTournaments = tournaments.map(t => {
        if (t.id === tournamentId) {
          return {
            ...t,
            currentParticipants: t.currentParticipants + 1,
            participants: [...t.participants, {
              walletAddress: publicKey.toString(),
              username: `Player_${publicKey.toString().slice(-4)}`,
              score: 0,
              rank: t.currentParticipants + 1
            }]
          };
        }
        return t;
      });
      
      setTournaments(updatedTournaments);
      
      // Save to user's tournament history
      const newHistory = [...userTournamentHistory, tournamentId];
      setUserTournamentHistory(newHistory);
      localStorage.setItem(
        `tournament_history_${publicKey.toString()}`,
        JSON.stringify(newHistory)
      );

      alert(`🎉 Successfully joined ${tournament.name}! Entry fee: ${tournament.entryFee} SPEEDY tokens`);
      
    } catch (error: any) {
      console.error('Error joining tournament:', error);
      setError(error.message || 'Failed to join tournament');
    } finally {
      setLoading(false);
    }
  };

  const simulateRaceResult = (tournamentId: string) => {
    if (!publicKey) return;

    const tournament = tournaments.find(t => t.id === tournamentId);
    if (!tournament) return;

    // Simulate a race result
    const score = Math.floor(Math.random() * 10000) + 5000; // Random score between 5000-15000
    const rank = Math.floor(Math.random() * Math.min(tournament.currentParticipants, 10)) + 1;
    
    let reward = tournament.rewards.participation;
    if (rank === 1) reward = tournament.rewards.first;
    else if (rank === 2) reward = tournament.rewards.second; 
    else if (rank === 3) reward = tournament.rewards.third;

    setUserTokenBalance(prev => prev + reward);

    alert(`🏁 Race completed!\n\nScore: ${score.toLocaleString()}\nRank: #${rank}\nReward: ${reward.toLocaleString()} SPEEDY tokens`);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Rookie': return '#28a745';
      case 'Pro': return '#ffc107';
      case 'Elite': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return '#17a2b8';
      case 'active': return '#28a745';
      case 'completed': return '#6c757d';
      default: return '#6c757d';
    }
  };

  const formatTimeRemaining = (endTime: Date) => {
    const now = new Date();
    const diff = endTime.getTime() - now.getTime();
    
    if (diff <= 0) return 'Ended';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h2>🏆 Tournament System</h2>
      
      {/* User Stats */}
      {connected && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '15px',
          marginBottom: '30px'
        }}>
          <div style={{
            background: '#fff3cd',
            padding: '15px',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: '0 0 5px 0', color: '#856404' }}>SPEEDY Balance</h3>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
              {userTokenBalance.toLocaleString()}
            </p>
          </div>
          
          <div style={{
            background: '#e7f3ff',
            padding: '15px',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: '0 0 5px 0', color: '#0066cc' }}>Tournaments Joined</h3>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
              {userTournamentHistory.length}
            </p>
          </div>
          
          <div style={{
            background: '#d4edda',
            padding: '15px',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: '0 0 5px 0', color: '#155724' }}>Active Tournaments</h3>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
              {tournaments.filter(t => t.status === 'active').length}
            </p>
          </div>
        </div>
      )}

      {/* Tournament Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
        gap: '25px',
        marginBottom: '30px'
      }}>
        {tournaments.map((tournament) => {
          const isJoined = userTournamentHistory.includes(tournament.id);
          const canJoin = connected && publicKey && tournament.status !== 'completed' && 
                         userTokenBalance >= tournament.entryFee && 
                         tournament.currentParticipants < tournament.maxParticipants &&
                         !isJoined;

          return (
            <div
              key={tournament.id}
              style={{
                background: '#fff',
                border: '2px solid #dee2e6',
                borderRadius: '12px',
                padding: '20px',
                position: 'relative'
              }}
            >
              {/* Status Badge */}
              <div style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                background: getStatusColor(tournament.status),
                color: 'white',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 'bold',
                textTransform: 'uppercase'
              }}>
                {tournament.status}
              </div>

              {/* Tournament Header */}
              <div style={{ marginBottom: '15px', paddingRight: '80px' }}>
                <h3 style={{ 
                  margin: '0 0 8px 0', 
                  fontSize: '20px',
                  color: '#333'
                }}>
                  {tournament.name}
                </h3>
                <span style={{
                  background: getDifficultyColor(tournament.difficulty),
                  color: 'white',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  {tournament.difficulty}
                </span>
              </div>

              <p style={{ 
                fontSize: '14px', 
                color: '#666',
                lineHeight: '1.4',
                marginBottom: '15px'
              }}>
                {tournament.description}
              </p>

              {/* Tournament Details */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '15px',
                marginBottom: '15px'
              }}>
                <div>
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#666' }}>Entry Fee:</span>
                    <br />
                    <span style={{ fontWeight: 'bold', color: '#ff6b35' }}>
                      {tournament.entryFee.toLocaleString()} SPEEDY
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: '#666' }}>Participants:</span>
                    <br />
                    <span style={{ fontWeight: 'bold' }}>
                      {tournament.currentParticipants}/{tournament.maxParticipants}
                    </span>
                  </div>
                </div>
                
                <div>
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#666' }}>Prize Pool:</span>
                    <br />
                    <span style={{ fontWeight: 'bold', color: '#28a745' }}>
                      {tournament.prizePool.toLocaleString()} SPEEDY
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: '#666' }}>Time Remaining:</span>
                    <br />
                    <span style={{ fontWeight: 'bold' }}>
                      {formatTimeRemaining(tournament.endTime)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Prize Breakdown */}
              <div style={{
                background: '#f8f9fa',
                padding: '12px',
                borderRadius: '6px',
                marginBottom: '15px'
              }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Prize Distribution:</h4>
                <div style={{ fontSize: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                  <span>🥇 1st: {tournament.rewards.first.toLocaleString()}</span>
                  <span>🥈 2nd: {tournament.rewards.second.toLocaleString()}</span>
                  <span>🥉 3rd: {tournament.rewards.third.toLocaleString()}</span>
                  <span>🎯 Participation: {tournament.rewards.participation.toLocaleString()}</span>
                </div>
              </div>

              {/* Requirements */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Requirements:</h4>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#666' }}>
                  {tournament.requirements.map((req, index) => (
                    <li key={index}>{req}</li>
                  ))}
                </ul>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px' }}>
                {!isJoined ? (
                  <button
                    onClick={() => joinTournament(tournament.id)}
                    disabled={!canJoin || loading}
                    style={{
                      flex: 1,
                      background: canJoin ? '#ff6b35' : '#6c757d',
                      color: 'white',
                      border: 'none',
                      padding: '12px',
                      borderRadius: '6px',
                      cursor: canJoin ? 'pointer' : 'not-allowed',
                      fontWeight: 'bold'
                    }}
                  >
                    {loading ? 'Joining...' : 
                     tournament.status === 'completed' ? 'Tournament Ended' :
                     tournament.currentParticipants >= tournament.maxParticipants ? 'Full' :
                     userTokenBalance < tournament.entryFee ? 'Insufficient Funds' :
                     !connected ? 'Connect Wallet' : 'Join Tournament'}
                  </button>
                ) : (
                  <>
                    <div style={{
                      flex: 1,
                      background: '#28a745',
                      color: 'white',
                      padding: '12px',
                      borderRadius: '6px',
                      textAlign: 'center',
                      fontWeight: 'bold'
                    }}>
                      ✅ Joined
                    </div>
                    {tournament.status === 'active' && (
                      <button
                        onClick={() => simulateRaceResult(tournament.id)}
                        style={{
                          background: '#17a2b8',
                          color: 'white',
                          border: 'none',
                          padding: '12px 20px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          fontSize: '12px'
                        }}
                      >
                        Race Now
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

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
          <p>Connect your wallet to participate in tournaments and compete for SPEEDY token prizes!</p>
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
          <p>Please set up your Honeycomb project first using the Project Creator to enable tournament features.</p>
        </div>
      )}

      {error && (
        <div style={{
          background: '#f8d7da',
          padding: '15px',
          borderRadius: '8px',
          border: '1px solid #f5c6cb',
          marginTop: '20px'
        }}>
          <h4>❌ Error:</h4>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
};

export default TournamentSystem;