import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import Editor from '@monaco-editor/react';
import Webcam from 'react-webcam';
import axios from 'axios';
import './App.css';

const socket = io.connect("http://localhost:5000");

function App() {
  const [code, setCode] = useState("// Write your C++ solution here...\n#include <iostream>\n\nint main() {\n    \n    return 0;\n}");
  const [roomId, setRoomId] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState("Awaiting execution...");
  const [activeTab, setActiveTab] = useState("problem");
  const webcamRef = useRef(null);

  // NEW: Problem Bank State
  const [problems, setProblems] = useState([]);
  const [selectedProblemId, setSelectedProblemId] = useState(1);

  // Fetch Problems and Leaderboard on load
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const probRes = await axios.get("http://localhost:5000/problems");
        if (probRes.data.success) setProblems(probRes.data.problems);

        const leadRes = await axios.get("http://localhost:5000/leaderboard");
        if (leadRes.data.success) setLeaderboard(leadRes.data.leaderboard);
      } catch (err) {
        console.error("Failed to load initial data", err);
      }
    };
    fetchInitialData();
  }, []);

  const currentProblem = problems.find(p => p.id === selectedProblemId) || problems[0];

  /* --- BLOCKCHAIN LOGIC --- */
  const recordWinOnBlockchain = async (winnerName, loserName) => {
    try {
      const response = await axios.post("http://localhost:5000/record-battle", { winner: winnerName, loser: loserName });
      if (response.data.success) {
        setTerminalOutput(prev => prev + `\n\n✅ Win recorded on Web3!\nTx Hash: ${response.data.transactionHash}`);
        
        // Refresh leaderboard
        const leadRes = await axios.get("http://localhost:5000/leaderboard");
        if (leadRes.data.success) setLeaderboard(leadRes.data.leaderboard);
      }
    } catch (error) {
      setTerminalOutput(prev => prev + "\n\n❌ Error recording win to blockchain.");
    }
  };

  /* --- AI PROCTORING LOGIC --- */
  const captureAndVerify = useCallback(async () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        try {
          const response = await axios.post('http://localhost:5000/proctor-check', { image: imageSrc });
          if (!response.data.verified) console.warn("⚠️ ALARM: Face mismatch!");
        } catch (error) { console.error("Proctoring error:", error); }
      }
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => captureAndVerify(), 15000);
    return () => clearInterval(interval);
  }, [captureAndVerify]);

  /* --- EDITOR LOGIC --- */
  const handleEditorChange = (value) => {
    setCode(value);
    socket.emit("code_change", { roomId, code: value });
  };

  /* --- SUBMIT LOGIC --- */
  const handleSubmit = async () => {
    setIsEvaluating(true);
    setTerminalOutput("Compiling in Docker Sandbox...");

    try {
      // Pass the selectedProblemId to the backend!
      const res = await axios.post("http://localhost:5000/run-code", { 
        code, 
        problemId: selectedProblemId 
      });

      if (res.data.success) {
        if (res.data.passed) {
          setTerminalOutput(`✅ Status: Accepted\nOutput:\n${res.data.output}\n\nMinting victory on Web3...`);
          recordWinOnBlockchain("Player 1", "Challenger");
        } else {
          setTerminalOutput(`❌ Status: Wrong Answer\nExpected:\n${res.data.expected}\n\nGot:\n${res.data.output}`);
        }
      } else {
        setTerminalOutput(`⚠️ Compilation Error:\n${res.data.output}`);
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
        <div className="nav-controls">
          <input className="room-input" placeholder="Enter Match ID" onChange={(e) => setRoomId(e.target.value)} />
          <button className="btn btn-primary" onClick={() => socket.emit('join_room', roomId)}>Join Match</button>
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
                
                {/* --- THE NEW QUESTION SELECTOR --- */}
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
                  <span style={{ 
                    color: currentProblem.difficulty === "Easy" ? "var(--success)" : 
                           currentProblem.difficulty === "Medium" ? "var(--warning)" : "var(--danger)", 
                    fontWeight: "600", fontSize: "0.9rem" 
                  }}>
                    {currentProblem.difficulty}
                  </span>
                  <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>C++ Required</span>
                </div>
                
                <p style={{ lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
                  {currentProblem.description}
                </p>
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
            <span className="lang-badge">C++ 17 (GCC)</span>
            <button className="btn btn-success" onClick={handleSubmit} disabled={isEvaluating}>
              {isEvaluating ? "Evaluating..." : "▶ Run & Submit"}
            </button>
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <Editor height="100%" defaultLanguage="cpp" value={code} onChange={handleEditorChange} theme="vs-dark" options={{ minimap: { enabled: false }, fontSize: 14, padding: { top: 16 } }} />
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