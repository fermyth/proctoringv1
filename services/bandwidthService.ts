
/**
 * Simple bandwidth test service
 * Measures the time to download a placeholder image
 */
export const testBandwidth = async (): Promise<number> => {
  try {
    const startTime = Date.now();
    // Using a 1000x1000 image which is roughly 100-300KB depending on compression
    // We use a random seed to avoid caching
    const testUrl = `https://picsum.photos/seed/${Math.random()}/1000/1000`;
    
    const response = await fetch(testUrl, { cache: 'no-store', referrerPolicy: 'no-referrer' });
    if (!response.ok) throw new Error('Network response was not ok');
    
    const blob = await response.blob();
    const endTime = Date.now();
    
    const durationInSeconds = (endTime - startTime) / 1000;
    const sizeInBits = blob.size * 8;
    const bps = sizeInBits / durationInSeconds;
    const mbps = bps / (1024 * 1024);
    
    return mbps;
  } catch (error) {
    console.error('Bandwidth test failed:', error);
    return 0;
  }
};
