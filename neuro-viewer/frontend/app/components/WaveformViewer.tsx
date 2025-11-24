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

        setWaveformData(Array.from(floatArray));
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

    // Calculate min and max from data
    let min = waveformData[0];
    let max = waveformData[0];
    for (let i = 1; i < waveformData.length; i++) {
      if (waveformData[i] < min) min = waveformData[i];
      if (waveformData[i] > max) max = waveformData[i];
    }

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

    // Draw axis labels
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.fillText(`Max: ${max.toFixed(2)}`, 10, 15);
    ctx.fillText(`Min: ${min.toFixed(2)}`, 10, height - 5);
  }, [waveformData]);

  if (loading) {
    return <div style={{ padding: '20px', color: '#888' }}>Loading waveform...</div>;
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={1200}
        height={400}
        style={{ border: '1px solid #333', display: 'block' }}
      />
      <div style={{ marginTop: '10px', color: '#888', fontSize: '14px' }}>
        Samples: {waveformData.length} | Sampling Rate: {metadata.sampling_rate} Hz
      </div>
    </div>
  );
}
