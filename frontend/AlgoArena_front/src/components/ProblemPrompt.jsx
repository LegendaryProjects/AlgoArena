import { useState, useEffect } from 'react';
import axios from 'axios';

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
        // Hit our Node.js backend which proxies the ALFA API
        const response = await axios.get(`http://localhost:5001/problem/${slug}`);
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

  if (loading) {
    return <div className="problem-container">Loading arena prompt...</div>;
  }

  return (
    <div className="problem-container">
      {!problemData ? (
        <div className="problem-content">Awaiting battle assignment.</div>
      ) : (
        <>
          <div className="problem-header">
            <div>
              <span className="badge badge--amber">Challenge</span>
              <h3 className="problem-title">⚔ {problemData.title}</h3>
            </div>
          </div>

          <div className="problem-tags">
            {problemData.tags?.map((tag, i) => (
              <span key={i} className="badge badge--violet">
                {tag.name}
              </span>
            ))}
          </div>

          <div className="problem-content">
            <div className="leetcode-content" dangerouslySetInnerHTML={{ __html: problemData.html }} />
          </div>
        </>
      )}
    </div>
  );
}