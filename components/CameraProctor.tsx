
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
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    let currentStream: MediaStream | null = null;

    async function startCamera() {
      try {
        console.log("[Proctor] Requesting camera access...");
        currentStream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 640 }, 
            height: { ideal: 480 },
            facingMode: "user"
          } 
        });
        
        setStream(currentStream);
        
        if (videoRef.current) {
          videoRef.current.srcObject = currentStream;
          // Explicitly call play to ensure video starts
          try {
            await videoRef.current.play();
            console.log("[Proctor] Camera stream playing.");
          } catch (e) {
            console.warn("[Proctor] Auto-play prevented, waiting for user interaction.", e);
          }
        }
      } catch (err) {
        console.error("[Proctor] Camera access error:", err);
      }
    }

    if (isActive && !stream) {
      startCamera();
    }

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        console.log("[Proctor] Camera tracks stopped.");
      }
    };
  }, [isActive, stream]);

  const performCheck = useCallback(async (customMessage?: string, forcedStatus?: ProctorLog['status']) => {
    // SYSTEM EVENT BYPASS: If it's a forced status (Tab Switch), we proceed even if AI is processing.
    if (!forcedStatus && isProcessing) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Ensure video is ready to be captured
    if (!video || !canvas || video.readyState < 2 || video.videoWidth === 0) {
      console.warn("[Proctor] Video not ready for snapshot. ReadyState:", video?.readyState);
      return;
    }

    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    // Capture visual frame
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvasCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const base64Image = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
    const snapshotUrl = `data:image/jpeg;base64,${base64Image}`;

    if (forcedStatus) {
      // Immediate recording for system events (Tab Switching)
      console.log(`[Proctor] Recording FORCED snapshot: ${forcedStatus}`);
      onViolation({
        timestamp: Date.now(),
        status: forcedStatus,
        message: customMessage || "System event detected.",
        snapshot: snapshotUrl
      });
    } else {
      // Routine AI Check
      setIsProcessing(true);
      console.log("[Proctor] Running background AI analysis...");
      
      try {
        const result = await analyzePresence(base64Image);
        console.log("[AI] Result:", result);
        
        if (!result.isPersonPresent || result.count !== 1) {
          onViolation({
            timestamp: Date.now(),
            status: result.count === 0 ? 'CRITICAL' : 'WARNING',
            message: result.description,
            snapshot: snapshotUrl
          });
        }
      } catch (err) {
        console.error("[AI] Analysis failed:", err);
      } finally {
        setIsProcessing(false);
      }
    }
    
    setLastCheckTime(Date.now());
  }, [onViolation, isProcessing]);

  useImperativeHandle(ref, () => ({
    takeSnapshot: async (msg, status) => {
      console.log(`[Proctor] Manual trigger: ${status} | ${msg}`);
      await performCheck(msg, status);
    }
  }));

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      if (Date.now() - lastCheckTime >= PROCTOR_CHECK_INTERVAL) {
        performCheck();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive, lastCheckTime, performCheck]);

  return (
    <div className="relative overflow-hidden rounded-[2rem] bg-slate-900 shadow-2xl border-4 border-white dark:border-slate-800 w-full h-full flex items-center justify-center">
      {/* Removed grayscale and high contrast to fix black-screen visual issues */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        onLoadedMetadata={() => setCameraReady(true)}
        className={`w-full h-full object-cover transition-opacity duration-500 ${cameraReady ? 'opacity-100' : 'opacity-0'}`}
      />
      
      {!cameraReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
           <span className="material-symbols-outlined animate-spin text-white opacity-20 text-4xl">refresh</span>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
      
      <div className="absolute top-3 left-3 flex items-center space-x-2 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-full">
        <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-slate-500'}`} />
        <span className="text-[9px] font-black text-white uppercase tracking-[0.1em]">
          {isActive ? 'Live' : 'Off'}
        </span>
      </div>

      {isProcessing && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-primary/80 backdrop-blur-md px-3 py-1 rounded-full text-[8px] font-black text-white uppercase tracking-[0.2em] shadow-lg animate-pulse">
          Analyzing
        </div>
      )}
    </div>
  );
});

export default CameraProctor;
