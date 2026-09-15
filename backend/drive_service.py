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

    def upload_file(self, file_stream, filename, mime_type, db=None, book_id=None):
        safe_mime = mime_type if mime_type else 'application/octet-stream'
        
        # Tạo ASCII key an toàn cho S3/R2 và Local storage tránh lỗi encoding tiếng Việt
        import re
        name, ext = os.path.splitext(filename or "book")
        clean_name = re.sub(r'[^a-zA-Z0-9_-]', '_', name)
        clean_ext = re.sub(r'[^a-zA-Z0-9.]', '', ext)
        if not clean_ext:
            if safe_mime == 'application/pdf':
                clean_ext = '.pdf'
            elif 'epub' in safe_mime:
                clean_ext = '.epub'

        file_key = f"{uuid.uuid4().hex}_{clean_name[:40]}{clean_ext}"

        if self.use_r2:
            file_stream.seek(0)
            self.s3.upload_fileobj(
                file_stream,
                self.r2_bucket,
                file_key,
                ExtraArgs={'ContentType': safe_mime}
            )
            return f"r2_{file_key}"

        if self.mock_mode:
            # 1. Lưu vào thư mục uploads cục bộ (cache)
            local_id = f"local_{file_key}"
            file_path = os.path.join(self.upload_dir, local_id)
            file_stream.seek(0)
            file_bytes = file_stream.read()
            try:
                with open(file_path, "wb") as f:
                    f.write(file_bytes)
            except Exception as e:
                print(f"[DriveService] Warning: Could not write to local cache {file_path}: {e}")

            # 2. LƯU VĨNH VIỄN VÀO CƠ SỞ DỮ LIỆU POSTGRESQL (Chống mất file khi Render restart/redeploy)
            if db:
                try:
                    import models
                    bf = None
                    if book_id:
                        bf = db.query(models.BookFile).filter(models.BookFile.book_id == book_id).first()
                    if not bf:
                        bf = db.query(models.BookFile).filter(models.BookFile.file_key == local_id).first()
                    
                    if not bf:
                        bf = models.BookFile(
                            file_key=local_id,
                            book_id=book_id,
                            filename=filename,
                            mime_type=safe_mime,
                            file_data=file_bytes,
                            file_size=len(file_bytes)
                        )
                        db.add(bf)
                    else:
                        bf.file_key = local_id
                        if book_id:
                            bf.book_id = book_id
                        bf.filename = filename
                        bf.mime_type = safe_mime
                        bf.file_data = file_bytes
                        bf.file_size = len(file_bytes)
                    db.flush()
                    print(f"[DriveService] Saved '{filename}' ({len(file_bytes)} bytes) permanently to database.")
                except Exception as db_err:
                    print(f"[DriveService] Error saving file to BookFile table: {db_err}")

            return local_id

        file_metadata = {'name': filename, 'parents': [self.folder_id]}
        file_stream.seek(0)
        media = MediaIoBaseUpload(file_stream, mimetype=safe_mime, resumable=True)
        file = self.service.files().create(body=file_metadata, media_body=media, fields='id').execute()
        return file.get('id')

    def stream_download(self, file_id, filename, mime_type, file_size=None, db=None, book_id=None):
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
        if self.mock_mode or (file_id and file_id.startswith("local_")):
            file_path = os.path.join(self.upload_dir, file_id) if file_id else ""
            content_bytes = None

            # Bước A: Thử đọc từ cache đĩa cục bộ
            if file_path and os.path.exists(file_path):
                try:
                    with open(file_path, "rb") as f:
                        content_bytes = f.read()
                    # Tự động đẩy file lên Database PostgreSQL nếu chưa có
                    if content_bytes and db:
                        import models
                        existing_bf = db.query(models.BookFile).filter(
                            (models.BookFile.file_key == file_id) | (models.BookFile.book_id == book_id)
                        ).first() if (file_id or book_id) else None
                        if not existing_bf:
                            new_bf = models.BookFile(
                                file_key=file_id,
                                book_id=book_id,
                                filename=filename,
                                mime_type=mime_type,
                                file_data=content_bytes,
                                file_size=len(content_bytes)
                            )
                            db.add(new_bf)
                            db.commit()
                except Exception:
                    content_bytes = None

            # Bước B: Nếu file mất trên đĩa (do Render restart), tự động phục hồi tức thì từ Database!
            if not content_bytes and db:
                try:
                    import models
                    bf = None
                    if file_id:
                        bf = db.query(models.BookFile).filter(models.BookFile.file_key == file_id).first()
                    if not bf and book_id:
                        bf = db.query(models.BookFile).filter(models.BookFile.book_id == book_id).first()
                    if bf and bf.file_data:
                        content_bytes = bf.file_data
                        # Ghi lại ra đĩa cache để các lần đọc sau nhanh hơn
                        if file_path:
                            try:
                                with open(file_path, "wb") as f:
                                    f.write(content_bytes)
                            except Exception:
                                pass
                except Exception as e:
                    print(f"[DriveService] Error querying BookFile from DB: {e}")

            if content_bytes:
                headers["Content-Length"] = str(len(content_bytes))
                return Response(content=content_bytes, media_type=mime_type, headers=headers)
            else:
                raise HTTPException(status_code=404, detail="File sách không còn tồn tại trên server lưu trữ tạm. Vui lòng sử dụng tính năng 'Khôi phục file sách' trong trang Quản trị để lưu vĩnh viễn vào hệ thống.")

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

    def download_file_bytes(self, file_id: str, db=None, book_id=None) -> bytes:
        if self.use_r2 and file_id and file_id.startswith("r2_"):
            real_id = file_id[3:]
            obj = self.s3.get_object(Bucket=self.r2_bucket, Key=real_id)
            return obj['Body'].read()

        if self.mock_mode or (file_id and file_id.startswith("local_")):
            file_path = os.path.join(self.upload_dir, file_id) if file_id else ""
            if file_path and os.path.exists(file_path):
                with open(file_path, "rb") as f:
                    return f.read()
            if db:
                import models
                bf = None
                if file_id:
                    bf = db.query(models.BookFile).filter(models.BookFile.file_key == file_id).first()
                if not bf and book_id:
                    bf = db.query(models.BookFile).filter(models.BookFile.book_id == book_id).first()
                if bf and bf.file_data:
                    return bf.file_data
            return b""
            
        request = self.service.files().get_media(fileId=file_id)
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while done is False:
            status, done = downloader.next_chunk()
        return fh.getvalue()

drive_service = DriveService()
