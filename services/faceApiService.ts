
import * as faceapi from '@vladmandic/face-api';

// Public CDN for face-api.js models
const MODEL_URL = 'https://cdn.jsdelivr.net/gh/vladmandic/face-api/model/';

let modelsLoaded = false;
let isLoading = false;

export async function loadFaceApiModels() {
  if (modelsLoaded || isLoading) return;
  isLoading = true;
  try {
    console.log("[FaceAPI] Loading models from CDN...");
    // We only need TinyFaceDetector for presence/count to keep it lightweight
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    modelsLoaded = true;
    console.log("[FaceAPI] Models loaded successfully.");
  } catch (err) {
    console.error("[FaceAPI] Failed to load models:", err);
    throw err;
  } finally {
    isLoading = false;
  }
}

export async function detectPresenceLocally(videoElement: HTMLVideoElement): Promise<{
  isPersonPresent: boolean;
  count: number;
  description: string;
}> {
  if (!modelsLoaded) {
    await loadFaceApiModels();
  }

  // Use TinyFaceDetector for speed on web/mobile
  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 160, // Smaller for faster performance
    scoreThreshold: 0.5
  });

  const detections = await faceapi.detectAllFaces(videoElement, options);
  const count = detections.length;

  let description = "Normal status.";
  if (count === 0) description = "No face detected in the frame.";
  if (count > 1) description = `Multiple people detected (${count}).`;

  return {
    isPersonPresent: count === 1,
    count,
    description
  };
}
