import { useRef, useCallback, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import { BACKEND_URL } from '../config';

export default function ProctoringCam({ inBattle }) {
  const webcamRef = useRef(null);
  const [status, setStatus] = useState("Awaiting Camera...");
  const [verified, setVerified] = useState(true);
  const [camError, setCamError] = useState(false);
  const [referenceImage, setReferenceImage] = useState(null); // 👈 ADD THIS

  // 👇 ADD THIS BLOCK — captures reference photo when battle starts
  useEffect(() => {
    if (inBattle && !referenceImage && webcamRef.current) {
      const t = setTimeout(() => {
        const img = webcamRef.current?.getScreenshot();
        if (img) setReferenceImage(img);
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [inBattle, referenceImage]);

  // 👇 UPDATED — now sends referenceImage + currentImage separately
  const captureAndVerify = useCallback(async () => {
    if (camError) return;
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setStatus("🔍 Scanning Face...");
        try {
          const response = await axios.post(`${BACKEND_URL}/proctor-check`, {
            referenceImage,   // enrolled photo
            currentImage: imageSrc  // live frame
          }); 
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
          setStatus("⚠️ Server Error");
        }
      }
    }
  }, [camError, referenceImage]); // 👈 referenceImage added to deps

  useEffect(() => {
    if (camError) {
      setStatus("❌ Camera Blocked");
      return;
    }
    if (inBattle) {
      setStatus("🟢 Proctoring Active");
      const firstScan = setTimeout(() => captureAndVerify(), 1000);
      const interval = setInterval(() => captureAndVerify(), 15000);
      return () => {
        clearTimeout(firstScan);
        clearInterval(interval);
      };
    } else {
      setStatus("Camera Standby");
    }
  }, [inBattle, captureAndVerify, camError]);

  return (
    <div className="proctor-widget" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div
        className="proctor-status"
        style={{
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
            setCamError(false);
            if (!inBattle) setStatus("🟢 Camera Ready");
          }}
          onUserMediaError={() => {
            setCamError(true);
            setStatus("❌ Permission Denied");
          }}
        />
      </div>
    </div>
  );
}