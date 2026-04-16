import React from 'react';

export default function ProblemPrompt() {
  // For the MVP, we are statically displaying Problem 1 to match the ArenaEditor
  const problem = {
    title: "The Arena Gateway",
    difficulty: "Easy",
    description: "Welcome to your first trial. Write a C++ program that outputs exactly:\n\nAlgoArena 2026",
  };

  return (
    <div className="problem-container" style={{ 
        backgroundColor: '#1e1e1e', 
        padding: '20px', 
        borderRadius: '8px',
        border: '1px solid #333',
        marginBottom: '20px',
        color: '#fff',
        textAlign: 'left'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, color: '#61dafb' }}>⚔️ Task: {problem.title}</h2>
        <span style={{ 
            backgroundColor: '#28a745', 
            padding: '5px 10px', 
            borderRadius: '12px', 
            fontSize: '0.8rem',
            fontWeight: 'bold'
        }}>
          {problem.difficulty}
        </span>
      </div>
      <hr style={{ borderColor: '#333', margin: '15px 0' }} />
      <p style={{ whiteSpace: 'pre-wrap', fontSize: '1.1rem', lineHeight: '1.5' }}>
        {problem.description}
      </p>
    </div>
  );
}