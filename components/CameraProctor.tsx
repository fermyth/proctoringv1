
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
  const lastCheckTimeRef = useRef<number>(Date.now());
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize Camera Stream with Mobile Focus
  const startCamera = useCallback(async () => {
    try {
      console.log("[Proctor] Requesting camera access...");
      const currentStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 }, 
          height: { ideal: 480 },
          facingMode: "user" // Critical for mobile
        },
        audio: false
      });
      
      setStream(currentStream);
      setError(null);
      console.log("[Proctor] Camera stream active.");
    } catch (err) {
      console.error("[Proctor] Camera access failed:", err);
      setError("Camera blocked or unavailable");
    }
  }, []);

  useEffect(() => {
    if (isActive) {
      startCamera();
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [isActive, startCamera]);

  // Connect Stream to Video Element with Mobile Workarounds
  useEffect(() => {
    const video = videoRef.current;
    if (video && stream) {
      video.srcObject = stream;
      
      const playVideo = async () => {
        try {
          await video.play();
        } catch (e) {
          console.warn("[Proctor] Autoplay failed, waiting for user interaction or retry.", e);
          // Retry logic for mobile
          setTimeout(playVideo, 1000);
        }
      };

      video.onloadedmetadata = playVideo;
    }
  }, [stream]);

  const performCheck = useCallback(async (customMessage?: string, forcedStatus?: ProctorLog['status']) => {
    // Prevent overlapping checks unless it's a forced system event (TAB_SWITCH)
    if (!forcedStatus && (isProcessing || !cameraActive)) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Safety check: Don't capture if video isn't actually ready/rendering
    if (!video || !canvas || video.readyState < 2 || video.videoWidth === 0) {
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Reset last check time IMMEDIATELY to keep the 2s rhythm consistent
    if (!forcedStatus) {
      lastCheckTimeRef.current = Date.now();
    }

    // Capture Frame
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const base64Image = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
    const snapshotUrl = `data:image/jpeg;base64,${base64Image}`;

    if (forcedStatus) {
      onViolation({
        timestamp: Date.now(),
        status: forcedStatus,
        message: customMessage || "System integrity event.",
        snapshot: snapshotUrl
      });
    } else {
      setIsProcessing(true);
      try {
        const result = await analyzePresence(base64Image);
        if (!result.isPersonPresent || result.count !== 1) {
          onViolation({
            timestamp: Date.now(),
            status: result.count === 0 ? 'CRITICAL' : 'WARNING',
            message: result.description,
            snapshot: snapshotUrl
          });
        }
      } catch (err) {
        console.error("[Proctor] AI verification error:", err);
      } finally {
        setIsProcessing(false);
      }
    }
  }, [onViolation, isProcessing, cameraActive]);

  useImperativeHandle(ref, () => ({
    takeSnapshot: async (msg, status) => {
      await performCheck(msg, status);
    }
  }));

  // Robust Loop using Ref to prevent re-mounting interval
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastCheckTimeRef.current >= PROCTOR_CHECK_INTERVAL) {
        performCheck();
      }
    }, 500); // Check every 500ms if it's time to run the 2000ms check

    return () => clearInterval(interval);
  }, [isActive, performCheck]);

  // Handle Tab Focus (Mobile optimization)
  useEffect(() => {
    const handleFocus = () => {
      if (videoRef.current && videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  return (
    <div className="relative w-full h-full min-h-[140px] rounded-[2rem] bg-slate-950 overflow-hidden shadow-2xl ring-4 ring-white dark:ring-slate-800">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        onPlaying={() => setCameraActive(true)}
        onPause={() => setCameraActive(false)}
        className={`w-full h-full object-cover transition-opacity duration-1000 ${cameraActive ? 'opacity-100' : 'opacity-0'}`}
        style={{ transform: 'scaleX(-1)' }}
      />
      
      {(!cameraActive || error) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900 px-6 text-center">
           {error ? (
             <>
               <span className="material-symbols-outlined text-rose-500 text-3xl">videocam_off</span>
               <span className="text-[10px] text-rose-500/80 font-black uppercase tracking-widest">{error}</span>
               <button onClick={startCamera} className="mt-2 text-[10px] bg-white/10 px-3 py-1 rounded-full text-white uppercase font-bold">Retry</button>
             </>
           ) : (
             <>
               <span className="material-symbols-outlined animate-pulse text-white/40 text-3xl">sensors</span>
               <span className="text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">Initializing Lens</span>
             </>
           )}
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
      
      {/* UI Overlays */}
      <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 z-10">
        <div className={`w-2 h-2 rounded-full ${cameraActive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-slate-600'}`} />
        <span className="text-[9px] font-black text-white uppercase tracking-widest">
          {cameraActive ? 'Active Proctor' : 'Standby'}
        </span>
      </div>

      {isProcessing && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-primary/90 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/20 z-10 whitespace-nowrap">
          <p className="text-[8px] font-black text-white uppercase tracking-[0.2em] animate-pulse">Syncing Integrity</p>
        </div>
      )}
    </div>
  );
});

export default CameraProctor;
