import os
import io
from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session, defer
from typing import List
from fastapi.responses import RedirectResponse
import uvicorn
import re
import urllib.request
import urllib.parse
import json

import models
import schemas
from database import engine, get_db
import auth
from drive_service import drive_service
from extract_service import extract_pdf_info, extract_epub_info, compress_cover_image
from email_service import send_otp_email
from datetime import datetime, timezone
import random
import string

import sqlite3

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Virtual Bookshelf API")

os.makedirs("uploads/covers", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

from create_admin import create_default_admin
from migrate_to_pg import migrate_sqlite_to_target_db

def repair_cover_for_book(book: models.Book, db: Session) -> str | None:
    if not book:
        return None
        
    if book.cover_url and (book.cover_url.startswith("data:image") or book.cover_url.startswith("http") or book.cover_url.startswith("/uploads") or book.cover_url.startswith("uploads")):
        return book.cover_url

    # 1. Try local SQLite bookshelf.db backup
    sqlite_db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bookshelf.db")
    if os.path.exists(sqlite_db_path):
        try:
            conn = sqlite3.connect(sqlite_db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT cover_url FROM books WHERE id = ?", (book.id,))
            row = cursor.fetchone()
            conn.close()
            if row and row[0] and (row[0].startswith("data:image") or row[0].startswith("http") or row[0].startswith("/uploads")):
                book.cover_url = row[0]
                db.commit()
                print(f"[Cover Repair] Restored cover from bookshelf.db for '{book.title}' ({book.id})")
                return book.cover_url
        except Exception as e:
            print(f"[Cover Repair] SQLite lookup failed for {book.id}: {e}")

    # 2. Find file_id from drive_file_id or external_url
    file_id = book.drive_file_id
    if not file_id and book.external_url:
        match_d = re.search(r'/file/d/([a-zA-Z0-9_-]+)', book.external_url)
        if match_d:
            file_id = match_d.group(1)
        else:
            match_id = re.search(r'[?&]id=([a-zA-Z0-9_-]+)', book.external_url)
            if match_id:
                file_id = match_id.group(1)

    # 3. Download file_bytes via Service Account OR Public link
    file_bytes = None
    if file_id:
        try:
            file_bytes = drive_service.download_file_bytes(file_id)
        except Exception as e:
            print(f"[Cover Repair] Service account download failed for {book.title}: {e}")

        if not file_bytes:
            try:
                import requests
                res = requests.get(f"https://drive.google.com/uc?export=download&id={file_id}", timeout=10)
                if res.status_code == 200:
                    file_bytes = res.content
            except Exception as e:
                print(f"[Cover Repair] Public download failed for {book.title}: {e}")

    # 4. Extract cover image from PDF/EPUB bytes
    if file_bytes and len(file_bytes) > 0:
        try:
            is_pdf = True if (book.mime_type == 'application/pdf' or file_bytes.startswith(b'%PDF')) else False
            extracted = extract_pdf_info(file_bytes) if is_pdf else extract_epub_info(file_bytes)
            b64 = extracted.get('cover_b64')
            if b64:
                book.cover_url = b64
                db.commit()
                print(f"[Cover Repair] Successfully extracted cover for '{book.title}' ({book.id})")
                return b64
        except Exception as e:
            print(f"[Cover Repair] Extraction failed for {book.title}: {e}")

    return None

@app.on_event("startup")
def startup_event():
    # Auto-migrate database to add email column if it's missing
    from database import SessionLocal
    from sqlalchemy import text
    db = SessionLocal()
    try:
        db.execute(text("ALTER TABLE users ADD COLUMN email VARCHAR;"))
        db.commit()
    except Exception:
        db.rollback() # Column already exists or error
    finally:
        db.close()
        
    create_default_admin()
    migrate_sqlite_to_target_db()

    # Auto-repair books with missing covers on startup
    try:
        db_session = SessionLocal()
        books_without_covers = db_session.query(models.Book).filter(
            (models.Book.cover_url == None) | 
            (models.Book.cover_url == "") | 
            (models.Book.cover_url.like("%/api/books/cover/%"))
        ).all()
        for b in books_without_covers:
            repair_cover_for_book(b, db_session)
        db_session.close()
    except Exception as err:
        print(f"[Startup Auto-Repair] Error: {err}")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def serialize_book_lightweight(b: models.Book) -> dict:
    return {
        "id": b.id,
        "title": b.title,
        "author": b.author,
        "genre": b.genre,
        "summary": b.summary,
        "cover_url": f"/api/books/cover/{b.id}",
        "drive_file_id": b.drive_file_id,
        "external_url": b.external_url,
        "mime_type": b.mime_type,
        "file_size": b.file_size,
        "progress": b.progress,
        "created_at": b.created_at,
        "updated_at": b.updated_at,
    }

@app.get("/api/books", response_model=List[schemas.BookResponse])
def get_books(db: Session = Depends(get_db)):
    books = db.query(models.Book).options(defer(models.Book.cover_url)).order_by(models.Book.created_at.desc()).all()
    return [serialize_book_lightweight(b) for b in books]

@app.get("/api/books/{book_id}", response_model=schemas.BookResponse)
def get_book(book_id: str, db: Session = Depends(get_db)):
    book = db.query(models.Book).options(defer(models.Book.cover_url)).filter(models.Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return serialize_book_lightweight(book)

@app.post("/api/books/upload", response_model=schemas.BookResponse)
async def upload_book(
    file: UploadFile = File(...),
    title: str = Form(""),
    external_url: str = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_admin_user)
):
    try:
        contents = await file.read()
        mime_type = file.content_type
        
        extracted = {}
        if mime_type == 'application/pdf':
            extracted = extract_pdf_info(contents)
        elif mime_type in ['application/epub+zip', 'application/epub']:
            extracted = extract_epub_info(contents)
            
        final_title = extracted.get('title') or title
        final_author = extracted.get('author') or "Unknown Author"
        final_summary = extracted.get('summary') or ""
        cover_b64 = extracted.get('cover_b64')
        
        # Tối ưu hóa Database: Upload Base64 lên ImgBB để lấy URL ngắn (Nếu có API Key)
        imgbb_key = os.getenv("IMGBB_API_KEY")
        if imgbb_key and cover_b64 and cover_b64.startswith("data:image"):
            try:
                b64_data = cover_b64.split(",")[1]
                url = "https://api.imgbb.com/1/upload"
                data = urllib.parse.urlencode({'key': imgbb_key, 'image': b64_data}).encode('utf-8')
                req = urllib.request.Request(url, data=data)
                with urllib.request.urlopen(req, timeout=10) as response:
                    res = json.loads(response.read().decode('utf-8'))
                    img_url = res.get("data", {}).get("url")
                    if img_url:
                        cover_b64 = img_url
            except Exception as e:
                print(f"ImgBB Upload Failed: {e}")
                
        # Giữ nguyên cover_b64 dạng data:image/jpeg;base64,... nhẹ trong DB để không bao giờ bị 404 khi Vercel/Render redeploy hay reload trang
        drive_file_id = None
        if not external_url or not external_url.strip():
            file_stream = io.BytesIO(contents)
            drive_file_id = drive_service.upload_file(file_stream, file.filename, mime_type)
        
        db_book = models.Book(
            title=final_title,
            author=final_author,
            summary=final_summary,
            cover_url=cover_b64,
            drive_file_id=drive_file_id,
            external_url=external_url,
            mime_type=mime_type,
            file_size=len(contents),
            progress=0
        )
        db.add(db_book)
        db.commit()
        db.refresh(db_book)
        
        return db_book
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/books/link", response_model=schemas.BookResponse)
def create_book_from_link(book_in: schemas.BookLinkCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    db_book = models.Book(
        title=book_in.title,
        author=book_in.author,
        genre=book_in.genre,
        cover_url=book_in.cover_url,
        external_url=book_in.external_url,
        progress=0
    )
    db.add(db_book)
    db.commit()
    db.refresh(db_book)
    db.refresh(db_book)
    return db_book

@app.get("/api/external-search", response_model=List[schemas.ExternalSearchItem])
async def external_search(q: str, source: Optional[str] = None):
    import telegram_client
    try:
        books = await telegram_client.search_books_via_telegram(q, source=source)
        return books
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/external-import", response_model=schemas.BookResponse)
async def external_import(
    request: schemas.ExternalImportRequest, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    import telegram_client
    import io
    
    try:
        # Tải file qua Telegram
        file_bytes, filename = await telegram_client.download_book_via_telegram(request.id)
        
        ext_hint = filename.lower()
        if '.pdf' in ext_hint: mime_type = 'application/pdf'
        elif '.epub' in ext_hint: mime_type = 'application/epub+zip'
        else: mime_type = 'application/pdf'
        
        extracted = {}
        if 'pdf' in mime_type.lower() or file_bytes.startswith(b'%PDF'):
            mime_type = 'application/pdf'
            extracted = extract_pdf_info(file_bytes)
        else:
            mime_type = 'application/epub+zip'
            extracted = extract_epub_info(file_bytes)
            
        final_title = extracted.get('title') or request.title or filename
        final_author = extracted.get('author') or request.author or "Unknown Author"
        cover_b64 = extracted.get('cover_b64')
        
        file_stream = io.BytesIO(file_bytes)
        drive_file_id = drive_service.upload_file(file_stream, filename, mime_type)
        
        db_book = models.Book(
            title=final_title,
            author=final_author,
            summary="",
            cover_url=cover_b64,
            drive_file_id=drive_file_id,
            mime_type=mime_type,
            file_size=len(file_bytes),
            progress=0
        )
        db.add(db_book)
        db.commit()
        db.refresh(db_book)
        
        return db_book
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/books/{book_id}", response_model=schemas.BookResponse)
def update_book(book_id: str, book_in: schemas.BookUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    if book_in.title is not None: book.title = book_in.title
    if book_in.author is not None: book.author = book_in.author
    if book_in.genre is not None: book.genre = book_in.genre
    if book_in.summary is not None: book.summary = book_in.summary
    if book_in.external_url is not None: book.external_url = book_in.external_url
    
    # Do not overwrite existing cover_url in database if input is empty, None, or endpoint route string
    if book_in.cover_url is not None:
        clean_cover = book_in.cover_url.strip()
        if clean_cover and not clean_cover.startswith("/api/books/cover/") and not clean_cover.startswith("api/books/cover/"):
            book.cover_url = clean_cover
            
    # Auto-repair cover if currently missing
    if not book.cover_url or book.cover_url.startswith("/api/books/cover/") or book.cover_url.startswith("api/books/cover/"):
        repair_cover_for_book(book, db)
    
    db.commit()
    db.refresh(book)
    return serialize_book_lightweight(book)


@app.get("/api/books/{book_id}/download")
def download_book(book_id: str, db: Session = Depends(get_db)):
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
        
    # Redirect if external link exists
    if book.external_url:
        url = book.external_url
        
        # Thử trích xuất File ID nếu là link Google Drive để tự động tải về
        file_id = None
        match_d = re.search(r'/file/d/([a-zA-Z0-9_-]+)', url)
        if match_d:
            file_id = match_d.group(1)
        else:
            match_id = re.search(r'[?&]id=([a-zA-Z0-9_-]+)', url)
            if match_id:
                file_id = match_id.group(1)
                
        if file_id:
            # Format link tải xuống trực tiếp của Google Drive
            direct_download_url = f"https://drive.google.com/uc?export=download&id={file_id}"
            return RedirectResponse(url=direct_download_url)
            
        return RedirectResponse(url=url)
        
    if not book.drive_file_id:
        raise HTTPException(status_code=400, detail="No file associated with this book")

    filename = f"{book.title}.pdf" if book.mime_type == 'application/pdf' else f"{book.title}.epub"
    return drive_service.stream_download(book.drive_file_id, filename, book.mime_type)

@app.delete("/api/books/{book_id}")
def delete_book(book_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    db.delete(book)
    db.commit()
    return {"message": "Deleted successfully"}

@app.delete("/api/books")
def delete_books_bulk(book_ids: schemas.BookBulkDelete, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    if not book_ids.book_ids:
        raise HTTPException(status_code=400, detail="No books selected")
        
    books = db.query(models.Book).filter(models.Book.id.in_(book_ids.book_ids)).all()
    for book in books:
        db.delete(book)
    db.commit()
    return {"message": f"Deleted {len(books)} books successfully"}

# --- COLLECTIONS API ---

@app.get("/api/books/cover/{book_id}")
def get_book_cover(book_id: str, db: Session = Depends(get_db)):
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
        
    # If cover_url is missing or endpoint route, attempt repair
    if not book.cover_url or book.cover_url.startswith("/api/books/cover/") or book.cover_url.startswith("api/books/cover/"):
        repair_cover_for_book(book, db)

    if not book.cover_url:
        raise HTTPException(status_code=404, detail="Cover not found")

    if book.cover_url.startswith("data:image"):
        try:
            import base64
            from fastapi.responses import Response
            header, encoded = book.cover_url.split(",", 1)
            mime_type = header.split(":")[1].split(";")[0]
            encoded += "=" * ((4 - len(encoded) % 4) % 4)
            image_bytes = base64.b64decode(encoded)
            return Response(
                content=image_bytes, 
                media_type=mime_type,
                headers={"Cache-Control": "public, max-age=86400, stale-while-revalidate=604800"}
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail="Invalid cover format")
            
    if book.cover_url.startswith("http"):
        from fastapi.responses import RedirectResponse
        return RedirectResponse(book.cover_url)
        
    local_path = book.cover_url.lstrip("/")
    if os.path.exists(local_path):
        from fastapi.responses import FileResponse
        return FileResponse(
            local_path,
            headers={"Cache-Control": "public, max-age=86400, stale-while-revalidate=604800"}
        )
        
    raise HTTPException(status_code=404, detail="Cover file not found")

@app.get("/api/collections", response_model=List[schemas.CollectionResponse])
def get_collections(db: Session = Depends(get_db)):
    collections = db.query(models.Collection).order_by(models.Collection.created_at.desc()).all()
    for c in collections:
        c.book_count = db.query(models.CollectionBook).filter(models.CollectionBook.collection_id == c.id).count()
    return collections

@app.get("/api/collections/{collection_id}", response_model=schemas.CollectionDetailResponse)
def get_collection(collection_id: str, db: Session = Depends(get_db)):
    collection = db.query(models.Collection).filter(models.Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    collection_books = db.query(models.CollectionBook).filter(models.CollectionBook.collection_id == collection_id).all()
    books = [serialize_book_lightweight(cb.book) for cb in collection_books if cb.book]
        
    return {
        "id": collection.id,
        "name": collection.name,
        "description": collection.description,
        "created_at": collection.created_at,
        "book_count": len(books),
        "books": books
    }

@app.post("/api/collections", response_model=schemas.CollectionResponse)
def create_collection(collection_in: schemas.CollectionCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    db_collection = models.Collection(
        name=collection_in.name,
        description=collection_in.description
    )
    db.add(db_collection)
    db.commit()
    db.refresh(db_collection)
    db_collection.book_count = 0
    return db_collection

@app.put("/api/collections/{collection_id}", response_model=schemas.CollectionResponse)
def update_collection(collection_id: str, collection_in: schemas.CollectionUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    collection = db.query(models.Collection).filter(models.Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    if collection_in.name is not None: collection.name = collection_in.name
    if collection_in.description is not None: collection.description = collection_in.description
    
    db.commit()
    db.refresh(collection)
    collection.book_count = db.query(models.CollectionBook).filter(models.CollectionBook.collection_id == collection_id).count()
    return collection

@app.delete("/api/collections/{collection_id}")
def delete_collection(collection_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    collection = db.query(models.Collection).filter(models.Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    db.delete(collection)
    db.commit()
    return {"message": "Collection deleted successfully"}

@app.post("/api/collections/{collection_id}/books/{book_id}")
def add_book_to_collection(collection_id: str, book_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    collection = db.query(models.Collection).filter(models.Collection.id == collection_id).first()
    if not collection: raise HTTPException(status_code=404, detail="Collection not found")
    
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not book: raise HTTPException(status_code=404, detail="Book not found")
    
    existing = db.query(models.CollectionBook).filter_by(collection_id=collection_id, book_id=book_id).first()
    if existing:
        return {"message": "Book already in collection"}
        
    cb = models.CollectionBook(collection_id=collection_id, book_id=book_id)
    db.add(cb)
    db.commit()
    return {"message": "Book added to collection"}

@app.delete("/api/collections/{collection_id}/books/{book_id}")
def remove_book_from_collection(collection_id: str, book_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    cb = db.query(models.CollectionBook).filter_by(collection_id=collection_id, book_id=book_id).first()
    if not cb:
        raise HTTPException(status_code=404, detail="Book not found in collection")
    
    db.delete(cb)
    db.commit()
    return {"message": "Book removed from collection"}

# --- REGISTRATION CODES API ---

@app.post("/api/admin/registration-codes", response_model=schemas.RegistrationCodeResponse)
def create_registration_code(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    while True:
        code_str = "BC-" + ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        exists = db.query(models.RegistrationCode).filter(models.RegistrationCode.code == code_str).first()
        if not exists:
            break
            
    reg_code = models.RegistrationCode(
        code=code_str,
        created_by=current_user.username
    )
    db.add(reg_code)
    db.commit()
    db.refresh(reg_code)
    return reg_code

@app.get("/api/admin/registration-codes", response_model=List[schemas.RegistrationCodeResponse])
def get_registration_codes(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    codes = db.query(models.RegistrationCode).order_by(models.RegistrationCode.created_at.desc()).all()
    return codes

@app.delete("/api/admin/registration-codes/{code_id}")
def delete_registration_code(code_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    code_obj = db.query(models.RegistrationCode).filter(models.RegistrationCode.id == code_id).first()
    if not code_obj:
        raise HTTPException(status_code=404, detail="Mã đăng ký không tồn tại.")
    if code_obj.is_used:
        raise HTTPException(status_code=400, detail="Không thể xóa mã đã được sử dụng.")
        
    db.delete(code_obj)
    db.commit()
    return {"message": "Đã xóa mã đăng ký thành công."}

@app.put("/api/admin/registration-codes/{code_id}/regenerate", response_model=schemas.RegistrationCodeResponse)
def regenerate_registration_code(code_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    code_obj = db.query(models.RegistrationCode).filter(models.RegistrationCode.id == code_id).first()
    if not code_obj:
        raise HTTPException(status_code=404, detail="Mã đăng ký không tồn tại.")
    if code_obj.is_used:
        raise HTTPException(status_code=400, detail="Không thể đổi mã đã được sử dụng.")
        
    while True:
        code_str = "BC-" + ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        exists = db.query(models.RegistrationCode).filter(models.RegistrationCode.code == code_str).first()
        if not exists:
            break

    code_obj.code = code_str
    db.commit()
    db.refresh(code_obj)
    return code_obj

from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta

@app.post("/api/auth/send-otp")
def send_otp(otp_request: schemas.OTPRequest, db: Session = Depends(get_db)):
    # Check if email exists
    existing_user = db.query(models.User).filter(models.User.email == otp_request.email).first()
    
    if otp_request.purpose == "register":
        if existing_user:
            raise HTTPException(status_code=400, detail="Email này đã được đăng ký.")
        if not otp_request.registration_code:
            raise HTTPException(status_code=400, detail="Vui lòng cung cấp mã đăng ký do Admin cấp.")
        reg_code = db.query(models.RegistrationCode).filter(
            models.RegistrationCode.code == otp_request.registration_code.strip().upper(),
            models.RegistrationCode.is_used == False
        ).first()
        if not reg_code:
            raise HTTPException(status_code=400, detail="Mã đăng ký không hợp lệ hoặc đã được sử dụng.")
        
    if otp_request.purpose == "reset_password" and not existing_user:
        raise HTTPException(status_code=404, detail="Email này chưa được đăng ký.")

    # Generate 6-digit OTP
    otp_code = ''.join(random.choices(string.digits, k=6))
    
    # Save to DB
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    db_otp = models.OTP(
        email=otp_request.email,
        otp_code=otp_code,
        purpose=otp_request.purpose,
        expires_at=expires_at
    )
    db.add(db_otp)
    db.commit()
    
    # Send email
    success = send_otp_email(otp_request.email, otp_code, otp_request.purpose)
    if not success:
        raise HTTPException(status_code=500, detail="Không thể gửi email OTP. Vui lòng thử lại sau.")
        
    return {"message": "Mã OTP đã được gửi đến email của bạn."}

@app.post("/api/auth/register")
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # Check registration code
    if not user.registration_code:
        raise HTTPException(status_code=400, detail="Vui lòng cung cấp mã đăng ký do Admin cấp.")
        
    reg_code = db.query(models.RegistrationCode).filter(
        models.RegistrationCode.code == user.registration_code.strip().upper(),
        models.RegistrationCode.is_used == False
    ).first()
    if not reg_code:
        raise HTTPException(status_code=400, detail="Mã đăng ký không hợp lệ hoặc đã được sử dụng.")

    # Check username
    db_user_by_username = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user_by_username:
        raise HTTPException(status_code=400, detail="Tên đăng nhập đã tồn tại.")
        
    db_user_by_email = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user_by_email:
        raise HTTPException(status_code=400, detail="Email này đã được đăng ký.")
        
    # Verify OTP (if provided)
    if user.otp_code:
        otp_record = db.query(models.OTP).filter(
            models.OTP.email == user.email,
            models.OTP.otp_code == user.otp_code,
            models.OTP.purpose == "register",
            models.OTP.is_used == False,
            models.OTP.expires_at > datetime.now(timezone.utc)
        ).first()
        
        if not otp_record:
            raise HTTPException(status_code=400, detail="Mã OTP không hợp lệ hoặc đã hết hạn.")
            
        otp_record.is_used = True
    
    # Mark registration code as used
    reg_code.is_used = True
    reg_code.used_by_username = user.username
    
    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(username=user.username, email=user.email, password_hash=hashed_password, role=user.role)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Auto-login: Create access token
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": new_user.username}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": {
            "id": new_user.id,
            "username": new_user.username,
            "email": new_user.email,
            "role": new_user.role,
            "created_at": new_user.created_at
        }
    }

@app.post("/api/auth/reset-password")
def reset_password(reset_data: schemas.PasswordReset, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == reset_data.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Email này chưa được đăng ký.")
        
    # Verify OTP
    otp_record = db.query(models.OTP).filter(
        models.OTP.email == reset_data.email,
        models.OTP.otp_code == reset_data.otp_code,
        models.OTP.purpose == "reset_password",
        models.OTP.is_used == False,
        models.OTP.expires_at > datetime.now(timezone.utc)
    ).first()
    
    if not otp_record:
        raise HTTPException(status_code=400, detail="Mã OTP không hợp lệ hoặc đã hết hạn.")
        
    otp_record.is_used = True
    
    user.password_hash = auth.get_password_hash(reset_data.new_password)
    db.commit()
    
    return {"message": "Mật khẩu đã được cập nhật thành công."}

@app.post("/api/auth/login", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/auth/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@app.post("/api/admin/fix-all-covers")
def fix_all_covers(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    from sqlalchemy import or_
    import requests
    import re
    
    books = db.query(models.Book).filter(
        or_(
            models.Book.cover_url.like('%lh3.googleusercontent.com%'),
            models.Book.cover_url.like('/uploads/%'),
            models.Book.cover_url.like('%/api/books/cover/%'),
            models.Book.cover_url == None,
            models.Book.cover_url == ''
        )
    ).all()

    
    fixed_count = 0
    failed = []
    
    for book in books:
        b64 = None
        
        # 1. Tìm Drive File ID
        file_id = book.drive_file_id
        if not file_id and book.external_url:
            match_d = re.search(r'/file/d/([a-zA-Z0-9_-]+)', book.external_url)
            if match_d:
                file_id = match_d.group(1)
            else:
                match_id = re.search(r'[?&]id=([a-zA-Z0-9_-]+)', book.external_url)
                if match_id:
                    file_id = match_id.group(1)

        # 2. Thử tải file
        file_bytes = None
        if file_id:
            try:
                # Cố gắng dùng Service Account
                file_bytes = drive_service.download_file_bytes(file_id)
            except Exception as e:
                print(f"Service account download failed for {book.title}: {e}")
                
            # Nếu Service Account không được, thử tải qua link Public ẩn danh
            if not file_bytes:
                try:
                    res = requests.get(f'https://drive.google.com/uc?export=download&id={file_id}')
                    if res.status_code == 200:
                        file_bytes = res.content
                except Exception as e:
                    print(f"Public download failed for {book.title}: {e}")

        # 3. Trích xuất bìa
        if file_bytes and len(file_bytes) > 0:
            try:
                # Phân loại đuôi file
                is_pdf = False
                if book.mime_type == 'application/pdf': is_pdf = True
                elif book.external_url and '.pdf' in book.external_url.lower(): is_pdf = True
                elif file_bytes.startswith(b'%PDF'): is_pdf = True
                
                if is_pdf:
                    extracted = extract_pdf_info(file_bytes)
                else:
                    extracted = extract_epub_info(file_bytes)
                    
                b64 = extracted.get('cover_b64')
            except Exception as e:
                print(f"Extraction failed for {book.title}: {e}")

        # 4. Fallback cục bộ
        if not b64 and book.cover_url:
            local_path = book.cover_url.lstrip('/')
            if os.path.exists(local_path):
                try:
                    with open(local_path, "rb") as f:
                        b64 = compress_cover_image(f.read())
                except Exception:
                    pass
                
        # 5. Lưu DB
        if b64:
            book.cover_url = b64
            fixed_count += 1
            # Commit từng cuốn để tránh mất mát nếu time out
            db.commit()
        else:
            failed.append(book.title)
            
    return {"message": f"Đã quét và khắc phục {fixed_count} bìa sách cũ thành công!", "fixed_count": fixed_count, "failed": failed}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
