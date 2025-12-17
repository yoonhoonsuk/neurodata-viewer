from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from services.waveform_loader import waveform_loader
import numpy as np

router = APIRouter()

@router.get("/data/{file_id}")
async def get_binary_data(file_id: str, request: Request):
    """
    Get the entire waveform as raw binary data (float32).
    Supports HTTP Range requests for efficient partial downloads.

    Returns:
        application/octet-stream: Raw float32 binary data
    """
    if file_id not in waveform_loader.waveforms:
        raise HTTPException(status_code=404, detail="File not found")

    waveform = waveform_loader.waveforms[file_id]
    metadata = waveform_loader.metadata[file_id]

    # Convert to float32 for consistency and smaller file size
    waveform_float32 = waveform.astype(np.float32)
    full_data = waveform_float32.tobytes()
    total_bytes = len(full_data)

    # Check for Range request header
    range_header = request.headers.get("Range")

    if range_header:
        # Parse Range header: "bytes=start-end"
        try:
            range_str = range_header.replace("bytes=", "")
            start_str, end_str = range_str.split("-")

            start = int(start_str) if start_str else 0
            end = int(end_str) if end_str else total_bytes - 1

            # Validate range
            if start < 0 or start >= total_bytes:
                raise HTTPException(status_code=416, detail="Range not satisfiable")

            end = min(end, total_bytes - 1)
            chunk_data = full_data[start:end + 1]
            content_length = len(chunk_data)

            # Return 206 Partial Content
            headers = {
                "Content-Type": "application/octet-stream",
                "Content-Length": str(content_length),
                "Content-Range": f"bytes {start}-{end}/{total_bytes}",
                "Accept-Ranges": "bytes",
                "X-Sample-Rate": str(metadata["sampling_rate"]),
                "X-Total-Samples": str(metadata["length"]),
                "X-Data-Type": "float32"
            }

            return Response(
                content=chunk_data,
                status_code=206,
                headers=headers,
                media_type="application/octet-stream"
            )

        except (ValueError, IndexError) as e:
            raise HTTPException(status_code=400, detail=f"Invalid Range header: {str(e)}")

    # Return full file if no Range header
    headers = {
        "Content-Type": "application/octet-stream",
        "Content-Length": str(total_bytes),
        "Accept-Ranges": "bytes",
        "X-Sample-Rate": str(metadata["sampling_rate"]),
        "X-Total-Samples": str(metadata["length"]),
        "X-Data-Type": "float32"
    }

    return Response(
        content=full_data,
        status_code=200,
        headers=headers,
        media_type="application/octet-stream"
    )
