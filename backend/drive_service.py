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
        # MOCK MODE: Nếu chưa có file json, sẽ chạy chế độ lưu Local (cục bộ)
        self.mock_mode = not os.path.exists('service-account.json')
        if not self.mock_mode:
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
        if self.mock_mode and file_id.startswith("local_"):
            # Lấy file từ thư mục local
            file_path = os.path.join(self.upload_dir, file_id)
            
            def iterfile():
                with open(file_path, "rb") as f:
                    while chunk := f.read(1024 * 1024): # Đọc chunk 1MB
                        yield chunk

            headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
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

        headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
        return StreamingResponse(iterfile(), media_type=mime_type, headers=headers)

drive_service = DriveService()
