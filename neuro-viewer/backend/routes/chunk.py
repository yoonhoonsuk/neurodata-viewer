from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from services.waveform_loader import waveform_loader
import numpy as np

router = APIRouter()

@router.get("/chunk/{file_id}")
async def get_chunk(
    file_id: str,
    start: int = Query(..., description="Start sample index"),
    duration: int = Query(..., description="Number of samples to return")
):
    """
    Get a chunk of waveform data as raw binary (float32).
    More efficient than the old base64 approach.

    Returns:
        application/octet-stream: Raw float32 binary chunk
    """
    chunk = waveform_loader.get_chunk(file_id, start, duration)

    if chunk is None:
        raise HTTPException(status_code=404, detail="File not found")

    # Convert to float32 and return as binary
    chunk_float32 = chunk.astype(np.float32)
    chunk_bytes = chunk_float32.tobytes()

    metadata = waveform_loader.metadata.get(file_id, {})

    headers = {
        "Content-Type": "application/octet-stream",
        "X-Start-Sample": str(start),
        "X-Sample-Count": str(len(chunk)),
        "X-Sample-Rate": str(metadata.get("sampling_rate", 30000)),
        "X-Data-Type": "float32"
    }

    return Response(
        content=chunk_bytes,
        headers=headers,
        media_type="application/octet-stream"
    )

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
