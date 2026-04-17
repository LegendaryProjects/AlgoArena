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
    <div className="battle-result-overlay">
      <div className="battle-result-card" style={{ borderColor: getBannerColor(), boxShadow: `0 0 30px ${getBannerColor()}66` }}>
        <span className="badge" style={{ color: getBannerColor(), background: `${getBannerColor()}18`, borderColor: `${getBannerColor()}44` }}>
          Match Complete
        </span>
        <h1 className="battle-result-title" style={{ color: getBannerColor() }}>{getTitle()}</h1>
        <p className="battle-result-message">{getMessage()}</p>

        <div className="battle-result-address">
          <div className="leaderboard-row__meta">Official Winner Address</div>
          <div style={{ color: '#39ff14', marginTop: '6px', wordBreak: 'break-word' }}>{winnerId}</div>
        </div>

        <div className="battle-result-actions">
          <button className="btn btn--primary" onClick={resetArena}>RETURN TO LOBBY</button>
          <button className="btn btn--outline" onClick={resetArena}>PLAY AGAIN</button>
        </div>
      </div>
    </div>
  );
}