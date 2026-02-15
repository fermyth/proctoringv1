
import React, { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { analyzePresence } from '../services/geminiService';
import { PROCTOR_CHECK_INTERVAL } from '../constants';
import { ProctorLog } from '../types';

interface CameraProctorProps {
  onViolation: (log: ProctorLog) => void;
  isActive: boolean;
}

export interface CameraProctorHandle {
  takeSnapshot: (customMessage?: string, status?: ProctorLog['status']) => Promise<void>;
}

const CameraProctor = forwardRef<CameraProctorHandle, CameraProctorProps>(({ onViolation, isActive }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [lastCheckTime, setLastCheckTime] = useState<number>(Date.now());
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    async function startCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 640, height: 480 } 
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        console.log("[Proctor] Camera stream started successfully.");
      } catch (err) {
        console.error("[Proctor] Camera access denied:", err);
      }
    }

    if (isActive && !stream) {
      startCamera();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        console.log("[Proctor] Camera stream stopped.");
      }
    };
  }, [isActive, stream]);

  const performCheck = useCallback(async (customMessage?: string, forcedStatus?: ProctorLog['status']) => {
    // If it's a background check and we are already processing, skip.
    // BUT if it's a forcedStatus (Tab Switch), we MUST proceed to record evidence.
    if (!forcedStatus && isProcessing) {
      return;
    }

    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    if (video.videoWidth === 0) return;

    // Capture visual evidence immediately
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64Image = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
    const snapshotUrl = `data:image/jpeg;base64,${base64Image}`;

    // Handle System Events (Tab Switch) immediately
    if (forcedStatus) {
      console.warn(`[Proctor] FORCED LOG: ${forcedStatus} - ${customMessage}`);
      onViolation({
        timestamp: Date.now(),
        status: forcedStatus,
        message: customMessage || "System event detected",
        snapshot: snapshotUrl
      });
      // We still run analysis in background for description if needed, 
      // but the log is already committed.
    } else {
      // Standard AI background check
      setIsProcessing(true);
      console.log("[Proctor] Starting AI Presence Analysis...");
      
      try {
        const analysis = await analyzePresence(base64Image);
        console.log("[Proctor] AI Analysis Result:", analysis);
        
        if (!analysis.isPersonPresent || analysis.count !== 1) {
          onViolation({
            timestamp: Date.now(),
            status: analysis.count === 0 ? 'CRITICAL' : 'WARNING',
            message: analysis.description,
            snapshot: snapshotUrl
          });
        }
      } catch (err) {
        console.error("[Proctor] AI Analysis failed:", err);
      } finally {
        setIsProcessing(false);
      }
    }
    
    setLastCheckTime(Date.now());
  }, [onViolation, isProcessing]);

  // Expose takeSnapshot to parent
  useImperativeHandle(ref, () => ({
    takeSnapshot: async (msg, status) => {
      console.log(`[Proctor] Manual snapshot requested for: ${status}`);
      await performCheck(msg, status);
    }
  }));

  useEffect(() => {
    if (!isActive) return;

    const intervalId = setInterval(() => {
      if (Date.now() - lastCheckTime >= PROCTOR_CHECK_INTERVAL) {
        performCheck();
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isActive, lastCheckTime, performCheck]);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-black shadow-xl border-4 border-slate-200">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-auto object-cover grayscale contrast-125"
      />
      <canvas ref={canvasRef} className="hidden" />
      
      <div className="absolute top-4 left-4 flex items-center space-x-2">
        <div className={`w-3 h-3 rounded-full animate-pulse ${isActive ? 'bg-red-500' : 'bg-gray-500'}`} />
        <span className="text-xs font-bold text-white uppercase tracking-widest drop-shadow-md">
          {isActive ? 'Live Proctoring' : 'Standby'}
        </span>
      </div>

      {isProcessing && (
        <div className="absolute bottom-4 right-4 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-[10px] text-white">
          AI Analysis...
        </div>
      )}
    </div>
  );
});

export default CameraProctor;
