import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';

export default function SpectatorView({ socket }) {
  // We store the players' code in a dictionary: { "0x123...": "int main()...", "0xABC...": "print()..." }
  const [playersData, setPlayersData] = useState({});

  useEffect(() => {
    socket.on('spectator_update', ({ playerId, code }) => {
      setPlayersData((prev) => ({
        ...prev,
        [playerId]: code
      }));
    });

    return () => socket.off('spectator_update');
  }, [socket]);

  // Extract the player IDs (up to 2 for a 1v1 match)
  const playerIds = Object.keys(playersData);

  return (
    <div className="spectator-container" style={{ padding: '20px', backgroundColor: '#111', color: '#fff', borderRadius: '8px' }}>
      <h2 style={{ textAlign: 'center', color: '#f39c12' }}>👁️ LIVE SPECTATOR MODE</h2>
      <hr style={{ borderColor: '#333', marginBottom: '20px' }} />

      {playerIds.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#888' }}>Waiting for players to start typing...</p>
      ) : (
        <div style={{ display: 'flex', gap: '20px' }}>
          {playerIds.map((id, index) => (
            <div key={id} style={{ flex: 1, border: '1px solid #444', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#222', padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>
                Player {index + 1}: <span style={{ color: '#61dafb', fontFamily: 'monospace' }}>{id.slice(0, 6)}...{id.slice(-4)}</span>
              </div>
              <Editor
                height="60vh"
                theme="vs-dark"
                language="cpp" // Defaulting to C++ for syntax highlighting
                value={playersData[id]}
                options={{
                  readOnly: true, // Crucial: Spectators cannot type!
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}