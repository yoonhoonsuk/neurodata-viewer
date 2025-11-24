from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.waveform_loader import waveform_loader
import asyncio
import json
import numpy as np

router = APIRouter()

@router.websocket("/playback/{file_id}")
async def playback_websocket(websocket: WebSocket, file_id: str):
    """
    WebSocket endpoint for real-time waveform playback
    Streams small chunks at 30-60 FPS
    """
    await websocket.accept()

    try:
        # Get metadata
        metadata = waveform_loader.get_metadata(file_id)
        if metadata is None:
            await websocket.send_json({"error": "File not found"})
            await websocket.close()
            return

        # Send initial metadata
        await websocket.send_json({
            "type": "metadata",
            "metadata": metadata
        })

        # Playback parameters
        sampling_rate = metadata["sampling_rate"]
        chunk_size = 256  # samples per message
        fps = 60
        interval = 1.0 / fps  # seconds between messages

        position = 0
        total_length = metadata["length"]
        playing = False

        # Main loop
        while True:
            # Check for client messages (play/pause/seek commands)
            try:
                message = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=0.001
                )

                data = json.loads(message)

                if data.get("command") == "play":
                    playing = True
                    position = data.get("position", position)
                elif data.get("command") == "pause":
                    playing = False
                elif data.get("command") == "seek":
                    position = data.get("position", 0)

            except asyncio.TimeoutError:
                pass

            # Stream data if playing
            if playing and position < total_length:
                chunk = waveform_loader.get_chunk(file_id, position, chunk_size)

                if chunk is not None:
                    # Convert to list for JSON serialization
                    samples_list = chunk.tolist()

                    await websocket.send_json({
                        "type": "chunk",
                        "samples": samples_list,
                        "position": position,
                        "timestamp": position / sampling_rate
                    })

                    position += chunk_size

                # Sleep to maintain frame rate
                await asyncio.sleep(interval)
            else:
                # Not playing, just wait a bit
                await asyncio.sleep(0.1)

    except WebSocketDisconnect:
        print(f"Client disconnected from playback: {file_id}")
    except Exception as e:
        print(f"WebSocket error: {e}")
        await websocket.close()
