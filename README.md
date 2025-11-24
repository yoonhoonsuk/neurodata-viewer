# Neuro Waveform Viewer

Interactive neuroscience waveform visualization with real-time playback and spike detection.

## Quick Start

```bash
# 1. Start services
cd neuro-viewer
docker-compose up --build

# 2. Open browser
open http://localhost:3000

```
## Technology Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Pixi.js 7
- **Backend**: FastAPI, Python 3.11, NumPy
- **Storage**: MinIO (S3-compatible)
- **Deploy**: Docker + Docker Compose

## Features

- Upload `.pkl` numpy array files
- Real-time 60 FPS playback with WebGL (Pixi.js)
- Interactive threshold line for spike detection
- WebSocket streaming from backend
- MinIO object storage

## Architecture

```
Browser (Pixi.js) ←→ Next.js API Routes ←→ FastAPI Backend ←→ MinIO Storage
      WebGL                  Proxy              WebSocket        S3-compatible
```

## Project Structure

```
neuro-viewer/
├── backend/                    # FastAPI
│   ├── main.py                # App entry point
│   ├── routes/                # API endpoints
│   │   ├── upload.py          # POST /api/upload
│   │   ├── metadata.py        # GET /api/metadata/{file_id}
│   │   ├── chunk.py           # GET /api/chunk/{file_id}, GET /api/spikes/{file_id}
│   │   └── playback.py        # WS /ws/playback/{file_id}
│   └── services/
│       ├── minio_client.py    # MinIO storage
│       └── waveform_loader.py # Waveform processing + spike detection
├── frontend/                  # Next.js + TypeScript
│   └── app/
│       ├── page.tsx          # Main UI
│       ├── components/
│       │   └── WaveformViewer.tsx  # Pixi.js renderer
│       └── api/              # Proxy routes to backend
└── docker-compose.yml        # 3 services: frontend, backend, minio
```

## How It Works

### Upload Flow
1. User drops `.pkl` file → Frontend → Next.js API route → FastAPI
2. FastAPI stores in MinIO + loads into memory
3. Extracts metadata (length, sampling_rate, min, max)
4. Returns file_id to frontend

### Playback Flow
1. Frontend opens WebSocket: `ws://localhost:8000/ws/playback/{file_id}`
2. Backend streams 256 samples every 16.67ms (60 FPS)
3. Frontend maintains sliding window of 10,000 samples
4. Pixi.js renders via WebGL

### Spike Detection
1. User drags red threshold line
2. Frontend calls `/api/spikes/{file_id}?threshold={value}`
3. Backend finds all samples > threshold
4. Removes consecutive crossings (keeps rising edge only)
5. Frontend draws yellow spike markers

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload .pkl file |
| GET | `/api/metadata/{file_id}` | Get metadata |
| GET | `/api/chunk/{file_id}?start&duration` | Get waveform chunk |
| GET | `/api/spikes/{file_id}?threshold` | Get spike timestamps |
| WS | `/ws/playback/{file_id}` | Real-time streaming |

**WebSocket Messages:**

Client → Server:
```json
{"command": "play", "position": 0}
{"command": "pause"}
{"command": "seek", "position": 5000}
```

Server → Client:
```json
{"type": "chunk", "samples": [1.2, 3.4, ...], "position": 0, "timestamp": 0.0}
```

## Development

### Run Locally (without Docker)

**Backend:**
```bash
cd backend
pip install -r requirements.txt
export MINIO_ENDPOINT=localhost:9000
export MINIO_ACCESS_KEY=minioadmin
export MINIO_SECRET_KEY=minioadmin
uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
echo "BACKEND_URL=http://localhost:8000" > .env.local
echo "NEXT_PUBLIC_WS_URL=ws://localhost:8000" >> .env.local
npm run dev
```

**MinIO:**
```bash
docker run -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"
```

### Useful Commands

```bash
# View logs
docker-compose logs -f

# Restart a service
docker-compose restart backend

# Stop everything
docker-compose down

# Stop and remove data
docker-compose down -v

# Test API
curl http://localhost:8000/health
curl -X POST http://localhost:8000/api/upload -F "file=@test_waveform.pkl"

# Access MinIO console
open http://localhost:9001  # user: minioadmin, pass: minioadmin
```

## Troubleshooting

**Services won't start:**
```bash
# Check ports
lsof -i :3000 :8000 :9000

# Restart Docker
docker-compose down && docker-compose up --build
```

**WebSocket connection failed:**
- Check `NEXT_PUBLIC_WS_URL=ws://localhost:8000` in `frontend/.env.local`
- Must be `ws://localhost:8000` not `ws://backend:8000`

**Upload fails:**
- Ensure file is `.pkl` format
- Check MinIO is running: `docker-compose ps`

## Test Data Generator

```python
# generate_test_data.py creates synthetic neural waveform
python3 generate_test_data.py

# Creates test_waveform.pkl with:
# - 1 second of data at 30kHz (30,000 samples)
# - Background noise
# - 5 simulated spike events
```

## License

MIT
