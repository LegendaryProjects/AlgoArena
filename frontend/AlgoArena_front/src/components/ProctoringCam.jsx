import { useRef, useCallback, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import { BACKEND_URL } from '../config';

export default function ProctoringCam({ inBattle }) {
  const webcamRef = useRef(null);
  const [status, setStatus] = useState("Awaiting Camera...");
  const [verified, setVerified] = useState(true);
  
  // NEW: Hard lock state if the OS or browser denies camera access
  const [camError, setCamError] = useState(false);

  const captureAndVerify = useCallback(async () => {
    if (camError) return; // Do not attempt to hit the backend if the camera is broken

    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        try {
          const response = await axios.post(`${BACKEND_URL}/proctor-check`, { image: imageSrc });
          if (!response.data.verified && !response.data.unavailable) {
             setVerified(false);
             setStatus("⚠️ Face Mismatch!");
          } else if (response.data.unavailable) {
             setStatus("⚠️ ML Offline");
          } else {
             setVerified(true);
             setStatus("🟢 Face Verified");
          }
        } catch (error) { 
          console.error("Proctoring error:", error); 
          setStatus("⚠️ Server Error");
        }
      }
    }
  }, [camError]);

  useEffect(() => {
    // If the camera is denied or hardware-locked, force the error UI and stop everything
    if (camError) {
      setStatus("❌ Camera Blocked");
      return;
    }

    if (inBattle) {
       setStatus("🟢 Proctoring Active");
       // Take a snapshot every 15 seconds to send to the ML server
       const interval = setInterval(() => captureAndVerify(), 15000);
       return () => clearInterval(interval);
    } else {
       setStatus("Camera Standby");
    }
  }, [inBattle, captureAndVerify, camError]);

  return (
    <div className="proctor-widget" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div 
        className="proctor-status" 
        style={{ 
          // Turn text red if they aren't verified OR if their camera is broken
          color: verified && !camError ? 'var(--success)' : 'var(--danger)', 
          fontSize: '0.85rem', 
          fontWeight: 'bold',
          fontFamily: 'monospace'
        }}
      >
        {status}
      </div>
      
      <div 
        className="cam-container" 
        style={{ 
          borderRadius: '8px', 
          overflow: 'hidden', 
          border: `2px solid ${verified && !camError ? '#333' : 'var(--danger)'}`,
          backgroundColor: '#111',
          minHeight: '150px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Webcam 
           audio={false} 
           ref={webcamRef} 
           screenshotFormat="image/jpeg" 
           width="100%" 
           style={{ display: "block", objectFit: 'cover' }} 
           onUserMedia={() => {
             setCamError(false); // Camera successfully grabbed!
             setStatus(inBattle ? "🟢 Proctoring Active" : "🟢 Camera Ready");
           }}
           onUserMediaError={(err) => {
             console.error("Camera Hardware Error:", err);
             setCamError(true); // Hard lock the UI
             setStatus("❌ Permission Denied");
           }}
        />
      </div>
    </div>
  );
}