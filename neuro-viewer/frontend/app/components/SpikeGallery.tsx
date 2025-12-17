/**
 * SpikeGallery Component
 *
 * Visualizes spike waveforms extracted from detected events.
 * Renders hundreds/thousands of spike snippets efficiently using Canvas.
 *
 * Features:
 * - Overlay mode: All spikes drawn with transparency to reveal average shape
 * - Grid mode: Individual spikes in a grid layout (future enhancement)
 * - Efficient canvas rendering (single paint pass)
 * - Automatic scaling and normalization
 */

'use client';

import React, { useRef, useEffect, useState } from 'react';

interface SpikeGalleryProps {
  /** Full voltage waveform data */
  rawData: Float32Array;
  /** Array of sample indices where spikes were detected */
  spikeIndices: number[];
  /** Sampling rate in Hz (e.g., 30000) */
  samplingRate: number;
  /** Threshold value used for detection (for visual reference) */
  threshold: number;
}

interface SpikeWindow {
  /** Start index in raw data */
  startIdx: number;
  /** End index in raw data */
  endIdx: number;
  /** Extracted voltage samples */
  samples: Float32Array;
  /** Peak index within this window */
  peakIdx: number;
}

/**
 * Convert microseconds to number of samples
 *
 * @param microseconds - Time in microseconds
 * @param samplingRate - Sampling rate in Hz
 * @returns Number of samples corresponding to the time period
 *
 * @example
 * // At 30kHz, 1000μs = 30 samples
 * microsToSamples(1000, 30000) // Returns 30
 */
function microsToSamples(microseconds: number, samplingRate: number): number {
  // Convert μs to seconds, multiply by sampling rate
  return Math.round((microseconds / 1_000_000) * samplingRate);
}

/**
 * Extract spike waveform windows around detected events
 *
 * @param rawData - Full waveform array
 * @param spikeIndices - Detected spike indices
 * @param samplingRate - Sampling rate in Hz
 * @param preEventMicros - Time before spike peak (μs)
 * @param postEventMicros - Time after spike peak (μs)
 * @returns Array of extracted spike windows
 */
function extractSpikeWindows(
  rawData: Float32Array,
  spikeIndices: number[],
  samplingRate: number,
  preEventMicros: number = 700,
  postEventMicros: number = 1000
): SpikeWindow[] {
  const preSamples = microsToSamples(preEventMicros, samplingRate);
  const postSamples = microsToSamples(postEventMicros, samplingRate);

  const windows: SpikeWindow[] = [];

  for (const spikeIdx of spikeIndices) {
    // Calculate window bounds with boundary checks
    const startIdx = Math.max(0, spikeIdx - preSamples);
    const endIdx = Math.min(rawData.length, spikeIdx + postSamples);

    // Skip if window is too small (edge case)
    if (endIdx - startIdx < 10) {
      continue;
    }

    // Extract samples
    const samples = rawData.slice(startIdx, endIdx);

    // Find peak within window
    let peakIdx = 0;
    let peakValue = samples[0];
    for (let i = 1; i < samples.length; i++) {
      if (Math.abs(samples[i]) > Math.abs(peakValue)) {
        peakValue = samples[i];
        peakIdx = i;
      }
    }

    windows.push({
      startIdx,
      endIdx,
      samples,
      peakIdx,
    });
  }

  return windows;
}

/**
 * Calculate global min/max across all spike windows
 */
function calculateGlobalRange(windows: SpikeWindow[]): { min: number; max: number } {
  if (windows.length === 0) {
    return { min: 0, max: 1 };
  }

  let globalMin = windows[0].samples[0];
  let globalMax = windows[0].samples[0];

  for (const window of windows) {
    for (let i = 0; i < window.samples.length; i++) {
      const value = window.samples[i];
      if (value < globalMin) globalMin = value;
      if (value > globalMax) globalMax = value;
    }
  }

  return { min: globalMin, max: globalMax };
}

