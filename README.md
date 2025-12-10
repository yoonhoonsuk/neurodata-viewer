# Neuro Waveform Viewer

Interactive neuroscience waveform visualization with real-time playback and spike detection.

## Quick Start

```bash
cd neuro-viewer
docker-compose up --build
# Open http://localhost:3000
```

## Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Backend**: FastAPI, Python, NumPy
- **Storage**: MinIO (S3-compatible)

## Features

- Upload `.pkl` numpy array files
- Real-time playback
- Interactive threshold-based spike detection

## Architecture

```
Browser ←→ Next.js Proxy ←→ FastAPI Backend ←→ MinIO Storage
```

**Project Structure:**
```
neuro-viewer/
├── backend/
│   ├── main.py
│   ├── routes/          # API endpoints
│   └── services/        # Storage & processing
├── frontend/
│   └── app/
│       ├── page.tsx
│       ├── components/WaveformViewer.tsx
│       └── api/[...path]/route.ts  # Catch-all proxy
└── docker-compose.yml
```

## API

| Endpoint | Description |
|----------|-------------|
| `POST /api/upload` | Upload .pkl file |
| `GET /api/chunk/{file_id}?start&duration` | Get waveform data |

All frontend `/api/*` calls proxy through Next.js to the backend.

## Development

**Local setup (without Docker):**

```bash
# Backend
cd backend && pip install -r requirements.txt
export MINIO_ENDPOINT=localhost:9000 MINIO_ACCESS_KEY=minioadmin MINIO_SECRET_KEY=minioadmin
uvicorn main:app --reload --port 8000

# Frontend
cd frontend && npm install
echo "BACKEND_URL=http://localhost:8000" > .env.local
npm run dev

# MinIO
docker run -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"
```

**Common commands:**
```bash
docker-compose logs -f              # View logs
docker-compose restart backend      # Restart service
docker-compose down -v              # Stop and clear data
```

## License

MIT
