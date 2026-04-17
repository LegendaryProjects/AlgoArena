import { useState } from 'react';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import { BACKEND_URL } from '../config';

export default function ArenaEditor({ socket, roomId, walletAddress, opponentCode }) {
  const [code, setCode] = useState("#include <iostream>\nusing namespace std;\n\nint main() {\n    // Your code here\n    return 0;\n}");
  const [language, setLanguage] = useState('cpp');
  const [output, setOutput] = useState('Ready to compile.');
  const [isExecuting, setIsExecuting] = useState(false);

  const problemId = 1;

  const handleEditorChange = (value = '') => {
    setCode(value);
    socket.emit('code_change', {
      roomId,
      code: value,
      playerId: walletAddress,
    });
  };

  const executeCode = async () => {
    setIsExecuting(true);
    setOutput('Compiling and running in secure Docker sandbox...');

    try {
      const response = await axios.post(`${BACKEND_URL}/run-code`, {
        code,
        problemId,
        language,
      });

      if (!response.data.success) {
        setOutput(`Compilation Error:\n${response.data.output}`);
        return;
      }

      let resultText = `Output:\n${response.data.output}\n\n`;

      if (!response.data.passed) {
        setOutput(`${resultText}❌ FAILED.\nExpected: ${response.data.expected}`);
        return;
      }

      resultText += '✅ ALL TEST CASES PASSED!\n\n';
      setOutput(`${resultText}🔍 Running TF-IDF Plagiarism Check...`);

      if (opponentCode && opponentCode.length > 20) {
        const plagResponse = await axios.post(`${BACKEND_URL}/check-plagiarism`, {
          code1: code,
          code2: opponentCode,
        });

        if (plagResponse.data.is_suspect) {
          const similarity = (plagResponse.data.similarity_score * 100).toFixed(1);
          setOutput(`${resultText}🚨 VICTORY DENIED! 🚨\nYour code is ${similarity}% similar to your opponent's.\nWrite your own logic!`);
          return;
        }
      }

      setOutput(`${resultText}🏆 CLEARED ANTI-CHEAT! Claiming Victory on the Blockchain...`);
      socket.emit('claim_victory', { roomId, winnerId: walletAddress });

      await axios.post(`${BACKEND_URL}/record-battle`, {
        winner: walletAddress,
        loser: 'Opponent_Defeated',
      });
    } catch (error) {
      setOutput('Server Error: Check Docker and ML Microservices.');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="editor-shell">
      <div className="editor-container">
        <div className="monaco-wrapper">
          <div className="editor-header">
            <div className="code-status">
              <span className="badge badge--green">solution.py</span>
              <span className="code-status__chip">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
            </div>
            <div className="editor-controls">
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className="editor-select"
              >
                <option value="cpp">C++ (g++)</option>
                <option value="python">Python 3</option>
                <option value="javascript">Node.js</option>
              </select>
              <button onClick={executeCode} disabled={isExecuting} className="editor-action">
                {isExecuting ? 'RUNNING...' : 'RUN CODE'}
              </button>
            </div>
          </div>

          <Editor
            height="min(68vh, 760px)"
            theme="vs-dark"
            language={language}
            value={code}
            onChange={handleEditorChange}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              fontFamily: 'JetBrains Mono, monospace',
            }}
          />
        </div>

        <div className="terminal-wrapper">
          <div className="terminal-header">
            <span className="badge badge--violet">Terminal Output</span>
            <span className="code-status__chip">LIVE</span>
          </div>
          <div className="terminal-output">{output}</div>
        </div>
      </div>
    </div>
  );
}