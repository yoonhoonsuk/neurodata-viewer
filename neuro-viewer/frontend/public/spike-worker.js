/**
 * Spike Detection Web Worker
 *
 * Performs threshold-based spike detection in a background thread
 * to prevent blocking the UI during computation.
 *
 * Message Protocol:
 * - Input: { type: 'detect', data: Float32Array, threshold: number, config?: SpikeConfig }
 * - Output: { type: 'result', spikes: number[], duration: number }
 * - Error: { type: 'error', message: string }
 */

/**
 * @typedef {Object} SpikeConfig
 * @property {number} [refractoryPeriod=30] - Minimum samples between spikes (prevents duplicate detections)
 * @property {'rising'|'falling'|'both'} [edgeType='rising'] - Edge detection mode
 */

/**
 * Detects spikes using threshold crossing algorithm
 *
 * @param {Float32Array} data - Voltage waveform data
 * @param {number} threshold - Threshold value for spike detection
 * @param {SpikeConfig} config - Detection configuration
 * @returns {number[]} - Array of spike indices
 */
function detectSpikes(data, threshold, config = {}) {
  const {
    refractoryPeriod = 30,
    edgeType = 'rising'
  } = config;

  const spikes = [];
  let lastSpikeIndex = -refractoryPeriod;

  for (let i = 1; i < data.length; i++) {
    const current = data[i];
    const previous = data[i - 1];

    // Check if we're in refractory period
    if (i - lastSpikeIndex < refractoryPeriod) {
      continue;
    }

    let detected = false;

    switch (edgeType) {
      case 'rising':
        // Rising edge: crosses from below to above threshold
        detected = previous < threshold && current >= threshold;
        break;

      case 'falling':
        // Falling edge: crosses from above to below threshold
        detected = previous >= threshold && current < threshold;
        break;

      case 'both':
        // Either direction crossing
        detected = (previous < threshold && current >= threshold) ||
                   (previous >= threshold && current < threshold);
        break;
    }

    if (detected) {
      spikes.push(i);
      lastSpikeIndex = i;
    }
  }

  return spikes;
}

/**
 * Calculate spike rate in Hz
 *
 * @param {number} spikeCount - Total number of spikes
 * @param {number} totalSamples - Total samples in recording
 * @param {number} samplingRate - Sampling rate in Hz
 * @returns {number} - Spike rate in Hz
 */
function calculateSpikeRate(spikeCount, totalSamples, samplingRate) {
  const durationSeconds = totalSamples / samplingRate;
  return spikeCount / durationSeconds;
}

/**
 * Calculate inter-spike intervals (ISIs)
 *
 * @param {number[]} spikes - Array of spike indices
 * @param {number} samplingRate - Sampling rate in Hz
 * @returns {number[]} - ISIs in milliseconds
 */
function calculateISIs(spikes, samplingRate) {
  const isis = [];

  for (let i = 1; i < spikes.length; i++) {
    const interval = (spikes[i] - spikes[i - 1]) / samplingRate * 1000; // Convert to ms
    isis.push(interval);
  }

  return isis;
}

// Worker message handler
self.onmessage = function(e) {
  const { type, data, threshold, config, samplingRate } = e.data;

  try {
    if (type === 'detect') {
      // Validate inputs
      if (!(data instanceof Float32Array)) {
        throw new Error('Data must be a Float32Array');
      }

      if (typeof threshold !== 'number' || isNaN(threshold)) {
        throw new Error('Threshold must be a valid number');
      }

      // Perform spike detection
      const startTime = performance.now();
      const spikes = detectSpikes(data, threshold, config || {});
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Calculate statistics
      const stats = {
        count: spikes.length,
        rate: samplingRate ? calculateSpikeRate(spikes.length, data.length, samplingRate) : null,
        isis: samplingRate && spikes.length > 1 ? calculateISIs(spikes, samplingRate) : []
      };

      // Send results back to main thread
      self.postMessage({
        type: 'result',
        spikes,
        stats,
        duration,
        timestamp: Date.now()
      });

    } else if (type === 'ping') {
      // Health check
      self.postMessage({
        type: 'pong',
        timestamp: Date.now()
      });

    } else {
      throw new Error(`Unknown message type: ${type}`);
    }

  } catch (error) {
    // Send error back to main thread
    self.postMessage({
      type: 'error',
      message: error.message,
      stack: error.stack,
      timestamp: Date.now()
    });
  }
};

// Worker initialization
self.postMessage({
  type: 'ready',
  timestamp: Date.now()
});
