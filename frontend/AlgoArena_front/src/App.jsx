import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { io } from 'socket.io-client';
import './App.css';
import ArenaEditor from './components/ArenaEditor';
import ProctoringCam from './components/ProctoringCam';
import ProblemPrompt from './components/ProblemPrompt';
import Leaderboard from './components/Leaderboard';
const [opponentCode, setOpponentCode] = useState("");



// Connect to your Node.js backend
const socket = io("http://localhost:5001");

function App() {
  const [walletAddress, setWalletAddress] = useState("");
  const [roomId, setRoomId] = useState("");
  const [inBattle, setInBattle] = useState(false);
  const [roomStatus, setRoomStatus] = useState("");
  const [timeLeft, setTimeLeft] = useState(900);

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
      alert(`Battle Over! Winner: ${data.winnerId}`);
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
      alert("Connect wallet first!");
      return;
    }
    // Hardcoding a room for testing, but this should be dynamic later
    const testRoom = "arena-room-1"; 
    setRoomId(testRoom);
    socket.emit('join_room', testRoom);
  };

  // Format the seconds into MM:SS
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
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
          
          {!inBattle ? (
            <div>
              <button className="join-btn" onClick={joinArena}>Enter Matchmaking</button>
              <p className="status-text">{roomStatus}</p>
              
              {/* Show the Web3 Leaderboard in the Lobby */}
              <Leaderboard />
            </div>
          ) : (
            <div className="battle-zone">
              <h2>🔥 BATTLE COMMENCED 🔥</h2>
              <h3 className="timer">Time Remaining: {formatTime(timeLeft)}</h3>
              
              {/* Show the Problem Prompt above the Editor */}
              <ProblemPrompt />
              
              <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <ArenaEditor 
                      socket={socket} 
                      roomId={roomId} 
                      walletAddress={walletAddress} 
                      opponentCode={opponentCode} 
                  />
                </div>
                <ProctoringCam inBattle={inBattle} />
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;