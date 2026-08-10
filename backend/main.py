import os
import io
from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
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
from extract_service import extract_pdf_info, extract_epub_info
from email_service import send_otp_email
from datetime import datetime, timezone
import random
import string

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Virtual Bookshelf API")

from create_admin import create_default_admin

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/books", response_model=List[schemas.BookResponse])
def get_books(db: Session = Depends(get_db)):
    books = db.query(models.Book).order_by(models.Book.created_at.desc()).all()
    return books

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
    return db_book

@app.put("/api/books/{book_id}", response_model=schemas.BookResponse)
def update_book(book_id: str, book_in: schemas.BookUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    if book_in.title is not None: book.title = book_in.title
    if book_in.author is not None: book.author = book_in.author
    if book_in.genre is not None: book.genre = book_in.genre
    if book_in.summary is not None: book.summary = book_in.summary
    if book_in.cover_url is not None: book.cover_url = book_in.cover_url
    if book_in.external_url is not None: book.external_url = book_in.external_url
    
    db.commit()
    db.refresh(book)
    return book

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

from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta

@app.post("/api/auth/send-otp")
def send_otp(otp_request: schemas.OTPRequest, db: Session = Depends(get_db)):
    # Check if email exists
    existing_user = db.query(models.User).filter(models.User.email == otp_request.email).first()
    
    if otp_request.purpose == "register" and existing_user:
        raise HTTPException(status_code=400, detail="Email này đã được đăng ký.")
        
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
    # Check username
    db_user_by_username = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user_by_username:
        raise HTTPException(status_code=400, detail="Tên đăng nhập đã tồn tại.")
        
    db_user_by_email = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user_by_email:
        raise HTTPException(status_code=400, detail="Email này đã được đăng ký.")
        
    # Verify OTP
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

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
