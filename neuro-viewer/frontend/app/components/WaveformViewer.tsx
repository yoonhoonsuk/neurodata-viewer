/**
 * WaveformViewer Component
 *
 * High-performance neural waveform visualization using uPlot.
 * Features:
 * - Efficient rendering of millions of data points
 * - Interactive threshold adjustment
 * - Real-time spike detection via Web Worker
 * - Zoom and pan controls
 */

'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

import { fetchWaveformData, calculateStats, DataStats } from '../utils/dataLoader';
import { createSpikeWorker, SpikeWorker, SpikeDetectionResult } from '../utils/spikeWorker';
import SpikeGallery from './SpikeGallery';

interface WaveformViewerProps {
  fileId: string;
  metadata: {
    length: number;
    sampling_rate: number;
    min: number;
    max: number;
  };
}

interface ViewState {
  /** Currently displayed data */
  data: Float32Array | null;
  /** Data statistics */
  stats: DataStats | null;
  /** Loading state */
  loading: boolean;
  /** Error message if any */
  error: string | null;
}

interface SpikeState {
  /** Detected spike indices */
  spikes: number[];
  /** Spike detection statistics */
  stats: { count: number; rate: number | null; isis: number[] } | null;
  /** Detection computation time */
  computeTime: number;
  /** Detecting state */
  detecting: boolean;
}