/**
 * Draw spike windows on canvas in overlay mode
 */
function drawOverlayMode(
  ctx: CanvasRenderingContext2D,
  windows: SpikeWindow[],
  width: number,
  height: number,
  globalMin: number,
  globalMax: number,
  threshold: number
): void {
  if (windows.length === 0) return;

  // Clear canvas
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  const range = globalMax - globalMin;
  const padding = 20;
  const plotHeight = height - 2 * padding;
  const plotWidth = width - 2 * padding;

  // Find longest window to use as reference length
  const maxLength = Math.max(...windows.map(w => w.samples.length));

  // Calculate opacity based on spike count (lower opacity for more spikes)
  const baseOpacity = Math.max(0.02, Math.min(0.2, 50 / windows.length));

  // Draw all spike windows
  ctx.lineWidth = 1;
  ctx.strokeStyle = `rgba(0, 255, 0, ${baseOpacity})`;

  for (const window of windows) {
    ctx.beginPath();

    for (let i = 0; i < window.samples.length; i++) {
      // Normalize x position based on max length (align all spikes)
      const x = padding + (i / maxLength) * plotWidth;

      // Normalize y position based on global range
      const normalized = (window.samples[i] - globalMin) / range;
      const y = height - padding - normalized * plotHeight;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
  }

  // Draw threshold line
  const thresholdNormalized = (threshold - globalMin) / range;
  const thresholdY = height - padding - thresholdNormalized * plotHeight;

  ctx.strokeStyle = '#ff4444';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(padding, thresholdY);
  ctx.lineTo(width - padding, thresholdY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw time axis labels
  ctx.fillStyle = '#aaa';
  ctx.font = '12px Arial, sans-serif';
  ctx.textAlign = 'center';

  // -700μs mark
  ctx.fillText('-700μs', padding, height - 5);

  // 0μs mark (spike time)
  const avgPreSamples = windows.reduce((sum, w) => sum + w.peakIdx, 0) / windows.length;
  const zeroX = padding + (avgPreSamples / maxLength) * plotWidth;
  ctx.strokeStyle = '#ffaa00';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(zeroX, padding);
  ctx.lineTo(zeroX, height - padding);
  ctx.stroke();
  ctx.fillText('0μs', zeroX, height - 5);

  // +1000μs mark
  ctx.fillText('+1000μs', width - padding, height - 5);

  // Draw y-axis labels
  ctx.textAlign = 'right';
  ctx.fillText(globalMax.toFixed(1), padding - 5, padding + 10);
  ctx.fillText(globalMin.toFixed(1), padding - 5, height - padding);

  // Draw title
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';
  ctx.font = '14px Arial, sans-serif';
  ctx.fillText(`Spike Overlay (n=${windows.length})`, 10, 20);
}

/**
 * Draw average waveform
 */
function drawAverageWaveform(
  ctx: CanvasRenderingContext2D,
  windows: SpikeWindow[],
  width: number,
  height: number,
  globalMin: number,
  globalMax: number
): void {
  if (windows.length === 0) return;

  const maxLength = Math.max(...windows.map(w => w.samples.length));
  const average = new Float32Array(maxLength);
  const counts = new Uint32Array(maxLength);

  // Accumulate samples
  for (const window of windows) {
    for (let i = 0; i < window.samples.length; i++) {
      average[i] += window.samples[i];
      counts[i]++;
    }
  }

  // Calculate average
  for (let i = 0; i < maxLength; i++) {
    if (counts[i] > 0) {
      average[i] /= counts[i];
    }
  }

  // Draw average waveform
  const range = globalMax - globalMin;
  const padding = 20;
  const plotHeight = height - 2 * padding;
  const plotWidth = width - 2 * padding;

  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 2;
  ctx.beginPath();

  for (let i = 0; i < maxLength; i++) {
    if (counts[i] === 0) continue;

    const x = padding + (i / maxLength) * plotWidth;
    const normalized = (average[i] - globalMin) / range;
    const y = height - padding - normalized * plotHeight;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.stroke();

  // Draw label
  ctx.fillStyle = '#00ffff';
  ctx.font = '12px Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Average', width - 10, 35);
}

export default function SpikeGallery({
  rawData,
  spikeIndices,
  samplingRate,
  threshold,
}: SpikeGalleryProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showAverage, setShowAverage] = useState(true);
  const [windows, setWindows] = useState<SpikeWindow[]>([]);
  const [stats, setStats] = useState({ min: 0, max: 0 });

  /**
   * Extract spike windows when inputs change
   */
  useEffect(() => {
    if (spikeIndices.length === 0 || rawData.length === 0) {
      setWindows([]);
      return;
    }

    const extractedWindows = extractSpikeWindows(
      rawData,
      spikeIndices,
      samplingRate,
      700,  // 700μs pre-event
      1000  // 1000μs post-event
    );

    const range = calculateGlobalRange(extractedWindows);

    setWindows(extractedWindows);
    setStats(range);
  }, [rawData, spikeIndices, samplingRate]);

  /**
   * Render canvas when windows or display options change
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear if no data
    if (windows.length === 0) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#fff';
      ctx.font = '16px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No spikes detected', canvas.width / 2, canvas.height / 2);
      return;
    }

    // Draw overlay mode
    drawOverlayMode(
      ctx,
      windows,
      canvas.width,
      canvas.height,
      stats.min,
      stats.max,
      threshold
    );

    // Draw average waveform if enabled
    if (showAverage) {
      drawAverageWaveform(
        ctx,
        windows,
        canvas.width,
        canvas.height,
        stats.min,
        stats.max
      );
    }
  }, [windows, stats, threshold, showAverage]);

  /**
   * Handle window resize
   */
  useEffect(() => {
    const handleResize = () => {
      // Force canvas redraw on resize
      setWindows(prev => [...prev]);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div style={{ width: '100%', fontFamily: 'Arial, sans-serif' }}>
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={1200}
        height={400}
        style={{
          border: '1px solid #444',
          borderRadius: '4px',
          backgroundColor: '#000',
          display: 'block',
          width: '100%',
        }}
      />

      {/* Controls */}
      <div
        style={{
          marginTop: '15px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {/* Statistics */}
        <div style={{ fontSize: '14px', color: '#fff' }}>
          <div>
            Spikes: <span style={{ color: '#0f0' }}>{windows.length}</span> extracted
          </div>
          <div>
            Window: <span style={{ color: '#0f0' }}>-700μs to +1000μs</span> ({microsToSamples(700, samplingRate) + microsToSamples(1000, samplingRate)} samples)
          </div>
          <div>
            Range: <span style={{ color: '#0f0' }}>{stats.min.toFixed(2)} to {stats.max.toFixed(2)}</span>
          </div>
        </div>

        {/* Toggle Average */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            color: '#fff',
          }}
        >
          <input
            type="checkbox"
            checked={showAverage}
            onChange={(e) => setShowAverage(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ color: '#0ff' }}>Show Average Waveform</span>
        </label>
      </div>

      {/* Legend */}
      <div
        style={{
          marginTop: '10px',
          fontSize: '12px',
          color: '#fff',
          display: 'flex',
          gap: '20px',
          opacity: 0.8,
        }}
      >
        <div>
          <span style={{ color: '#0f0' }}>█</span> Individual spikes (overlaid)
        </div>
        {showAverage && (
          <div>
            <span style={{ color: '#0ff' }}>─</span> Average waveform
          </div>
        )}
        <div>
          <span style={{ color: '#f44' }}>┄</span> Detection threshold
        </div>
        <div>
          <span style={{ color: '#fa0' }}>│</span> Spike time (0μs)
        </div>
      </div>
    </div>
  );
}
