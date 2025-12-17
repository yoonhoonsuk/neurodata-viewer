from fastapi import APIRouter, File, UploadFile, HTTPException
from services.minio_client import minio_client
from services.waveform_loader import waveform_loader
import io
import uuid

router = APIRouter()

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        print(f"Received file: {file.filename}, content_type: {file.content_type}")

        if not file.filename.endswith('.pkl'):
            print(f"File validation failed: {file.filename}")
            raise HTTPException(status_code=400, detail="Only .pkl files are supported")

        content = await file.read()
        print(f"Read {len(content)} bytes")

        file_id = str(uuid.uuid4())
        file_name = f"{file_id}.pkl"

        # Try to upload to MinIO, but continue even if it fails (for local development)
        try:
            success = minio_client.upload_file(
                file_name,
                io.BytesIO(content),
                len(content)
            )
            if success:
                print(f"MinIO upload successful: {file_name}")
            else:
                print("MinIO upload failed, continuing without MinIO (local mode)")
        except Exception as e:
            print(f"MinIO not available ({e}), continuing without MinIO (local mode)")

        metadata = waveform_loader.load_from_pickle(file_id, content)
        print(f"Metadata extracted: {metadata}")

        return {
            "file_id": file_id,
            "metadata": metadata
        }

    except HTTPException:
        raise
    except ValueError as e:
        print(f"ValueError: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Exception: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
