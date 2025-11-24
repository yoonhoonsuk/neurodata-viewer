'use client';

import React, { useEffect, useRef, useState } from 'react';

interface WaveformViewerProps {
  fileId: string;
  metadata: {
    length: number;
    sampling_rate: number;
    min: number;
    max: number;
  };
}

export default function WaveformViewer({ fileId, metadata }: WaveformViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [threshold, setThreshold] = useState(0);
  const [dataRange, setDataRange] = useState({ min: 0, max: 0 });

  // Load waveform data
  useEffect(() => {
    const loadWaveform = async () => {
      try {
        const response = await fetch(
          `/api/chunk/${fileId}?start=0&duration=${metadata.length}`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Decode base64 float32 array
        const binaryString = atob(data.samples);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const floatArray = new Float32Array(bytes.buffer);
        const arrayData = Array.from(floatArray);

        // Calculate min and max
        let min = floatArray[0];
        let max = floatArray[0];
        for (let i = 1; i < floatArray.length; i++) {
          if (floatArray[i] < min) min = floatArray[i];
          if (floatArray[i] > max) max = floatArray[i];
        }

        setWaveformData(arrayData);
        setDataRange({ min, max });
        setThreshold((min + max) / 2);
        setLoading(false);
      } catch (error) {
        console.error('Failed to load waveform:', error);
        setLoading(false);
      }
    };

    loadWaveform();
  }, [fileId, metadata.length]);

  // Draw waveform
  useEffect(() => {
    if (!canvasRef.current || waveformData.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    const { min, max } = dataRange;

    // Draw waveform
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let i = 0; i < waveformData.length; i++) {
      const x = (i / waveformData.length) * width;
      const normalized = (waveformData[i] - min) / (max - min);
      const y = height - normalized * height;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();

    // Draw threshold line
    const thresholdNormalized = (threshold - min) / (max - min);
    const thresholdY = height - thresholdNormalized * height;
    ctx.strokeStyle = '#f00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, thresholdY);
    ctx.lineTo(width, thresholdY);
    ctx.stroke();

    // Draw playhead
    if (isPlaying) {
      const playheadX = (currentPosition / waveformData.length) * width;
      ctx.strokeStyle = '#0ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
    }

    // Draw axis labels
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.fillText(`Max: ${max.toFixed(2)}`, 10, 15);
    ctx.fillText(`Min: ${min.toFixed(2)}`, 10, height - 5);
  }, [waveformData, dataRange, threshold, isPlaying, currentPosition]);

  // Playback animation
  useEffect(() => {
    if (!isPlaying) return;

    let animationFrameId: number;
    let lastTime = Date.now();

    const animate = () => {
      const now = Date.now();
      const deltaTime = (now - lastTime) / 1000;
      lastTime = now;

      const samplesPerSecond = metadata.sampling_rate;
      const newPosition = currentPosition + samplesPerSecond * deltaTime;

      if (newPosition >= waveformData.length) {
        setCurrentPosition(0);
        setIsPlaying(false);
      } else {
        setCurrentPosition(newPosition);
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, currentPosition, metadata.sampling_rate, waveformData.length]);

  // Handle canvas click to move threshold
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = canvas.height;

    const normalized = 1 - y / height;
    const newThreshold = normalized * (dataRange.max - dataRange.min) + dataRange.min;
    setThreshold(newThreshold);
  };

  if (loading) {
    return <div style={{ padding: '20px', color: '#888' }}>Loading waveform...</div>;
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={1200}
        height={400}
        style={{ border: '1px solid #333', display: 'block', cursor: 'crosshair' }}
        onClick={handleCanvasClick}
      />
      <div style={{ marginTop: '10px', display: 'flex', gap: '15px', alignItems: 'center' }}>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          style={{
            padding: '8px 16px',
            backgroundColor: isPlaying ? '#f44' : '#4f4',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            color: '#000',
            fontWeight: 'bold',
          }}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <div style={{ color: '#888', fontSize: '14px' }}>
          Position: {Math.floor(currentPosition)} / {waveformData.length}
        </div>
        <div style={{ color: '#888', fontSize: '14px' }}>
          Threshold: {threshold.toFixed(2)}
        </div>
      </div>
    </div>
  );
}
