import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import Editor from '@monaco-editor/react';
import Webcam from 'react-webcam';
import axios from 'axios';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5001";
const socket = io.connect(API_BASE_URL);

const languageSnippets = {
  cpp: "// Write your C++ solution here...\n#include <iostream>\n\nint main() {\n    \n    return 0;\n}",
  python: "# Write your Python solution here...\n\n",
  javascript: "// Write your JavaScript solution here...\n\n"
};

function App() {
  const [roomCount, setRoomCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(null);
  const [battleStatus, setBattleStatus] = useState("Waiting for opponent...");
  
  const [language, setLanguage] = useState("cpp");
  const [code, setCode] = useState(languageSnippets["cpp"]);
  
  const [roomId, setRoomId] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState("Awaiting execution...");
  const [activeTab, setActiveTab] = useState("problem");
  const webcamRef = useRef(null);

  const [problems, setProblems] = useState([]);
  const [selectedProblemId, setSelectedProblemId] = useState(1);

  // NEW: Web3 Authentication State
  const [userAddress, setUserAddress] = useState(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const probRes = await axios.get(`${API_BASE_URL}/problems`);
        if (probRes.data.success) setProblems(probRes.data.problems);

        const leadRes = await axios.get(`${API_BASE_URL}/leaderboard`);
        if (leadRes.data.success) setLeaderboard(leadRes.data.leaderboard);
      } catch (err) {
        console.error("Failed to load initial data", err);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    socket.on("room_status", (data) => {
      setRoomCount(data.count);
      if (data.count === 1) setBattleStatus("Waiting for opponent...");
    });
    socket.on("battle_start", () => setBattleStatus("⚔️ BATTLE IN PROGRESS"));
    socket.on("timer_update", (data) => setTimeLeft(data.timeLeft));
    socket.on("battle_over", () => { setBattleStatus("TIME IS UP!"); setTimeLeft(0); });
    socket.on("match_over", (data) => {
      if (data.winnerId === socket.id) {
        setBattleStatus("🏆 YOU WON!");
        alert("Match Over: You have defeated your opponent!");
      } else {
        setBattleStatus("💀 DEFEATED");
        alert("Match Over: Your opponent finished first. You lose.");
      }
      setTimeLeft(null); 
    });

    return () => {
      socket.off("room_status"); socket.off("battle_start"); socket.off("timer_update");
      socket.off("battle_over"); socket.off("match_over");
    };
  }, []);

  /* --- NEW: WEB3 LOGIN FUNCTION --- */
  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("⚠️ MetaMask is not installed! Please install it to log in.");
      return;
    }

    try {
      // 1. Request their wallet address
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const address = accounts[0];

      // 2. Create a unique message for them to sign
      const message = `Welcome to AlgoArena!\n\nPlease sign this message to verify your identity.\n\nTimestamp: ${Date.now()}`;

      // 3. Ask MetaMask to sign the message
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, address]
      });

      // 4. Send it to the backend for cryptographic verification
      const res = await axios.post(`${API_BASE_URL}/verify-signature`, { address, signature, message });

      if (res.data.success) {
        setUserAddress(res.data.user);
      }
    } catch (error) {
      console.error("Login failed:", error);
      alert("Login cancelled or failed.");
    }
  };

  const formatTime = (seconds) => {
    if (seconds === null) return "--:--";
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const currentProblem = problems.find(p => p.id === selectedProblemId) || problems[0];

  const recordWinOnBlockchain = async (winnerName, loserName) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/record-battle`, { winner: winnerName, loser: loserName });
      if (response.data.success) {
        setTerminalOutput(prev => prev + `\n\n✅ Win recorded on Web3!\nTx Hash: ${response.data.transactionHash}`);
        const leadRes = await axios.get(`${API_BASE_URL}/leaderboard`);
        if (leadRes.data.success) setLeaderboard(leadRes.data.leaderboard);
      }
    } catch (error) {
      setTerminalOutput(prev => prev + "\n\n❌ Error recording win to blockchain.");
    }
  };

  const captureAndVerify = useCallback(async () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        try {
          const response = await axios.post(`${API_BASE_URL}/proctor-check`, { image: imageSrc });
          if (!response.data.verified) console.warn("⚠️ ALARM: Face mismatch!");
        } catch (error) { console.error("Proctoring error:", error); }
      }
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => captureAndVerify(), 15000);
    return () => clearInterval(interval);
  }, [captureAndVerify]);

  const handleEditorChange = (value) => {
    setCode(value);
    socket.emit("code_change", { roomId, code: value });
  };

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    setCode(languageSnippets[newLang]);
  };

  const handleSubmit = async () => {
    setIsEvaluating(true);
    setTerminalOutput(`Executing ${language.toUpperCase()} in Docker Sandbox...`);

    try {
      const res = await axios.post(`${API_BASE_URL}/run-code`, { code, problemId: selectedProblemId, language });

      if (res.data.success) {
        if (res.data.passed) {
          setTerminalOutput(`✅ Status: Accepted\nOutput:\n${res.data.output}\n\nMinting victory on Web3...`);
          if (roomId) socket.emit('claim_victory', { roomId, winnerId: socket.id });
          
          // NEW: Use their Wallet Address as their Username on the blockchain!
          const winnerIdentity = userAddress ? `${userAddress.substring(0, 6)}...${userAddress.slice(-4)}` : `Anon-${socket.id.substring(0,4)}`;
          recordWinOnBlockchain(winnerIdentity, "Challenger");
          
        } else {
          setTerminalOutput(`❌ Status: Wrong Answer\nExpected:\n${res.data.expected}\n\nGot:\n${res.data.output}`);
        }
      } else {
        setTerminalOutput(`⚠️ Execution Error:\n${res.data.output}`);
      }
    } catch (err) {
      setTerminalOutput("Server Error trying to run code.");
    }
    setIsEvaluating(false);
  };

  return (
    <div className="arena-container">
      <nav className="navbar">
        <div className="brand">⚔️ AlgoArena <span>Web3</span></div>
        
        {/* TIMER */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: timeLeft && timeLeft < 60 ? "var(--danger)" : "var(--success)", fontFamily: "monospace" }}>
            {formatTime(timeLeft)}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
            {battleStatus} ({roomCount}/2 Players)
          </div>
        </div>

        {/* CONTROLS & WALLET LOGIN */}
        <div className="nav-controls">
          <input className="room-input" placeholder="Enter Match ID" onChange={(e) => setRoomId(e.target.value)} />
          <button className="btn btn-primary" onClick={() => socket.emit('join_room', roomId)} style={{ marginRight: '15px' }}>Join Match</button>
          
          {userAddress ? (
            <div style={{ backgroundColor: "#1e1e1e", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--accent-primary)", color: "var(--accent-primary)", fontWeight: "bold", fontFamily: "monospace" }}>
              🟢 {userAddress.substring(0, 6)}...{userAddress.slice(-4)}
            </div>
          ) : (
            <button className="btn btn-success" onClick={connectWallet} style={{ backgroundColor: "#f6851b", color: "white" }}>
              🦊 Connect Wallet
            </button>
          )}
        </div>
      </nav>

      <div className="workspace">
        <div className="panel panel-left">
          <div className="tabs-header">
            <div className={`tab ${activeTab === 'problem' ? 'active' : ''}`} onClick={() => setActiveTab('problem')}>📄 Description</div>
            <div className={`tab ${activeTab === 'leaderboard' ? 'active' : ''}`} onClick={() => setActiveTab('leaderboard')}>📜 Hall of Fame</div>
          </div>

          <div className="tab-content">
            {activeTab === 'problem' && currentProblem && (
              <div className="problem-description">
                <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Select Challenge:</span>
                  <select 
                    value={selectedProblemId} 
                    onChange={(e) => setSelectedProblemId(Number(e.target.value))}
                    style={{ padding: "8px", backgroundColor: "var(--bg-main)", color: "white", border: "1px solid var(--border-color)", borderRadius: "4px", outline: "none", cursor: "pointer", fontFamily: "inherit" }}
                  >
                    {problems.map(p => (
                      <option key={p.id} value={p.id}>{p.id}. {p.title}</option>
                    ))}
                  </select>
                </div>
                <h2 style={{marginTop: 0}}>{currentProblem.id}. {currentProblem.title}</h2>
                <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
                  <span style={{ color: currentProblem.difficulty === "Easy" ? "var(--success)" : currentProblem.difficulty === "Medium" ? "var(--warning)" : "var(--danger)", fontWeight: "600", fontSize: "0.9rem" }}>
                    {currentProblem.difficulty}
                  </span>
                  <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Any Language</span>
                </div>
                <p style={{ lineHeight: "1.6", whiteSpace: "pre-wrap" }}>{currentProblem.description}</p>
              </div>
            )}

            {activeTab === 'leaderboard' && (
              <div className="leaderboard-view">
                {leaderboard.length === 0 ? (
                  <p style={{ color: "var(--text-secondary)", textAlign: "center", marginTop: "40px" }}>No battles recorded on this chain yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {leaderboard.map((match, index) => (
                      <div key={index} style={{ backgroundColor: "var(--bg-main)", padding: "15px", borderRadius: "8px", border: "1px solid var(--border-color)", borderLeft: "4px solid var(--warning)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <strong style={{ color: "white" }}>🏆 {match.winner}</strong>
                          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{match.date}</span>
                        </div>
                        <div style={{ color: "var(--danger)", fontSize: "0.85rem", marginTop: "5px" }}>Defeated: {match.loser}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="panel panel-right">
          <div className="editor-header">
            <select 
              value={language} 
              onChange={handleLanguageChange}
              style={{ backgroundColor: "var(--bg-hover)", color: "var(--text-primary)", border: "1px solid var(--border-color)", padding: "4px 10px", borderRadius: "4px", fontSize: "0.85rem", outline: "none", cursor: "pointer", fontFamily: "inherit" }}
            >
              <option value="cpp">C++ 17 (GCC)</option>
              <option value="python">Python 3.12</option>
              <option value="javascript">Node.js (JS)</option>
            </select>

            <button className="btn btn-success" onClick={handleSubmit} disabled={isEvaluating}>
              {isEvaluating ? "Evaluating..." : "▶ Run & Submit"}
            </button>
          </div>
          
          <div style={{ flex: 1, overflow: "hidden" }}>
            <Editor height="100%" defaultLanguage="cpp" language={language} value={code} onChange={handleEditorChange} theme="vs-dark" options={{ minimap: { enabled: false }, fontSize: 14, padding: { top: 16 } }} />
          </div>
          
          <div className="terminal">
            <div className="terminal-header">Execution Console</div>
            <div className="terminal-output" style={{ color: terminalOutput.includes("❌") || terminalOutput.includes("⚠️") ? "var(--danger)" : terminalOutput.includes("✅") ? "var(--success)" : "var(--text-primary)" }}>
              {terminalOutput}
            </div>
          </div>
        </div>
      </div>

      <div className="proctor-widget">
        <div className="proctor-header">🔴 LIVE PROCTORING</div>
        <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" width="100%" style={{ display: "block" }} />
      </div>
    </div>
  );
}

export default App;