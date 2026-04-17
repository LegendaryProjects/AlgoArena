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
    <div className="spectator-container">
      <div className="spectator-header">
        <div>
          <span className="badge badge--violet">Live View</span>
          <h2 className="spectator-title">LIVE SPECTATOR MODE</h2>
        </div>
      </div>

      {playerIds.length === 0 ? (
        <p className="problem-content">Waiting for players to start typing...</p>
      ) : (
        <div className="spectator-grid">
          {playerIds.map((id, index) => (
            <div key={id} className="spectator-player">
              <div className="spectator-player__header">
                <span className="badge badge--green">Player {index + 1}</span>
                <span className="code-status__chip">{id.slice(0, 6)}...{id.slice(-4)}</span>
              </div>
              <div className="spectator-player__body">
                <Editor
                  height="100%"
                  theme="vs-dark"
                  language="cpp"
                  value={playersData[id]}
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}