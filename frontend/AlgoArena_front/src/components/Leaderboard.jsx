import { useState, useEffect } from 'react';
import axios from 'axios';
import { BACKEND_URL } from '../config';

export default function Leaderboard() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await axios.get(`${BACKEND_URL}/leaderboard`);
        if (response.data.success) {
          setHistory(response.data.leaderboard);
        }
      } catch (error) {
        console.error("Failed to fetch Web3 leaderboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
    // Poll every 10 seconds to keep the leaderboard fresh
    const interval = setInterval(fetchLeaderboard, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="leaderboard-container">
      <div className="leaderboard-header">
        <div>
          <span className="badge badge--amber">Blockchain Ranking</span>
          <h3 className="leaderboard-title">Battle History</h3>
        </div>
      </div>

      {loading ? (
        <p className="problem-content">Syncing with Sepolia Network...</p>
      ) : history.length === 0 ? (
        <p className="problem-content">No battles recorded on the blockchain yet.</p>
      ) : (
        <div className="leaderboard-list">
          {history.map((match, index) => (
            <div key={index} className="leaderboard-row">
              <div className="leaderboard-row__meta">{match.date}</div>
              <div className="leaderboard-row__player">
                <strong>👑 {match.winner.slice(0, 6)}...{match.winner.slice(-4)}</strong>
                <span>Winner</span>
              </div>
              <div className="leaderboard-row__player">
                <strong>💀 {match.loser.slice(0, 6)}...{match.loser.slice(-4)}</strong>
                <span>Loser</span>
              </div>
              <div className="leaderboard-row__rating">{index + 1}</div>
              <div className="leaderboard-row__chain">
                <span className="badge badge--violet">ON-CHAIN</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

