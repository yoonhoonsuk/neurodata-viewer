/**
 * Spike Detection Worker Wrapper
 *
 * Type-safe interface for the spike detection Web Worker.
 * Provides Promise-based API for async spike detection.
 */

export interface SpikeConfig {
  /** Minimum samples between spikes to prevent duplicate detections */
  refractoryPeriod?: number;
  /** Edge detection mode: 'rising', 'falling', or 'both' */
  edgeType?: 'rising' | 'falling' | 'both';
}

export interface SpikeStats {
  /** Total number of spikes detected */
  count: number;
  /** Spike rate in Hz (if sampling rate provided) */
  rate: number | null;
  /** Inter-spike intervals in milliseconds */
  isis: number[];
}

export interface SpikeDetectionResult {
  /** Array of sample indices where spikes were detected */
  spikes: number[];
  /** Detection statistics */
  stats: SpikeStats;
  /** Computation time in milliseconds */
  duration: number;
  /** Timestamp when computation completed */
  timestamp: number;
}

interface WorkerMessage {
  type: string;
  [key: string]: any;
}

/**
 * SpikeWorker class
 *
 * Manages a Web Worker instance for background spike detection.
 * Provides a clean Promise-based API with automatic cleanup.
 */
export class SpikeWorker {
  private worker: Worker | null = null;
  private messageId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  /** Default timeout for spike detection (10 seconds) */
  private readonly DEFAULT_TIMEOUT = 10000;

  /**
   * Initialize the Web Worker
   *
   * @throws Error if Worker creation fails
   */
  initialize(): void {
    if (this.worker) {
      return; // Already initialized
    }

    try {
      this.worker = new Worker('/spike-worker.js');
      this.worker.onmessage = this.handleMessage.bind(this);
      this.worker.onerror = this.handleError.bind(this);
    } catch (error) {
      throw new Error(`Failed to initialize spike worker: ${error}`);
    }
  }

  /**
   * Handle messages from the Web Worker
   */
  private handleMessage(event: MessageEvent<WorkerMessage>): void {
    const { type, ...data } = event.data;

    switch (type) {
      case 'ready':
        console.log('[SpikeWorker] Worker initialized and ready');
        break;

      case 'result':
        this.resolveRequest(data);
        break;

      case 'error':
        this.rejectRequest(new Error(data.message));
        break;

      case 'pong':
        // Health check response
        console.log('[SpikeWorker] Health check OK');
        break;

      default:
        console.warn(`[SpikeWorker] Unknown message type: ${type}`);
    }
  }

  /**
   * Handle Worker errors
   */
  private handleError(error: ErrorEvent): void {
    console.error('[SpikeWorker] Worker error:', error);
    this.rejectRequest(new Error(error.message));
  }

  /**
   * Resolve pending request
   */
  private resolveRequest(data: any): void {
    // Get the most recent pending request (FIFO)
    const [id, request] = Array.from(this.pendingRequests.entries())[0] || [];

    if (id !== undefined && request) {
      clearTimeout(request.timeout);
      request.resolve(data);
      this.pendingRequests.delete(id);
    }
  }

  /**
   * Reject pending request
   */
  private rejectRequest(error: Error): void {
    // Reject the most recent pending request
    const [id, request] = Array.from(this.pendingRequests.entries())[0] || [];

    if (id !== undefined && request) {
      clearTimeout(request.timeout);
      request.reject(error);
      this.pendingRequests.delete(id);
    }
  }

  /**
   * Detect spikes in waveform data
   *
   * @param data - Float32Array of voltage samples
   * @param threshold - Threshold value for detection
   * @param config - Optional detection configuration
   * @param samplingRate - Sampling rate in Hz (for statistics)
   * @param timeout - Request timeout in milliseconds
   * @returns Promise resolving to spike detection results
   * @throws Error if worker not initialized or detection fails
   */
  async detectSpikes(
    data: Float32Array,
    threshold: number,
    config?: SpikeConfig,
    samplingRate?: number,
    timeout: number = this.DEFAULT_TIMEOUT
  ): Promise<SpikeDetectionResult> {
    if (!this.worker) {
      throw new Error('Worker not initialized. Call initialize() first.');
    }

    return new Promise((resolve, reject) => {
      const id = this.messageId++;

      // Set timeout
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Spike detection timeout after ${timeout}ms`));
      }, timeout);

      // Store request
      this.pendingRequests.set(id, { resolve, reject, timeout: timeoutHandle });

      // Send message to worker
      this.worker!.postMessage({
        type: 'detect',
        data,
        threshold,
        config: config || {},
        samplingRate
      });
    });
  }

  /**
   * Health check - verify worker is responsive
   *
   * @returns Promise resolving to true if worker responds
   */
  async ping(): Promise<boolean> {
    if (!this.worker) {
      return false;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 1000);

      const handler = (event: MessageEvent) => {
        if (event.data.type === 'pong') {
          clearTimeout(timeout);
          this.worker!.removeEventListener('message', handler);
          resolve(true);
        }
      };

      this.worker!.addEventListener('message', handler);
      this.worker!.postMessage({ type: 'ping' });
    });
  }

  /**
   * Terminate the Web Worker and clean up resources
   */
  terminate(): void {
    if (this.worker) {
      // Reject all pending requests
      this.pendingRequests.forEach(({ reject, timeout }) => {
        clearTimeout(timeout);
        reject(new Error('Worker terminated'));
      });

      this.pendingRequests.clear();
      this.worker.terminate();
      this.worker = null;

      console.log('[SpikeWorker] Worker terminated');
    }
  }

  /**
   * Get number of pending detection requests
   */
  get pendingCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Check if worker is initialized
   */
  get isInitialized(): boolean {
    return this.worker !== null;
  }
}

/**
 * Create and initialize a new SpikeWorker instance
 *
 * @returns Initialized SpikeWorker
 * @throws Error if initialization fails
 */
export function createSpikeWorker(): SpikeWorker {
  const worker = new SpikeWorker();
  worker.initialize();
  return worker;
}
