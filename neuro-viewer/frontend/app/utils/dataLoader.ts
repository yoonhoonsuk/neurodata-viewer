/**
 * Binary Data Loader Utilities
 *
 * Provides efficient loading of neural waveform data from the backend.
 * Supports full file downloads and Range requests for partial data fetching.
 */

export interface WaveformMetadata {
  length: number;
  sampling_rate: number;
  min: number;
  max: number;
}

export interface DataHeaders {
  sampleRate: number;
  totalSamples: number;
  dataType: string;
  contentLength: number;
}

/**
 * Fetch complete waveform data as Float32Array
 *
 * @param fileId - Unique identifier for the uploaded file
 * @returns Float32Array containing the voltage data
 * @throws Error if fetch fails or data is invalid
 */
export async function fetchWaveformData(fileId: string): Promise<Float32Array> {
  const response = await fetch(`/api/data/${fileId}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/octet-stream'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch waveform: ${response.status} ${response.statusText}`);
  }

  // Read binary data
  const arrayBuffer = await response.arrayBuffer();

  // Convert to Float32Array (data is stored as float32 on backend)
  return new Float32Array(arrayBuffer);
}

/**
 * Fetch a specific range of waveform data using HTTP Range requests
 *
 * @param fileId - Unique identifier for the uploaded file
 * @param startSample - Starting sample index (inclusive)
 * @param endSample - Ending sample index (exclusive)
 * @returns Float32Array containing the requested sample range
 * @throws Error if Range request fails or indices are invalid
 */
export async function fetchWaveformRange(
  fileId: string,
  startSample: number,
  endSample: number
): Promise<Float32Array> {
  // Each float32 is 4 bytes
  const bytesPerSample = 4;
  const startByte = startSample * bytesPerSample;
  const endByte = (endSample * bytesPerSample) - 1; // Range header is inclusive

  const response = await fetch(`/api/data/${fileId}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/octet-stream',
      'Range': `bytes=${startByte}-${endByte}`
    }
  });

  if (!response.ok && response.status !== 206) {
    throw new Error(
      `Failed to fetch range: ${response.status} ${response.statusText}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return new Float32Array(arrayBuffer);
}

/**
 * Parse metadata headers from response
 *
 * @param response - Fetch Response object
 * @returns Parsed metadata from custom headers
 */
export function parseDataHeaders(response: Response): DataHeaders {
  return {
    sampleRate: parseInt(response.headers.get('X-Sample-Rate') || '30000'),
    totalSamples: parseInt(response.headers.get('X-Total-Samples') || '0'),
    dataType: response.headers.get('X-Data-Type') || 'float32',
    contentLength: parseInt(response.headers.get('Content-Length') || '0')
  };
}

/**
 * Calculate optimal chunk size for progressive loading
 *
 * Based on viewport width and desired pixel density
 *
 * @param viewportWidth - Width of display area in pixels
 * @param pixelsPerSample - Desired horizontal resolution (default: 1 pixel per sample)
 * @returns Optimal number of samples per chunk
 */
export function calculateChunkSize(
  viewportWidth: number,
  pixelsPerSample: number = 1
): number {
  // Load enough samples to fill viewport width at desired resolution
  const samplesForViewport = Math.ceil(viewportWidth / pixelsPerSample);

  // Add 50% buffer for smooth scrolling
  const bufferedSamples = Math.floor(samplesForViewport * 1.5);

  // Round to nearest power of 2 for efficient memory alignment
  return Math.pow(2, Math.ceil(Math.log2(bufferedSamples)));
}

/**
 * Decimation: Downsample data for visualization
 *
 * Uses min-max decimation to preserve signal envelope while reducing point count
 *
 * @param data - Original Float32Array
 * @param targetPoints - Desired number of output points
 * @returns Downsampled Float32Array
 */
export function decimateData(data: Float32Array, targetPoints: number): Float32Array {
  if (data.length <= targetPoints) {
    return data; // No decimation needed
  }

  const blockSize = Math.floor(data.length / targetPoints);
  const decimated = new Float32Array(targetPoints * 2); // min-max pairs

  for (let i = 0; i < targetPoints; i++) {
    const startIdx = i * blockSize;
    const endIdx = Math.min(startIdx + blockSize, data.length);

    let min = data[startIdx];
    let max = data[startIdx];

    for (let j = startIdx + 1; j < endIdx; j++) {
      if (data[j] < min) min = data[j];
      if (data[j] > max) max = data[j];
    }

    decimated[i * 2] = min;
    decimated[i * 2 + 1] = max;
  }

  return decimated;
}

/**
 * Validate Float32Array data integrity
 *
 * @param data - Float32Array to validate
 * @throws Error if data contains invalid values
 */
export function validateWaveformData(data: Float32Array): void {
  if (data.length === 0) {
    throw new Error('Waveform data is empty');
  }

  // Check for NaN or Infinity values
  for (let i = 0; i < data.length; i++) {
    if (!isFinite(data[i])) {
      throw new Error(`Invalid value at index ${i}: ${data[i]}`);
    }
  }
}

/**
 * Calculate data statistics
 *
 * @param data - Float32Array to analyze
 * @returns Statistics object
 */
export interface DataStats {
  min: number;
  max: number;
  mean: number;
  stdDev: number;
}

export function calculateStats(data: Float32Array): DataStats {
  let min = data[0];
  let max = data[0];
  let sum = 0;

  for (let i = 0; i < data.length; i++) {
    const value = data[i];
    if (value < min) min = value;
    if (value > max) max = value;
    sum += value;
  }

  const mean = sum / data.length;

  // Calculate standard deviation
  let sumSquaredDiff = 0;
  for (let i = 0; i < data.length; i++) {
    const diff = data[i] - mean;
    sumSquaredDiff += diff * diff;
  }

  const stdDev = Math.sqrt(sumSquaredDiff / data.length);

  return { min, max, mean, stdDev };
}
