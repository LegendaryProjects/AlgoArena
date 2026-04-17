import React from 'react';

export default function BattleResult({ winnerId, walletAddress, role, resetArena }) {
  const isWinner = winnerId.toLowerCase() === walletAddress.toLowerCase();
  const isSpectator = role === 'spectator';

  // Dynamic styling based on outcome
  const getBannerColor = () => {
    if (isSpectator) return '#17a2b8'; // Spectator Blue
    return isWinner ? '#28a745' : '#dc3545'; // Victory Green or Defeat Red
  };

  const getTitle = () => {
    if (isSpectator) return "🏁 MATCH CONCLUDED 🏁";
    return isWinner ? "🏆 VICTORY ACHIEVED 🏆" : "💀 KNOCKOUT 💀";
  };

  const getMessage = () => {
    if (isSpectator) return `Player ${winnerId.slice(0, 6)}... claimed the win!`;
    return isWinner 
      ? "Your algorithm was flawless. The victory has been minted to the Sepolia blockchain!" 
      : "Your opponent's logic was faster. Dust yourself off and try again.";
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#111',
        border: `3px solid ${getBannerColor()}`,
        borderRadius: '12px',
        padding: '40px',
        maxWidth: '500px',
        textAlign: 'center',
        color: '#fff',
        boxShadow: `0 0 30px ${getBannerColor()}88`
      }}>
        <h1 style={{ color: getBannerColor(), marginBottom: '10px' }}>{getTitle()}</h1>
        <hr style={{ borderColor: '#333', marginBottom: '20px' }} />
        
        <p style={{ fontSize: '1.2rem', lineHeight: '1.6', marginBottom: '30px' }}>
          {getMessage()}
        </p>

        <div style={{ backgroundColor: '#222', padding: '15px', borderRadius: '8px', marginBottom: '30px', fontFamily: 'monospace' }}>
          <span style={{ color: '#888' }}>Official Winner Address:</span><br/>
          <span style={{ color: '#61dafb', fontSize: '1.1rem' }}>{winnerId}</span>
        </div>

        <button 
          onClick={resetArena}
          style={{
            backgroundColor: getBannerColor(),
            color: '#fff',
            border: 'none',
            padding: '12px 24px',
            fontSize: '1.1rem',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold',
            transition: 'transform 0.2s'
          }}
          onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
          onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
        >
          Return to Lobby
        </button>
      </div>
    </div>
  );
}