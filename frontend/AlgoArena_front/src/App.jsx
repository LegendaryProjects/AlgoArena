import { useState, useEffect } from 'react';
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

// Connect to your Node.js backend
const socket = io(BACKEND_URL);

function App() {
  const [opponentCode, setOpponentCode] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [roomId, setRoomId] = useState("");
  const [inBattle, setInBattle] = useState(false);
  const [roomStatus, setRoomStatus] = useState("");
  const [timeLeft, setTimeLeft] = useState(900);
  const [role, setRole] = useState(null); 
  const [winner, setWinner] = useState(null);

  // --- 1. WEB3 METAMASK AUTHENTICATION ---
  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        setWalletAddress(address);
        console.log("Connected Wallet: ", address);
      } catch (error) {
        console.error("Wallet connection failed:", error);
      }
    } else {
      alert("Please install MetaMask to play AlgoArena!");
    }
  };

  // --- 2. SOCKET.IO MULTIPLAYER SYNC ---
  useEffect(() => {
    socket.on('room_status', (data) => {
      setRoomStatus(`Players in room: ${data.count}/2`);
    });

    socket.on('battle_start', (data) => {
      setRoomStatus(data.message);
      setInBattle(true);
    });

    socket.on('timer_update', (data) => {
      setTimeLeft(data.timeLeft);
    });

    socket.on('match_over', (data) => {
      // Instead of an alert, we set the winner state to trigger the overlay
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

  // Format the seconds into MM:SS
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const joinAsSpectator = () => {
    if (!walletAddress) {
      alert("Connect wallet first!");
      return;
    }
    const testRoom = "arena-room-1"; 
    setRoomId(testRoom);
    setRole('spectator');
    socket.emit('join_room', testRoom);
  };

  const joinArena = () => {
    if (!walletAddress) {
      alert("Connect wallet first!");
      return;
    }
    const testRoom = "arena-room-1"; 
    setRoomId(testRoom);
    setRole('player');
    socket.emit('join_room', testRoom);
  };

  const resetArena = () => {
    setWinner(null);
    setRoomId("");
    setRole(null);
    setRoomStatus("");
    setOpponentCode("");
    setTimeLeft(900);
  };

  return (
    <div className="arena-container">
      <h1>AlgoArena ⚔️</h1>
      
      {!walletAddress ? (
        <button className="web3-btn" onClick={connectWallet}>
          🦊 Connect MetaMask
        </button>
      ) : (
        <div className="dashboard">
          <p>Logged in as: <strong>{walletAddress.slice(0,6)}...{walletAddress.slice(-4)}</strong></p>
          
          {/* LOBBY VIEW */}
          {!inBattle && role !== 'spectator' ? (
            <div>
              <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginBottom: '20px' }}>
                <button className="join-btn" onClick={joinArena} style={{ backgroundColor: '#dc3545' }}>
                  ⚔️ Enter as Combatant
                </button>
                <button className="join-btn" onClick={joinAsSpectator} style={{ backgroundColor: '#17a2b8' }}>
                  👁️ Watch as Spectator
                </button>
              </div>
              <p className="status-text">{roomStatus}</p>
              <Leaderboard />
            </div>
          ) : role === 'spectator' ? (
            <div>
              <p className="status-text">{roomStatus}</p>
              <SpectatorView socket={socket} />
            </div>
          ) : (
            <div className="battle-zone">
              <h2>🔥 BATTLE COMMENCED 🔥</h2>
              <h3 className="timer">Time Remaining: {formatTime(timeLeft)}</h3>
              
              <ProblemPrompt />
              
              <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <ArenaEditor socket={socket} roomId={roomId} walletAddress={walletAddress} opponentCode={opponentCode} />
                </div>
                <ProctoringCam inBattle={inBattle} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* THE VICTORY OVERLAY */}
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