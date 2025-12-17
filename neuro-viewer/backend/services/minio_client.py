from minio import Minio
from minio.error import S3Error
import io
from typing import BinaryIO
import os

class MinIOClient:
    def __init__(self):
        self._client = None
        self.bucket_name = "neuro-data"

    @property
    def client(self):
        """Lazy initialization of MinIO client"""
        if self._client is None:
            self._client = Minio(
                os.getenv("MINIO_ENDPOINT", "localhost:9000"),
                access_key=os.getenv("MINIO_ACCESS_KEY", "minioadmin"),
                secret_key=os.getenv("MINIO_SECRET_KEY", "minioadmin"),
                secure=False
            )
            self._ensure_bucket()
        return self._client

    def _ensure_bucket(self):
        try:
            if not self._client.bucket_exists(self.bucket_name):
                self._client.make_bucket(self.bucket_name)
        except S3Error as e:
            print(f"MinIO not available: {e}")

    def upload_file(self, file_name: str, data: BinaryIO, length: int):
        try:
            self.client.put_object(
                self.bucket_name,
                file_name,
                data,
                length
            )
            return True
        except S3Error as e:
            print(f"Error uploading file: {e}")
            return False

    def download_file(self, file_name: str) -> bytes:
        try:
            response = self.client.get_object(self.bucket_name, file_name)
            data = response.read()
            response.close()
            response.release_conn()
            return data
        except S3Error as e:
            print(f"Error downloading file: {e}")
            return None

    def file_exists(self, file_name: str) -> bool:
        try:
            self.client.stat_object(self.bucket_name, file_name)
            return True
        except S3Error:
            return False

minio_client = MinIOClient()
