import os
import io
from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from fastapi.responses import RedirectResponse
import uvicorn
import re
import uvicorn

import models
import schemas
from database import engine, get_db
from drive_service import drive_service
from extract_service import extract_pdf_info, extract_epub_info

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Virtual Bookshelf API")

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
    db: Session = Depends(get_db)
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
def create_book_from_link(book_in: schemas.BookLinkCreate, db: Session = Depends(get_db)):
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
def update_book(book_id: str, book_in: schemas.BookUpdate, db: Session = Depends(get_db)):
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    if book_in.title is not None: book.title = book_in.title
    if book_in.author is not None: book.author = book_in.author
    if book_in.genre is not None: book.genre = book_in.genre
    if book_in.summary is not None: book.summary = book_in.summary
    if book_in.cover_url is not None: book.cover_url = book_in.cover_url
    
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
def delete_book(book_id: str, db: Session = Depends(get_db)):
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    db.delete(book)
    db.commit()
    return {"message": "Deleted successfully"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
