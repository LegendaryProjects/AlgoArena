import { useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import { io } from 'socket.io-client';
import axios from 'axios';
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
  
  // NEW: Automatically generate a room code for the host, but allow them to type a different one!
  const [roomCode] = useState(createRoomCode);
  const [roomId, setRoomId] = useState(roomCode);
  
  const [roomStatus, setRoomStatus] = useState('Ready to connect.');
  const [opponentCode, setOpponentCode] = useState('');
  const [inBattle, setInBattle] = useState(false);
  const [role, setRole] = useState(null);
  const [winner, setWinner] = useState(null);
  const [timeLeft, setTimeLeft] = useState(900);
  const [problemSlug, setProblemSlug] = useState('');
  const [view, setView] = useState('arena');
  const [problems, setProblems] = useState([]);

  const shortWallet = useMemo(() => {
    if (!walletAddress) return 'Disconnected';
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
    socket.on('room_status', (data) => setRoomStatus(`Players in room: ${data.count}/2`));
    socket.on('battle_start', (data) => {
      setRoomStatus(data.message);
      setProblemSlug(data.problemSlug);
      setInBattle(true);
      setView('battle');
    });
    socket.on('timer_update', (data) => setTimeLeft(data.timeLeft));
    socket.on('match_over', (data) => {
      setWinner(data.winnerId);
      setInBattle(false);
    });
    socket.on('receive_code', (incomingCode) => setOpponentCode(incomingCode));

    return () => {
      socket.off('room_status');
      socket.off('battle_start');
      socket.off('timer_update');
      socket.off('match_over');
      socket.off('receive_code');
    };
  }, []);

  useEffect(() => {
    const fetchProblems = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/problems`);
        if (res.data.success) setProblems(res.data.problems);
      } catch (err) { console.error("Could not fetch problem list", err); }
    };
    fetchProblems();
  }, []);

  // UPDATED: Dynamic Room Joining logic
  const joinArena = () => {
    if (!walletAddress) { alert('Connect wallet first!'); return; }
    if (!roomId.trim()) { alert('Please enter a Room Code!'); return; }
    
    setRole('player');
    setView('battle');
    socket.emit('join_room', roomId);
  };

  const joinAsSpectator = () => {
    if (!walletAddress) { alert('Connect wallet first!'); return; }
    if (!roomId.trim()) { alert('Please enter a Room Code!'); return; }
    
    setRole('spectator');
    setView('spectator');
    socket.emit('join_room', roomId);
  };

  const resetArena = () => {
    setWinner(null);
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
            
            {/* UNCONNECTED VIEW INPUTS */}
            <div className="hero-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn--primary" onClick={connectWallet}>CONNECT WALLET</button>
              
              <input 
                type="text" 
                value={roomId} 
                onChange={(e) => setRoomId(e.target.value.toUpperCase())} 
                placeholder="Enter Room Code"
                style={{ padding: '10px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: '#111', color: 'white', outline: 'none', maxWidth: '160px', fontFamily: 'monospace' }}
              />
              <button className="btn btn--outline" onClick={joinArena}>ENTER ARENA</button>
              <button className="btn btn--violet" onClick={joinAsSpectator}>WATCH LIVE</button>
            </div>
          </div>
        </section>
      );
    }

    if (view === 'leaderboard' && !inBattle) {
      return (
        <main className="arena-page">
          <section className="panel-shell panel-shell--wide">
            <Leaderboard />
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
                <h2 className="section-title">LIVE VIEWERSHIP: ROOM {roomId}</h2>
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
            </div>
            <div className="battle-statusbar__right">
              <span className="status-pill status-pill--danger">{roomId}</span>
              <span className="timer-chip">{formatTime(timeLeft)}</span>
            </div>
          </div>

          <div className="battle-grid">
            <section className="battle-column battle-column--problem">
              <div className="panel-shell panel-shell--compact">
                <ProblemPrompt slug={problemSlug} />
              </div>
            </section>
            <section className="battle-column battle-column--editor">
              <ArenaEditor socket={socket} roomId={roomId} walletAddress={walletAddress} opponentCode={opponentCode} problemSlug={problemSlug} />
            </section>
            <aside className="battle-column battle-column--side">
              <ProctoringCam inBattle={inBattle} />
              <Leaderboard />
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
                Challenge a friend, enter as a competitor, or spectate the duel.
              </p>
              
              {/* CONNECTED VIEW INPUTS */}
              <div className="hero-actions hero-actions--left" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginTop: '20px' }}>
                <input 
                  type="text" 
                  value={roomId} 
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())} 
                  placeholder="Enter Room Code"
                  style={{ padding: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: '#111', color: 'white', outline: 'none', minWidth: '200px', fontSize: '1.1rem', fontFamily: 'monospace' }}
                />
                <button className="btn btn--primary" onClick={joinArena}>ENTER BATTLE</button>
                <button className="btn btn--outline" onClick={joinAsSpectator}>SPECTATE</button>
              </div>
            </div>
          </div>

          <div className="panel-shell panel-shell--stack">
            <div>
              <span className="badge badge--violet">PROFILE</span>
              <h2 className="section-title">Operator Profile</h2>
            </div>
            <div className="profile-card">
              <div className="profile-card__row"><span>Wallet</span><strong>{shortWallet}</strong></div>
              <div className="profile-card__row"><span>Host Code</span><strong>{roomCode}</strong></div>
            </div>
          </div>
        </section>
      </main>
    );
  };

  const navItems = [
    { id: 'arena', label: 'Arena' },
    { id: 'leaderboard', label: 'Leaderboard' },
  ];

  return (
    <div className="arena-shell">
      <header className="topbar">
        <div className="topbar__brand" onClick={() => setView('arena')} role="button" tabIndex={0}>
          <span>ALGO_ARENA</span>
        </div>
        <nav className="topbar__nav">
          {navItems.map((item) => (
            <button
              key={item.id}
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
            <button className="btn btn--outline btn--small" onClick={() => setView('arena')}>ROOM {roomId}</button>
          )}
        </div>
      </header>

      <div className="arena-shell__body">
        {shellView()}
      </div>

      {winner && (
        <BattleResult winnerId={winner} walletAddress={walletAddress} role={role} resetArena={resetArena} />
      )}
    </div>
  );
}

export default App;