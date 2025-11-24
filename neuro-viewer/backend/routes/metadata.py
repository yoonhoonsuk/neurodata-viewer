from fastapi import APIRouter, HTTPException
from services.waveform_loader import waveform_loader

router = APIRouter()

@router.get("/metadata/{file_id}")
async def get_metadata(file_id: str):
    """
    Get metadata for an uploaded waveform
    """
    metadata = waveform_loader.get_metadata(file_id)

    if metadata is None:
        raise HTTPException(status_code=404, detail="File not found")

    return metadata
