import { useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import { io } from 'socket.io-client';
import './App.css';
import ArenaEditor from './components/ArenaEditor';
import ProctoringCam from './components/ProctoringCam';
import ProblemPrompt from './components/ProblemPrompt';
import Leaderboard from './components/Leaderboard';
import SpectatorView from './components/SpectatorView';
import BattleResult from './components/BattleResult';
import { BACKEND_URL } from './config';

const socket = io(BACKEND_URL);

const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainingSeconds = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainingSeconds}`;
};

const createRoomCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

function App() {
  const [walletAddress, setWalletAddress] = useState('');
  const [roomId, setRoomId] = useState('arena-room-1');
  const [roomStatus, setRoomStatus] = useState('Ready to connect.');
  const [opponentCode, setOpponentCode] = useState('');
  const [inBattle, setInBattle] = useState(false);
  const [role, setRole] = useState(null);
  const [winner, setWinner] = useState(null);
  const [timeLeft, setTimeLeft] = useState(900);
  const [problemSlug, setProblemSlug] = useState('');
  const [view, setView] = useState('arena');
  const [roomCode] = useState(createRoomCode);

  const shortWallet = useMemo(() => {
    if (!walletAddress) {
      return 'Disconnected';
    }

    return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
  }, [walletAddress]);

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask to play AlgoArena!');
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setWalletAddress(address);
      setView('arena');
    } catch (error) {
      console.error('Wallet connection failed:', error);
    }
  };

  useEffect(() => {
    socket.on('room_status', (data) => {
      setRoomStatus(`Players in room: ${data.count}/2`);
    });

    socket.on('battle_start', (data) => {
      setRoomStatus(data.message);
      setProblemSlug(data.problemSlug);
      setInBattle(true);
      setView('battle');
    });

    socket.on('timer_update', (data) => {
      setTimeLeft(data.timeLeft);
    });

    socket.on('match_over', (data) => {
      setWinner(data.winnerId);
      setInBattle(false);
    });

    socket.on('receive_code', (incomingCode) => {
      setOpponentCode(incomingCode);
    });

    return () => {
      socket.off('room_status');
      socket.off('battle_start');
      socket.off('timer_update');
      socket.off('match_over');
      socket.off('receive_code');
    };
  }, []);

  const joinArena = () => {
    if (!walletAddress) {
      alert('Connect wallet first!');
      return;
    }

    setRoomId('arena-room-1');
    setRole('player');
    setView('battle');
    socket.emit('join_room', 'arena-room-1');
  };

  const joinAsSpectator = () => {
    if (!walletAddress) {
      alert('Connect wallet first!');
      return;
    }

    setRoomId('arena-room-1');
    setRole('spectator');
    setView('spectator');
    socket.emit('join_room', 'arena-room-1');
  };

  const resetArena = () => {
    setWinner(null);
    setRoomId('arena-room-1');
    setRole(null);
    setRoomStatus('Ready to connect.');
    setOpponentCode('');
    setTimeLeft(900);
    setProblemSlug('');
    setInBattle(false);
    setView('arena');
  };

  const shellView = () => {
    if (!walletAddress) {
      return (
        <section className="hero-shell">
          <div className="ambient ambient-left" />
          <div className="ambient ambient-right" />
          <div className="hero-copy">
            <span className="badge badge--green">System_Status: Operational // Protocol_Active</span>
            <h1 className="hero-title">
              BLOCKCHAIN <span>VERIFIED</span> CODING BATTLES
            </h1>
            <p className="hero-text">
              1v1 real-time duels with AI proctoring, blockchain-verified results, and live multiplayer sync.
              Host a room, challenge friends, or spectate the arena.
            </p>
            <div className="hero-actions">
              <button className="btn btn--primary" onClick={connectWallet}>CONNECT WALLET</button>
              <button className="btn btn--outline" onClick={joinArena}>ENTER ARENA</button>
              <button className="btn btn--violet" onClick={joinAsSpectator}>WATCH LIVE</button>
            </div>
          </div>

          <div className="hero-grid">
            <article className="feature-card feature-card--green" onClick={joinArena}>
              <div className="feature-card__top">
                <span className="feature-badge">HOST MODE</span>
                <span className="feature-icon">⚔</span>
              </div>
              <h2>Create a Battle Room</h2>
              <p>Generate a room, start the duel, and keep the full proctoring workflow visible.</p>
              <div className="feature-meta">Room: {roomCode}</div>
            </article>

            <article className="feature-card feature-card--violet" onClick={joinAsSpectator}>
              <div className="feature-card__top">
                <span className="feature-badge feature-badge--violet">COMPETE MODE</span>
                <span className="feature-icon">👁</span>
              </div>
              <h2>Join or Challenge</h2>
              <p>Enter a room, challenge a friend, or watch live code evolve in real time.</p>
              <div className="feature-meta">Live proctoring enabled</div>
            </article>
          </div>

          <div className="stats-strip">
            <div><strong>&lt;200ms</strong><span>Sync Latency</span></div>
            <div><strong>100%</strong><span>Proctored</span></div>
            <div><strong>94.2%</strong><span>Face Verify</span></div>
            <div><strong>12,847</strong><span>Coders</span></div>
          </div>
        </section>
      );
    }

    if (view === 'leaderboard' && !inBattle) {
      return (
        <main className="arena-page">
          <section className="panel-shell panel-shell--wide">
            <div className="panel-shell__header">
              <div>
                <span className="badge badge--amber">RANKING</span>
                <h2 className="section-title">Leaderboard</h2>
              </div>
              <div className="status-chip">{shortWallet}</div>
            </div>
            <Leaderboard />
          </section>
        </main>
      );
    }

    if (view === 'profile' && !inBattle) {
      return (
        <main className="arena-page">
          <section className="panel-shell panel-shell--wide">
            <div className="panel-shell__header">
              <div>
                <span className="badge badge--violet">PROFILE</span>
                <h2 className="section-title">Operator Profile</h2>
              </div>
              <div className="status-chip">{shortWallet}</div>
            </div>
            <div className="profile-card">
              <div className="profile-card__row">
                <span>Wallet</span>
                <strong>{shortWallet}</strong>
              </div>
              <div className="profile-card__row">
                <span>Room</span>
                <strong>{roomId}</strong>
              </div>
              <div className="profile-card__row">
                <span>Match State</span>
                <strong>{inBattle ? 'In Battle' : 'Lobby'}</strong>
              </div>
              <div className="profile-card__row">
                <span>Room Code</span>
                <strong>{roomCode}</strong>
              </div>
            </div>
          </section>
        </main>
      );
    }

    if (role === 'spectator' || view === 'spectator') {
      return (
        <main className="arena-page arena-page--spectator">
          <section className="panel-shell panel-shell--wide">
            <div className="panel-shell__header">
              <div>
                <span className="badge badge--violet">SPECTATOR MODE</span>
                <h2 className="section-title">LIVE VIEWERSHIP</h2>
              </div>
              <div className="status-chip">{roomStatus}</div>
            </div>
            <SpectatorView socket={socket} />
          </section>
        </main>
      );
    }

    if (inBattle || view === 'battle') {
      return (
        <main className="battle-shell">
          <div className="battle-statusbar">
            <div className="battle-statusbar__left">
              <span className="status-pill status-pill--green">PROCTORING ACTIVE</span>
              <span className="status-text">DeepFace + plagiarism checks are live</span>
            </div>
            <div className="battle-statusbar__right">
              <span className="status-pill status-pill--danger">{roomId}</span>
              <span className="timer-chip">{formatTime(timeLeft)}</span>
            </div>
          </div>

          <div className="battle-grid">
            <section className="battle-column battle-column--problem">
              <div className="panel-shell panel-shell--compact">
                <div className="panel-shell__header">
                  <div>
                    <span className="badge badge--green">TASK</span>
                    <h2 className="section-title">Battle Prompt</h2>
                  </div>
                </div>
                <ProblemPrompt slug={problemSlug} />
              </div>
            </section>

            <section className="battle-column battle-column--editor">
              <ArenaEditor socket={socket} roomId={roomId} walletAddress={walletAddress} opponentCode={opponentCode} />
            </section>

            <aside className="battle-column battle-column--side">
              <div className="panel-shell panel-shell--compact panel-shell--stack">
                <div>
                  <span className="badge badge--violet">NODE_01</span>
                  <h2 className="section-title">Identity Check</h2>
                </div>
                <ProctoringCam inBattle={inBattle} />
              </div>

              <div className="panel-shell panel-shell--compact">
                <div className="panel-shell__header">
                  <div>
                    <span className="badge badge--amber">LEADERBOARD</span>
                    <h2 className="section-title">Blockchain History</h2>
                  </div>
                </div>
                <Leaderboard />
              </div>
            </aside>
          </div>
        </main>
      );
    }

    return (
      <main className="arena-page">
        <section className="lobby-grid">
          <div className="panel-shell panel-shell--hero">
            <div className="panel-shell__header">
              <div>
                <span className="badge badge--green">CONNECTED</span>
                <h2 className="section-title">Welcome back, operator</h2>
              </div>
              <div className="status-chip">{shortWallet}</div>
            </div>

            <div className="lobby-hero">
              <h1 className="lobby-hero__title">BLOCKCHAIN VERIFIED CODING BATTLES</h1>
              <p className="lobby-hero__copy">
                Challenge a friend, enter as a competitor, or spectate the duel from a clean neon control room.
              </p>
              <div className="hero-actions hero-actions--left">
                <button className="btn btn--primary" onClick={joinArena}>ENTER AS COMBATANT</button>
                <button className="btn btn--outline" onClick={joinAsSpectator}>WATCH AS SPECTATOR</button>
              </div>
            </div>

            <div className="metrics-grid">
              <div className="metric-card"><strong>{formatTime(timeLeft)}</strong><span>Timer Sync</span></div>
              <div className="metric-card"><strong>{roomStatus}</strong><span>Room Status</span></div>
              <div className="metric-card"><strong>{roomCode}</strong><span>Local Room</span></div>
            </div>
          </div>

          <div className="panel-shell panel-shell--stack">
            <div>
              <span className="badge badge--violet">PROFILE</span>
              <h2 className="section-title">Operator Profile</h2>
            </div>
            <div className="profile-card">
              <div className="profile-card__row">
                <span>Wallet</span>
                <strong>{shortWallet}</strong>
              </div>
              <div className="profile-card__row">
                <span>Room</span>
                <strong>{roomId}</strong>
              </div>
              <div className="profile-card__row">
                <span>Match State</span>
                <strong>{inBattle ? 'In Battle' : 'Lobby'}</strong>
              </div>
            </div>
            <div className="quick-actions">
              <button className="btn btn--primary" onClick={connectWallet}>Refresh Wallet</button>
              <button className="btn btn--violet" onClick={() => setView('leaderboard')}>Open Leaderboard</button>
              <button className="btn btn--outline" onClick={() => setView('arena')}>Arena Home</button>
            </div>
          </div>
        </section>

        <section className="panel-shell panel-shell--wide">
          <div className="panel-shell__header">
            <div>
              <span className="badge badge--amber">RANKING</span>
              <h2 className="section-title">Leaderboard</h2>
            </div>
          </div>
          <Leaderboard />
        </section>
      </main>
    );
  };

  const navItems = [
    { id: 'arena', label: 'Arena' },
    { id: 'leaderboard', label: 'Leaderboard' },
    { id: 'profile', label: 'Profile' },
  ];

  return (
    <div className="arena-shell">
      <header className="topbar">
        <div className="topbar__brand" onClick={() => setView('arena')} role="button" tabIndex={0}>
          <span>ALGO_ARENA</span>
        </div>

        <nav className="topbar__nav" aria-label="Primary">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`topbar__nav-item ${view === item.id ? 'is-active' : ''}`}
              onClick={() => setView(item.id)}
              disabled={!walletAddress && item.id !== 'arena'}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="topbar__actions">
          <div className="status-chip status-chip--compact">{shortWallet}</div>
          {!walletAddress ? (
            <button className="btn btn--primary btn--small" onClick={connectWallet}>CONNECT WALLET</button>
          ) : (
            <button className="btn btn--outline btn--small" onClick={() => setView('arena')}>ROOM {roomCode}</button>
          )}
        </div>
      </header>

      <div className="arena-shell__body">
        {shellView()}
      </div>

      {winner && (
        <BattleResult
          winnerId={winner}
          walletAddress={walletAddress}
          role={role}
          resetArena={resetArena}
        />
      )}
    </div>
  );
}

export default App;