from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import upload, metadata, chunk, playback

app = FastAPI(title="Neuro Waveform Viewer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(metadata.router, prefix="/api", tags=["metadata"])
app.include_router(chunk.router, prefix="/api", tags=["chunk"])
app.include_router(playback.router, prefix="/ws", tags=["websocket"])

@app.get("/")
async def root():
    return {"message": "Neuro Waveform Viewer API"}

@app.get("/health")
async def health():
    return {"status": "healthy"}