export default function WaveformViewer({ fileId, metadata }: WaveformViewerProps) {
  // Refs
  const plotContainerRef = useRef<HTMLDivElement>(null);
  const plotInstanceRef = useRef<uPlot | null>(null);
  const workerRef = useRef<SpikeWorker | null>(null);

  // State
  const [viewState, setViewState] = useState<ViewState>({
    data: null,
    stats: null,
    loading: true,
    error: null,
  });

  const [threshold, setThreshold] = useState<number>(0);
  const [spikeState, setSpikeState] = useState<SpikeState>({
    spikes: [],
    stats: null,
    computeTime: 0,
    detecting: false,
  });

  /**
   * Initialize Web Worker
   */
  useEffect(() => {
    workerRef.current = createSpikeWorker();

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  /**
   * Load waveform data
   */
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        setViewState(prev => ({ ...prev, loading: true, error: null }));

        // Fetch binary data
        const data = await fetchWaveformData(fileId);

        if (cancelled) return;

        // Calculate statistics
        const stats = calculateStats(data);

        // Set initial threshold to midpoint
        const initialThreshold = (stats.min + stats.max) / 2;

        setViewState({
          data,
          stats,
          loading: false,
          error: null,
        });

        setThreshold(initialThreshold);

      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load waveform:', error);
          setViewState({
            data: null,
            stats: null,
            loading: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [fileId]);

  /**
   * Create uPlot instance
   */
  useEffect(() => {
    if (!plotContainerRef.current || !viewState.data || !viewState.stats) {
      return;
    }

    const { data, stats } = viewState;

    // Prepare data for uPlot: [x-axis, y-axis]
    const timeAxis = new Float64Array(data.length);
    const samplingRate = metadata.sampling_rate;

    for (let i = 0; i < data.length; i++) {
      timeAxis[i] = i / samplingRate; // Convert to seconds
    }

    const plotData: uPlot.AlignedData = [timeAxis, data];

    // uPlot configuration
    const opts: uPlot.Options = {
      width: plotContainerRef.current.clientWidth,
      height: 500,
      plugins: [
        // Threshold line plugin
        {
          hooks: {
            draw: [
              (u) => {
                if (!u.ctx) return;

                const ctx = u.ctx;
                const { left, top, width, height } = u.bbox;

                // Draw threshold line
                const thresholdY = u.valToPos(threshold, 'y', true);

                ctx.save();
                ctx.strokeStyle = '#ff4444';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(left, thresholdY);
                ctx.lineTo(left + width, thresholdY);
                ctx.stroke();
                ctx.restore();

                // Draw threshold label
                ctx.save();
                ctx.fillStyle = '#ffffff';
                ctx.font = '12px Arial, sans-serif';
                ctx.fillText(
                  `Threshold: ${threshold.toFixed(2)}`,
                  left + 10,
                  thresholdY - 5
                );
                ctx.restore();
              },
            ],
          },
        },
        // Spike markers plugin
        {
          hooks: {
            draw: [
              (u) => {
                if (!u.ctx || spikeState.spikes.length === 0) return;

                const ctx = u.ctx;
                const { left, top, height } = u.bbox;

                ctx.save();
                ctx.strokeStyle = '#ffaa00';
                ctx.lineWidth = 1;

                spikeState.spikes.forEach((spikeIdx) => {
                  const time = spikeIdx / samplingRate;
                  const x = u.valToPos(time, 'x', true);

                  ctx.beginPath();
                  ctx.moveTo(x, top);
                  ctx.lineTo(x, top + height);
                  ctx.stroke();
                });

                ctx.restore();
              },
            ],
          },
        },
      ],
      scales: {
        x: {
          time: false,
        },
        y: {
          auto: false,
          range: [stats.min, stats.max],
        },
      },
      axes: [
        {
          label: 'Time (s)',
          labelSize: 30,
          labelFont: '14px Arial',
          labelGap: 0,
          font: '12px Arial',
          size: 60,
          stroke: '#ffffff',
          grid: {
            stroke: '#333333',
            width: 1,
          },
          ticks: {
            stroke: '#ffffff',
            width: 1,
          },
        },
        {
          label: 'Voltage',
          labelSize: 50,
          labelFont: '14px Arial',
          labelGap: 0,
          font: '12px Arial',
          size: 70,
          stroke: '#ffffff',
          grid: {
            stroke: '#333333',
            width: 1,
          },
          ticks: {
            stroke: '#ffffff',
            width: 1,
          },
        },
      ],
      series: [
        {},
        {
          label: 'Waveform',
          stroke: '#00ff00',
          width: 1,
        },
      ],
      cursor: {
        drag: {
          x: true,
          y: false,
        },
      },
      hooks: {
        setSelect: [
          (u) => {
            // Handle zoom
            const select = u.select;
            if (select) {
              const minX = u.posToVal(select.left, 'x');
              const maxX = u.posToVal(select.left + select.width, 'x');
              u.setScale('x', { min: minX, max: maxX });
            }
          },
        ],
      },
    };

    // Create plot
    const plot = new uPlot(opts, plotData, plotContainerRef.current);
    plotInstanceRef.current = plot;

    // Handle window resize
    const handleResize = () => {
      if (plotContainerRef.current && plotInstanceRef.current) {
        plotInstanceRef.current.setSize({
          width: plotContainerRef.current.clientWidth,
          height: 500,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      plot.destroy();
      plotInstanceRef.current = null;
    };
  }, [viewState.data, viewState.stats, threshold, spikeState.spikes, metadata.sampling_rate]);

  /**
   * Run spike detection when threshold changes
   */
  useEffect(() => {
    if (!viewState.data || !workerRef.current) {
      return;
    }

    let cancelled = false;

    const detectSpikes = async () => {
      try {
        setSpikeState(prev => ({ ...prev, detecting: true }));

        const result: SpikeDetectionResult = await workerRef.current!.detectSpikes(
          viewState.data!,
          threshold,
          { refractoryPeriod: 30, edgeType: 'rising' },
          metadata.sampling_rate
        );

        if (!cancelled) {
          setSpikeState({
            spikes: result.spikes,
            stats: result.stats,
            computeTime: result.duration,
            detecting: false,
          });
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Spike detection failed:', error);
          setSpikeState(prev => ({ ...prev, detecting: false }));
        }
      }
    };

    detectSpikes();

    return () => {
      cancelled = true;
    };
  }, [threshold, viewState.data, metadata.sampling_rate]);

  /**
   * Handle threshold drag
   */
  const handleThresholdChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setThreshold(parseFloat(event.target.value));
  }, []);

  /**
   * Reset zoom
   */
  const handleResetZoom = useCallback(() => {
    if (plotInstanceRef.current && viewState.stats) {
      plotInstanceRef.current.setScale('x', { min: 0, max: metadata.length / metadata.sampling_rate });
      plotInstanceRef.current.setScale('y', { min: viewState.stats.min, max: viewState.stats.max });
    }
  }, [metadata, viewState.stats]);

  // Render loading state
  if (viewState.loading) {
    return (
      <div style={{ padding: '20px', color: '#fff', textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ fontSize: '18px', marginBottom: '10px' }}>Loading waveform data...</div>
        <div style={{ fontSize: '14px', opacity: 0.7 }}>
          {metadata.length.toLocaleString()} samples at {metadata.sampling_rate.toLocaleString()} Hz
        </div>
      </div>
    );
  }

  // Render error state
  if (viewState.error) {
    return (
      <div style={{ padding: '20px', color: '#ff4444', textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ fontSize: '18px', marginBottom: '10px' }}>❌ Error loading waveform</div>
        <div style={{ fontSize: '14px' }}>{viewState.error}</div>
      </div>
    );
  }

  // Render viewer
  return (
    <div style={{ width: '100%', fontFamily: 'Arial, sans-serif' }}>
      {/* Plot container */}
      <div
        ref={plotContainerRef}
        style={{
          width: '100%',
          marginBottom: '20px',
          border: '1px solid #444',
          borderRadius: '4px',
          backgroundColor: '#1a1a1a',
        }}
      />

      {/* Controls */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px',
          marginBottom: '20px',
        }}
      >
        {/* Threshold control */}
        <div
          style={{
            backgroundColor: '#2a2a2a',
            padding: '15px',
            borderRadius: '4px',
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px', color: '#fff' }}>
            Threshold Control
          </div>
          <input
            type="range"
            min={viewState.stats?.min || 0}
            max={viewState.stats?.max || 100}
            step="0.01"
            value={threshold}
            onChange={handleThresholdChange}
            style={{ width: '100%' }}
          />
          <div style={{ fontSize: '12px', color: '#fff', marginTop: '5px', opacity: 0.7 }}>
            Value: {threshold.toFixed(2)} | Range: {viewState.stats?.min.toFixed(2)} to {viewState.stats?.max.toFixed(2)}
          </div>
        </div>

        {/* Spike statistics */}
        <div
          style={{
            backgroundColor: '#2a2a2a',
            padding: '15px',
            borderRadius: '4px',
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px', color: '#fff' }}>
            Spike Detection {spikeState.detecting && '(Computing...)'}
          </div>
          <div style={{ fontSize: '12px', color: '#fff', opacity: 0.9 }}>
            Spikes: {spikeState.stats?.count || 0} detected
          </div>
          {spikeState.stats && spikeState.stats.rate !== null && (
            <div style={{ fontSize: '12px', color: '#fff', opacity: 0.9 }}>
              Rate: {spikeState.stats.rate.toFixed(2)} Hz
            </div>
          )}
          <div style={{ fontSize: '12px', color: '#fff', opacity: 0.9 }}>
            Compute time: {spikeState.computeTime.toFixed(2)} ms
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
        <button
          onClick={handleResetZoom}
          style={{
            padding: '8px 16px',
            backgroundColor: '#444',
            border: 'none',
            borderRadius: '4px',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
          }}
        >
          Reset Zoom
        </button>
        <div style={{ fontSize: '12px', color: '#fff', padding: '8px', opacity: 0.7 }}>
          Drag to zoom | Scroll to pan
        </div>
      </div>

      {/* Spike Gallery */}
      {viewState.data && spikeState.spikes.length > 0 && (
        <div>
          <h2 style={{ fontSize: '20px', marginBottom: '15px', color: '#fff' }}>Spike Waveforms</h2>
          <p style={{ color: '#fff', marginBottom: '20px', fontSize: '14px', opacity: 0.7 }}>
            Extracted windows around detected events (-700μs to +1000μs). All spikes overlaid to reveal average shape.
          </p>
          <SpikeGallery
            rawData={viewState.data}
            spikeIndices={spikeState.spikes}
            samplingRate={metadata.sampling_rate}
            threshold={threshold}
          />
        </div>
      )}
    </div>
  );
}
