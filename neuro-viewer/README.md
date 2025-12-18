### Prerequisites

- Python 3.11+
- Node.js 18+

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**


### Create Test Data

```python
import numpy as np
import pickle

# 1 second @ 30kHz
t = np.linspace(0, 1, 30000)
waveform = 50 * np.sin(2 * np.pi * 10 * t) + np.random.randn(30000) * 5

with open('test.pkl', 'wb') as f:
    pickle.dump(waveform, f)
```

## API

### Upload
```http
POST /api/upload
Content-Type: multipart/form-data

Returns: { "file_id": "uuid", "metadata": {...} }
```

### Binary Data
```http
GET /api/data/{file_id}
Accept: application/octet-stream

Returns: Raw float32 binary
Headers: X-Sample-Rate, X-Total-Samples, X-Data-Type
Supports: HTTP Range requests (206 Partial Content)
```

## Tech Stack

**Backend:** FastAPI, NumPy, MinIO (optional)
**Frontend:** Next.js, React, TypeScript, uPlot, Web Workers

## Project Structure

```
neuro-viewer/
├── backend/
│   ├── routes/
│   │   ├── upload.py          # File upload
│   │   ├── data.py            # Binary endpoint
│   │   ├── chunk.py           # Binary chunks
│   │   └── metadata.py        # File metadata
│   └── services/
│       ├── waveform_loader.py # NumPy processing
│       └── minio_client.py    # Storage (optional)
│
└── frontend/
    ├── app/
    │   ├── components/
    │   │   └── WaveformViewer.tsx  # uPlot viewer
    │   └── utils/
    │       ├── dataLoader.ts       # Binary fetch
    │       └── spikeWorker.ts      # Worker wrapper
    └── public/
        └── spike-worker.js         # Spike detection
```

## Development

### Build Frontend
```bash
npm run build
npm start
```

### Run Tests
```bash
# Backend
pytest

# Frontend
npm test
```

## Documentation

- **`ARCHITECTURE.md`** - Complete technical documentation
- **`IMPLEMENTATION_SUMMARY.md`** - Implementation details

## Features

- **Instant threshold updates** (<5ms via Web Worker)
- **Fast visualization** (millions of points @ 60 FPS with uPlot)
- **Efficient data transfer** (raw binary, 48% smaller than JSON)
- **Interactive analysis** (zoom, pan, threshold adjustment)
- **Real-time spike detection** (background computation, non-blocking UI)

## Architecture
Downloads waveform data once, performs all analysis client-side.

```
Upload .pkl → Binary download → In-memory processing → Web Worker detection → uPlot rendering
```

