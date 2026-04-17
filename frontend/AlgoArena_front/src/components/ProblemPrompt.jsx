import { useState, useEffect } from 'react';
import axios from 'axios';
import { BACKEND_URL } from '../config';

export default function ProblemPrompt({ slug }) {
  const [problemData, setProblemData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) {
      setProblemData(null);
      setLoading(false);
      return;
    }

    const fetchProblem = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${BACKEND_URL}/problem/${slug}`);
        if (response.data.success) {
          setProblemData({
            title: slug.replace(/-/g, ' ').toUpperCase(),
            html: response.data.descriptionHTML,
            tags: response.data.topicTags
          });
        }
      } catch (error) {
        console.error("Failed to fetch LeetCode problem:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProblem();
  }, [slug]);

  if (loading) return <div className="problem-container">Loading arena prompt...</div>;

  return (
    <div className="problem-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {!problemData ? (
        <div className="problem-content">Awaiting battle assignment.</div>
      ) : (
        <>
          <div className="problem-header" style={{ flexShrink: 0, marginBottom: '10px' }}>
            <h3 className="problem-title">⚔ {problemData.title}</h3>
          </div>
          
          <div className="problem-tags" style={{ flexShrink: 0, display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '15px' }}>
            {problemData.tags?.map((tag, i) => (
              <span key={i} className="badge badge--violet">{tag.name}</span>
            ))}
          </div>

          {/* CRITICAL UI FIX: Added overflowY and maxHeight so the text scrolls internally! */}
          <div 
            className="problem-content" 
            style={{ 
              flexGrow: 1, 
              overflowY: 'auto', 
              maxHeight: '55vh', // Adjust this value if you want the box taller/shorter
              paddingRight: '15px' // Gives the scrollbar some breathing room
            }}
          >
            <div className="leetcode-content" dangerouslySetInnerHTML={{ __html: problemData.html }} />
          </div>
        </>
      )}
    </div>
  );
}