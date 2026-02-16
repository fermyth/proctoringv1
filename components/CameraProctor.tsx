
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
  const [cameraActive, setCameraActive] = useState(false);

  // Initialize Camera Stream
  useEffect(() => {
    if (!isActive) return;

    let mounted = true;
    let currentStream: MediaStream | null = null;

    async function startCamera() {
      try {
        console.log("[Proctor] Initializing camera device...");
        currentStream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 640 }, 
            height: { ideal: 480 },
            facingMode: "user"
          },
          audio: false
        });
        
        if (mounted) {
          setStream(currentStream);
          console.log("[Proctor] Stream acquired.");
        } else {
          currentStream.getTracks().forEach(t => t.stop());
        }
      } catch (err) {
        console.error("[Proctor] Camera access denied or failed:", err);
      }
    }

    startCamera();

    return () => {
      mounted = false;
      if (currentStream) {
        currentStream.getTracks().forEach(track => {
          track.stop();
          console.log(`[Proctor] Track ${track.label} stopped.`);
        });
      }
    };
  }, [isActive]);

  // Connect Stream to Video Element
  useEffect(() => {
    const video = videoRef.current;
    if (video && stream) {
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video.play().catch(e => {
          console.warn("[Proctor] Auto-play blocked by browser. User interaction required.", e);
        });
      };
    }
  }, [stream]);

  const performCheck = useCallback(async (customMessage?: string, forcedStatus?: ProctorLog['status']) => {
    // Only bypass if it's a critical system event like TAB_SWITCH
    if (!forcedStatus && (isProcessing || !cameraActive)) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Safety checks for video state
    if (!video || !canvas || video.readyState < 2 || video.videoWidth === 0) {
      console.warn("[Proctor] Capture skipped: Video element not ready.");
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Snapshot capture logic
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const base64Image = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
    const snapshotUrl = `data:image/jpeg;base64,${base64Image}`;

    if (forcedStatus) {
      console.log(`[Proctor] EVENT LOG: ${forcedStatus}`);
      onViolation({
        timestamp: Date.now(),
        status: forcedStatus,
        message: customMessage || "System integrity event.",
        snapshot: snapshotUrl
      });
    } else {
      setIsProcessing(true);
      console.log("[Proctor] AI verification in progress...");
      
      try {
        const result = await analyzePresence(base64Image);
        console.log("[Proctor] AI Result:", result);
        
        if (!result.isPersonPresent || result.count !== 1) {
          onViolation({
            timestamp: Date.now(),
            status: result.count === 0 ? 'CRITICAL' : 'WARNING',
            message: result.description,
            snapshot: snapshotUrl
          });
        }
      } catch (err) {
        console.error("[Proctor] AI analysis failed:", err);
      } finally {
        setIsProcessing(false);
      }
    }
    
    setLastCheckTime(Date.now());
  }, [onViolation, isProcessing, cameraActive]);

  useImperativeHandle(ref, () => ({
    takeSnapshot: async (msg, status) => {
      await performCheck(msg, status);
    }
  }));

  // Background Loop
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
    <div className="relative w-full h-full min-h-[120px] rounded-[2rem] bg-slate-950 overflow-hidden shadow-2xl ring-4 ring-white dark:ring-slate-800">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        onPlaying={() => {
          console.log("[Proctor] Video is now playing.");
          setCameraActive(true);
        }}
        className={`w-full h-full object-cover transition-opacity duration-700 ${cameraActive ? 'opacity-100' : 'opacity-0'}`}
        style={{ transform: 'scaleX(-1)' }} // Mirror view for natural feel
      />
      
      {!cameraActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
           <span className="material-symbols-outlined animate-spin text-white/20 text-3xl">loading</span>
           <span className="text-[10px] text-white/20 font-bold uppercase tracking-widest">Waking Sensor</span>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
      
      {/* UI Overlays */}
      <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
        <div className={`w-2 h-2 rounded-full ${cameraActive ? 'bg-red-500 animate-pulse' : 'bg-slate-600'}`} />
        <span className="text-[9px] font-black text-white uppercase tracking-wider">
          {cameraActive ? 'Live Proctor' : 'Connecting'}
        </span>
      </div>

      {isProcessing && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-primary/90 backdrop-blur-md px-3 py-1 rounded-full border border-white/20">
          <p className="text-[8px] font-black text-white uppercase tracking-[0.2em] animate-pulse">Scanning Integrity</p>
        </div>
      )}
    </div>
  );
});

export default CameraProctor;
