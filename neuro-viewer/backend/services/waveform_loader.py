import numpy as np
import pickle
from typing import Dict, Optional, List
from .minio_client import minio_client

class WaveformLoader:
    def __init__(self):
        # In-memory cache for MVP
        self.waveforms: Dict[str, np.ndarray] = {}
        self.metadata: Dict[str, Dict] = {}

    def load_from_pickle(self, file_id: str, pickle_data: bytes) -> Dict:
        try:
            data = pickle.loads(pickle_data)

            waveform = None

            if isinstance(data, np.ndarray):
                waveform = data
            else:
                raise ValueError(
                    f"Pickle file must contain a numpy array."
                )
            # elif isinstance(data, dict):
            #     for key in ['data', 'waveform', 'signal', 'array', 'ephys', 'recording']:
            #         if key in data and isinstance(data[key], np.ndarray):
            #             waveform = data[key]
            #             break
            #     if waveform is None:
            #         for value in data.values():
            #             if isinstance(value, np.ndarray):
            #                 waveform = value
            #                 break
            # elif isinstance(data, (list, tuple)) and len(data) > 0:
            #     if isinstance(data[0], np.ndarray):
            #         waveform = data[0]

            if waveform is None:
                if isinstance(data, dict):
                    keys = list(data.keys())
                    types = {k: type(v).__name__ for k, v in data.items()}
                    raise ValueError(
                        f"Pickle file contains a dict but no numpy array found. "
                        f"Keys: {keys}, Types: {types}. "
                        f"Please use keys like 'data', 'waveform', or 'signal' for the array."
                    )
                else:
                    raise ValueError(
                        f"Pickle file must contain a numpy array. Found: {type(data).__name__}. "
                        f"If it's a dict, use keys like 'data', 'waveform', or 'signal'."
                    )

            if waveform.ndim != 1:
                waveform = waveform.flatten()

            self.waveforms[file_id] = waveform
            metadata = {
                "length": int(len(waveform)),
                "sampling_rate": 30000,  # Default 30kHz for neuroscience data
                "min": float(np.min(waveform)),
                "max": float(np.max(waveform))
            }

            self.metadata[file_id] = metadata
            return metadata

        except Exception as e:
            raise ValueError(f"Failed to load pickle file: {str(e)}")

    def get_metadata(self, file_id: str) -> Optional[Dict]:
        return self.metadata.get(file_id)

    def get_chunk(self, file_id: str, start: int, duration: int) -> Optional[np.ndarray]:
        if file_id not in self.waveforms:
            return None

        waveform = self.waveforms[file_id]
        end = min(start + duration, len(waveform))

        return waveform[start:end]

    def get_spikes(self, file_id: str, threshold: float, start: int = 0, end: int = None) -> List[int]:
        if file_id not in self.waveforms:
            return []

        waveform = self.waveforms[file_id]

        if end is None:
            end = len(waveform)

        chunk = waveform[start:end]
        crossings = np.where(chunk > threshold)[0]
        if len(crossings) > 0:
            spikes = [crossings[0]]
            for i in range(1, len(crossings)):
                if crossings[i] - crossings[i-1] > 1:
                    spikes.append(crossings[i])

            spikes = [int(start + s) for s in spikes]
            return spikes

        return []

waveform_loader = WaveformLoader()
