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

    def stream_download(self, file_id, filename, mime_type, file_size=None):
        import urllib.parse
        from fastapi.responses import Response
        from fastapi import HTTPException

        # Sanitize filename for headers (ASCII fallback + UTF-8 encoded)
        safe_filename = filename.encode('ascii', 'ignore').decode('ascii').replace('"', '').strip()
        if not safe_filename:
            safe_filename = "downloaded_book"
        encoded_filename = urllib.parse.quote(filename)

        headers = {
            "Content-Disposition": f'attachment; filename="{safe_filename}"; filename*=UTF-8\'\'{encoded_filename}',
            "Access-Control-Expose-Headers": "Content-Disposition, Content-Length",
        }

        # 1. Local Storage Mode (mock_mode)
        if self.mock_mode and file_id.startswith("local_"):
            file_path = os.path.join(self.upload_dir, file_id)
            if os.path.exists(file_path):
                actual_size = os.path.getsize(file_path)
                headers["Content-Length"] = str(actual_size)
                
                with open(file_path, "rb") as f:
                    content_bytes = f.read()
                return Response(content=content_bytes, media_type=mime_type, headers=headers)
            else:
                raise HTTPException(status_code=404, detail="File không tồn tại trên lưu trữ local")

        # 2. R2 Storage Mode
        if self.use_r2 and file_id.startswith("r2_"):
            real_id = file_id[3:]
            obj = self.s3.get_object(Bucket=self.r2_bucket, Key=real_id)
            content_bytes = obj['Body'].read()
            headers["Content-Length"] = str(len(content_bytes))
            return Response(content=content_bytes, media_type=mime_type, headers=headers)

        # 3. Google Drive Mode
        try:
            request = self.service.files().get_media(fileId=file_id)
            fh = io.BytesIO()
            downloader = MediaIoBaseDownload(fh, request)
            done = False
            while done is False:
                status, done = downloader.next_chunk()
            content_bytes = fh.getvalue()
            headers["Content-Length"] = str(len(content_bytes))
            return Response(content=content_bytes, media_type=mime_type, headers=headers)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Lỗi khi tải file từ Google Drive: {str(e)}")

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
