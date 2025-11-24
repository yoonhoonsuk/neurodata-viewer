from fastapi import APIRouter, HTTPException, Query
from services.waveform_loader import waveform_loader
import base64
import numpy as np

router = APIRouter()

@router.get("/chunk/{file_id}")
async def get_chunk(
    file_id: str,
    start: int = Query(..., description="Start sample index"),
    duration: int = Query(..., description="Number of samples to return")
):
    """
    Get a chunk of waveform data
    Returns base64-encoded float32 array
    """
    chunk = waveform_loader.get_chunk(file_id, start, duration)

    if chunk is None:
        raise HTTPException(status_code=404, detail="File not found")

    # Convert to float32 and encode as base64
    chunk_float32 = chunk.astype(np.float32)
    chunk_bytes = chunk_float32.tobytes()
    chunk_b64 = base64.b64encode(chunk_bytes).decode('utf-8')

    return {
        "samples": chunk_b64,
        "start": start,
        "length": len(chunk),
        "encoding": "base64_float32"
    }

@router.get("/spikes/{file_id}")
async def get_spikes(
    file_id: str,
    threshold: float = Query(..., description="Threshold value"),
    start: int = Query(0, description="Start sample index"),
    end: int = Query(None, description="End sample index")
):
    """
    Get spike timestamps where waveform crosses threshold
    """
    spikes = waveform_loader.get_spikes(file_id, threshold, start, end)

    return {
        "spikes": spikes,
        "count": len(spikes)
    }
