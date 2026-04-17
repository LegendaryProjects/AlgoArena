import { useRef, useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import { BACKEND_URL } from '../config';

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
      const response = await axios.post(`${BACKEND_URL}/proctor-check`, {
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
    <div className="proctoring-wrapper" style={{ borderColor: isVerified ? 'rgba(57, 255, 20, 0.28)' : 'rgba(255, 115, 81, 0.35)' }}>
      <div className="proctoring-header">
        <div>
          <span className="badge badge--green">PROCTOR CAM</span>
          <h3 className="proctoring-title">{isVerified ? 'Identity Verified' : 'Unrecognized Face'}</h3>
        </div>
      </div>

      <div className="proctoring-status" style={{ color: isVerified ? '#39ff14' : '#ff7351' }}>
        {isVerified ? '🛡 Secure' : '⚠ Attention Required'}
      </div>

      <div className="proctoring-frame">
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          mirrored
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    </div>
  );
}