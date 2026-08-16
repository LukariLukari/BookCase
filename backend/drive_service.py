import os
import io
import shutil
import uuid
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload, MediaIoBaseDownload
from fastapi.responses import StreamingResponse

class DriveService:
    def __init__(self):
        self.r2_access_key = os.getenv('R2_ACCESS_KEY_ID')
        self.r2_secret_key = os.getenv('R2_SECRET_ACCESS_KEY')
        self.r2_endpoint = os.getenv('R2_ENDPOINT_URL')
        self.r2_bucket = os.getenv('R2_BUCKET_NAME')
        self.use_r2 = bool(self.r2_access_key and self.r2_secret_key and self.r2_endpoint and self.r2_bucket)
        
        if self.use_r2:
            import boto3
            from botocore.config import Config
            self.s3 = boto3.client(
                's3',
                endpoint_url=self.r2_endpoint,
                aws_access_key_id=self.r2_access_key,
                aws_secret_access_key=self.r2_secret_key,
                config=Config(signature_version='s3v4')
            )
            print("INFO: Using Cloudflare R2 for Storage.")
            self.mock_mode = False
            self.use_gdrive = False
            return

        self.mock_mode = not os.path.exists('service-account.json')
        self.use_gdrive = not self.mock_mode

        if self.use_gdrive:
            SCOPES = ['https://www.googleapis.com/auth/drive']
            self.creds = service_account.Credentials.from_service_account_file('service-account.json', scopes=SCOPES)
            self.service = build('drive', 'v3', credentials=self.creds)
            self.folder_id = os.getenv('DRIVE_FOLDER_ID', 'YOUR_DRIVE_FOLDER_ID')
        else:
            print("WARNING: Running in LOCAL STORAGE MODE (service-account.json not found).")
            # Tạo thư mục uploads để chứa file
            self.upload_dir = os.path.join(os.path.dirname(__file__), 'uploads')
            os.makedirs(self.upload_dir, exist_ok=True)

    def upload_file(self, file_stream, filename, mime_type):
        if self.use_r2:
            file_id = f"{uuid.uuid4().hex}_{filename}"
            self.s3.upload_fileobj(
                file_stream,
                self.r2_bucket,
                file_id,
                ExtraArgs={'ContentType': mime_type}
            )
            return f"r2_{file_id}"

        if self.mock_mode:
            # Sinh ID ngẫu nhiên và lưu file vào thư mục local
            local_id = f"local_{uuid.uuid4().hex}"
            file_path = os.path.join(self.upload_dir, local_id)
            with open(file_path, "wb") as f:
                f.write(file_stream.read())
            return local_id

        file_metadata = {'name': filename, 'parents': [self.folder_id]}
        media = MediaIoBaseUpload(file_stream, mimetype=mime_type, resumable=True)
        file = self.service.files().create(body=file_metadata, media_body=media, fields='id').execute()
        return file.get('id')

    def stream_download(self, file_id, filename, mime_type):
        import urllib.parse
        encoded_filename = urllib.parse.quote(filename)
        headers = {
            "Content-Disposition": f"attachment; filename*=utf-8''{encoded_filename}"
        }
        
        if self.use_r2 and file_id.startswith("r2_"):
            real_id = file_id[3:]
            obj = self.s3.get_object(Bucket=self.r2_bucket, Key=real_id)
            
            def iterfile():
                stream = obj['Body']
                while chunk := stream.read(1024 * 1024):
                    yield chunk
            
            return StreamingResponse(iterfile(), media_type=mime_type, headers=headers)

        if self.mock_mode and file_id.startswith("local_"):
            # Lấy file từ thư mục local
            file_path = os.path.join(self.upload_dir, file_id)
            
            def iterfile():
                with open(file_path, "rb") as f:
                    while chunk := f.read(1024 * 1024): # Đọc chunk 1MB
                        yield chunk

            return StreamingResponse(iterfile(), media_type=mime_type, headers=headers)

        # Code gọi Drive API (khi có json credentials)
        request = self.service.files().get_media(fileId=file_id)
        def iterfile():
            fh = io.BytesIO()
            downloader = MediaIoBaseDownload(fh, request)
            done = False
            while done is False:
                status, done = downloader.next_chunk()
                fh.seek(0)
                yield fh.read()
                fh.seek(0)
                fh.truncate(0)

        return StreamingResponse(iterfile(), media_type=mime_type, headers=headers)

    def download_file_bytes(self, file_id: str) -> bytes:
        if self.use_r2 and file_id.startswith("r2_"):
            real_id = file_id[3:]
            obj = self.s3.get_object(Bucket=self.r2_bucket, Key=real_id)
            return obj['Body'].read()

        if self.mock_mode and file_id.startswith("local_"):
            file_path = os.path.join(self.upload_dir, file_id)
            if os.path.exists(file_path):
                with open(file_path, "rb") as f:
                    return f.read()
            return b""
            
        request = self.service.files().get_media(fileId=file_id)
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while done is False:
            status, done = downloader.next_chunk()
        return fh.getvalue()

drive_service = DriveService()
