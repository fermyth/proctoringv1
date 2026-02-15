
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { analyzePresence } from '../services/geminiService';
import { PROCTOR_CHECK_INTERVAL } from '../constants';
import { ProctorLog } from '../types';

interface CameraProctorProps {
  onViolation: (log: ProctorLog) => void;
  isActive: boolean;
}

const CameraProctor: React.FC<CameraProctorProps> = ({ onViolation, isActive }) => {
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
      } catch (err) {
        console.error("Camera access denied:", err);
      }
    }

    if (isActive && !stream) {
      startCamera();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isActive, stream]);

  const performCheck = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isProcessing) return;

    setIsProcessing(true);
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64Image = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
      
      const analysis = await analyzePresence(base64Image);
      
      if (!analysis.isPersonPresent || analysis.count !== 1) {
        onViolation({
          timestamp: Date.now(),
          status: analysis.count === 0 ? 'CRITICAL' : 'WARNING',
          message: analysis.description,
          snapshot: `data:image/jpeg;base64,${base64Image}`
        });
      }
    }
    setIsProcessing(false);
    setLastCheckTime(Date.now());
  }, [onViolation, isProcessing]);

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
};

export default CameraProctor;
