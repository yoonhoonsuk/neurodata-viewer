'use client';

import { useState } from 'react';
import WaveformViewer from './components/WaveformViewer';

export default function Home() {
  const [fileId, setFileId] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.pkl')) {
      setError('Please upload a .pkl file');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      setFileId(data.file_id);
      setMetadata(data.metadata);
    } catch (err) {
      setError('Failed to upload file. Please try again.');
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();

    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (!file.name.endsWith('.pkl')) {
      setError('Please upload a .pkl file');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      setFileId(data.file_id);
      setMetadata(data.metadata);
    } catch (err) {
      setError('Failed to upload file. Please try again.');
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ padding: '40px', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '32px', marginBottom: '10px' }}>Neuro Waveform Viewer</h1>
      <p style={{ color: '#888', marginBottom: '40px' }}>
        Upload a .pkl file containing a NumPy array to visualize neural waveforms
      </p>

      {!fileId ? (
        <div>
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            style={{
              border: '2px dashed #444',
              borderRadius: '8px',
              padding: '60px',
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: '#1a1a1a',
              marginBottom: '20px',
            }}
          >
            <input
              type="file"
              accept=".pkl"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              id="file-input"
            />
            <label htmlFor="file-input" style={{ cursor: 'pointer' }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>📁</div>
              <div style={{ fontSize: '18px', marginBottom: '10px' }}>
                {uploading ? 'Uploading...' : 'Drop your .pkl file here or click to browse'}
              </div>
              <div style={{ fontSize: '14px', color: '#666' }}>
                NumPy array pickle files only
              </div>
            </label>
          </div>

          {error && (
            <div
              style={{
                padding: '15px',
                backgroundColor: '#ff4444',
                color: '#fff',
                borderRadius: '4px',
                marginTop: '20px',
              }}
            >
              {error}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div
            style={{
              backgroundColor: '#2a2a2a',
              padding: '20px',
              borderRadius: '8px',
              marginBottom: '30px',
            }}
          >
            <h2 style={{ fontSize: '20px', marginBottom: '15px' }}>File Metadata</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>Length: {metadata.length.toLocaleString()} samples</div>
              <div>Sampling Rate: {metadata.sampling_rate.toLocaleString()} Hz</div>
              <div>Min: {metadata.min.toFixed(2)}</div>
              <div>Max: {metadata.max.toFixed(2)}</div>
              <div>Duration: {(metadata.length / metadata.sampling_rate).toFixed(2)} seconds</div>
            </div>
          </div>

          <h2 style={{ fontSize: '20px', marginBottom: '15px' }}>Waveform Playback</h2>
          <p style={{ color: '#888', marginBottom: '20px' }}>
            Click Play to start playback. Drag the red threshold line to detect spikes.
          </p>

          <WaveformViewer fileId={fileId} metadata={metadata} />

          <button
            onClick={() => {
              setFileId(null);
              setMetadata(null);
              setError(null);
            }}
            style={{
              marginTop: '30px',
              padding: '10px 20px',
              fontSize: '16px',
              cursor: 'pointer',
              backgroundColor: '#444',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
            }}
          >
            Upload New File
          </button>
        </div>
      )}
    </div>
  );
}
