import { useState } from 'react';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import { BACKEND_URL } from '../config';

export default function ArenaEditor({ socket, roomId, walletAddress, opponentCode}) {
  // Defaulting to C++ as the primary arena language
  const [code, setCode] = useState("#include <iostream>\nusing namespace std;\n\nint main() {\n    // Your code here\n    return 0;\n}");
  const [language, setLanguage] = useState("cpp");
  const [output, setOutput] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);

  // For the MVP, we are targeting Problem ID 1 from your server.js problem bank
  const problemId = 1;

  const handleEditorChange = (value) => {
    setCode(value);
    // Real-time sync: Sends your code and your Web3 address to the server
    socket.emit("code_change", { 
        roomId, 
        code: value, 
        playerId: walletAddress 
    });
  };

  const executeCode = async () => {
    setIsExecuting(true);
    setOutput("Compiling and running in secure Docker sandbox...");
    
    try {
      // 1. Run the code in Docker
      const response = await axios.post(`${BACKEND_URL}/run-code`, {
        code,
        problemId,
        language
      });

      if (response.data.success) {
        let resultText = `Output:\n${response.data.output}\n\n`;
        
        if (response.data.passed) {
          resultText += "✅ ALL TEST CASES PASSED!\n\n";
          setOutput(resultText + "🔍 Running TF-IDF Plagiarism Check...");

          // 2. THE ANTI-CHEAT GATE: Check for Plagiarism
          // Only check if the opponent has actually written something
          if (opponentCode && opponentCode.length > 20) {
                const plagResponse = await axios.post(`${BACKEND_URL}/check-plagiarism`, {
                  code1: code,
                  code2: opponentCode
              });

              if (plagResponse.data.is_suspect) {
                  const similarity = (plagResponse.data.similarity_score * 100).toFixed(1);
                  setOutput(resultText + `🚨 VICTORY DENIED! 🚨\nYour code is ${similarity}% similar to your opponent's.\nWrite your own logic!`);
                  setIsExecuting(false);
                  return; // Halt the victory sequence!
              }
          }

          // 3. KNOCKOUT BLOW: Code passed and is original!
          setOutput(resultText + "🏆 CLEARED ANTI-CHEAT! Claiming Victory on the Blockchain...");
          socket.emit("claim_victory", { roomId, winnerId: walletAddress });
          
          await axios.post(`${BACKEND_URL}/record-battle`, { 
            winner: walletAddress, 
            loser: "Opponent_Defeated" 
          });
          
        } else {
          resultText += `❌ FAILED. \nExpected: ${response.data.expected}`;
          setOutput(resultText);
        }
      } else {
        setOutput(`Compilation Error:\n${response.data.output}`);
      }
    } catch (error) {
      setOutput("Server Error: Check Docker and ML Microservices.");
    }
    
    setIsExecuting(false);
  };

  return (
    <div className="editor-container" style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
      
      {/* LEFT PANEL: The Code Editor */}
      <div className="monaco-wrapper" style={{ flex: 2, border: '1px solid #444', borderRadius: '8px', overflow: 'hidden' }}>
        <div className="editor-header" style={{ padding: '10px', backgroundColor: '#1e1e1e', color: 'white', display: 'flex', justifyContent: 'space-between' }}>
          <select 
            value={language} 
            onChange={(e) => setLanguage(e.target.value)}
            style={{ padding: '5px', borderRadius: '4px', backgroundColor: '#333', color: 'white', border: 'none' }}
          >
            <option value="cpp">C++ (g++)</option>
            <option value="python">Python 3</option>
            <option value="javascript">Node.js</option>
          </select>
          
          <button 
            onClick={executeCode} 
            disabled={isExecuting}
            style={{ backgroundColor: '#28a745', color: 'white', border: 'none', padding: '5px 15px', borderRadius: '4px', cursor: 'pointer' }}
          >
            {isExecuting ? "Running..." : "Run Code ⚡"}
          </button>
        </div>
        
        <Editor
          height="50vh"
          theme="vs-dark"
          language={language}
          value={code}
          onChange={handleEditorChange}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            scrollBeyondLastLine: false,
          }}
        />
      </div>

      {/* RIGHT PANEL: The Terminal Output */}
      <div className="terminal-wrapper" style={{ flex: 1, backgroundColor: '#000', color: '#0f0', padding: '15px', borderRadius: '8px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', border: '1px solid #333' }}>
        <h3>Terminal Output</h3>
        <hr style={{ borderColor: '#333' }}/>
        <p>{output}</p>
      </div>

    </div>
  );
}