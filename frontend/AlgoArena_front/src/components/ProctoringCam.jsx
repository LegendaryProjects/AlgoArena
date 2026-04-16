import { useRef, useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';

export default function ProctoringCam({ inBattle }) {
  const webcamRef = useRef(null);
  const [isVerified, setIsVerified] = useState(true);

  const captureAndVerify = useCallback(async () => {
    // We only want to run proctoring if the user is actively in a battle
    if (!webcamRef.current || !inBattle) return;
    
    // Extract the frame as a base64 string
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    try {
      const response = await axios.post("http://localhost:5001/proctor-check", {
        image: imageSrc
      });

      if (response.data.success) {
        setIsVerified(response.data.verified);
        
        if (!response.data.verified) {
          console.warn("[ANTI-CHEAT] Player substitution detected!");
          // TODO: Emit a socket event here to disqualify the player
          // socket.emit("cheat_detected", { roomId, walletAddress });
        }
      }
    } catch (error) {
      console.error("Proctoring service unavailable:", error);
    }
  }, [inBattle]);

  useEffect(() => {
    // Run the DeepFace verification every 10 seconds
    let interval;
    if (inBattle) {
      interval = setInterval(captureAndVerify, 10000);
    }
    return () => clearInterval(interval);
  }, [inBattle, captureAndVerify]);

  return (
    <div className="proctoring-wrapper" style={{ 
        border: isVerified ? '2px solid #28a745' : '2px solid #dc3545', 
        padding: '10px', 
        borderRadius: '8px', 
        backgroundColor: '#111',
        maxWidth: '350px'
    }}>
      <h3 style={{ color: isVerified ? '#28a745' : '#dc3545', marginTop: 0, textAlign: 'center', fontSize: '1.2rem' }}>
        {isVerified ? "🛡️ Identity Verified" : "⚠️ UNRECOGNIZED FACE!"}
      </h3>
      
      <Webcam
        audio={false}
        ref={webcamRef}
        screenshotFormat="image/jpeg"
        width={320}
        height={240}
        style={{ borderRadius: '4px' }}
      />
    </div>
  );
}