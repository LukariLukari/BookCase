import os
import io
from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session, defer, selectinload
from typing import List, Optional
from fastapi.responses import RedirectResponse, HTMLResponse
import uvicorn
import re
import urllib.request
import urllib.parse
import json

import models
import schemas
from database import engine, get_db, SessionLocal
import auth
from drive_service import drive_service
from extract_service import extract_pdf_info, extract_epub_info, compress_cover_image
from email_service import send_otp_email
from datetime import datetime, timezone
import random
import string
import secrets
import time
import unicodedata

import sqlite3

from sqlalchemy import text, func

try:
    models.Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        # Auto-migrate quotes table for Postgres and SQLite
        try:
            conn.execute(text("ALTER TABLE quotes ADD COLUMN IF NOT EXISTS page_number INTEGER;"))
            conn.commit()
        except Exception:
            try:
                conn.execute(text("ALTER TABLE quotes ADD COLUMN page_number INTEGER;"))
                conn.commit()
            except Exception:
                pass
except Exception as e:
    print(f"Warning: Database creation race condition handled: {e}")
    time.sleep(1) # Give the primary worker a moment to finish creating tables

app = FastAPI(title="Virtual Bookshelf API")

os.makedirs("uploads/covers", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

from create_admin import create_default_admin
from migrate_to_pg import migrate_sqlite_to_target_db

def sync_local_disk_files_to_db():
    """
    Rà soát toàn bộ file trong thư mục uploads cục bộ.
    Nếu file có trên đĩa nhưng chưa được lưu vào bảng BookFile của Database,
    tự động nạp vào Database PostgreSQL vĩnh viễn ngay khi khởi động.
    """
    try:
        db = SessionLocal()
        existing_book_file_ids = set(k[0] for k in db.query(models.BookFile.book_id).all() if k[0])
        existing_file_keys = set(k[0] for k in db.query(models.BookFile.file_key).all() if k[0])
        upload_dir = drive_service.upload_dir if hasattr(drive_service, 'upload_dir') else os.path.join(os.path.dirname(__file__), 'uploads')
        
        books = db.query(models.Book).filter(models.Book.drive_file_id.like("local_%")).all()
        synced_count = 0
        for b in books:
            if b.id in existing_book_file_ids or b.drive_file_id in existing_file_keys:
                continue
            file_path = os.path.join(upload_dir, b.drive_file_id)
            if os.path.exists(file_path):
                try:
                    with open(file_path, "rb") as f:
                        f_bytes = f.read()
                    bf = models.BookFile(
                        file_key=b.drive_file_id,
                        book_id=b.id,
                        filename=f"{b.title}.epub" if "epub" in (b.mime_type or "") else f"{b.title}.pdf",
                        mime_type=b.mime_type or "application/octet-stream",
                        file_data=f_bytes,
                        file_size=len(f_bytes)
                    )
                    db.add(bf)
                    existing_book_file_ids.add(b.id)
                    existing_file_keys.add(b.drive_file_id)
                    synced_count += 1
                except Exception as err:
                    print(f"[Startup Sync] Lỗi nạp file cho '{b.title}': {err}")
        if synced_count > 0:
            db.commit()
            print(f"[Startup Sync] Đã tự động đẩy {synced_count} file từ ổ đĩa vào Database PostgreSQL!")
        db.close()
    except Exception as e:
        print(f"[Startup Sync Error]: {e}")

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
            file_bytes = drive_service.download_file_bytes(file_id, db=db, book_id=book.id)
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

def keep_alive_task():
    """Chạy ngầm để ping server mỗi 14 phút, giúp server không bị ngủ trên Render."""
    url = os.getenv("RENDER_EXTERNAL_URL")
    if not url:
        return
    ping_url = f"{url}/api/ping"
    print(f"[KeepAlive] Bắt đầu tự động ping tới: {ping_url}")
    
    import time
    import urllib.request
    while True:
        try:
            time.sleep(14 * 60) # Chờ 14 phút (Render tắt sau 15p)
            req = urllib.request.Request(ping_url, headers={'User-Agent': 'KeepAlive'})
            with urllib.request.urlopen(req, timeout=10) as response:
                pass
            print(f"[KeepAlive] Đã ping {ping_url} để giữ server thức.")
        except Exception as e:
            print(f"[KeepAlive] Lỗi ping: {e}")

@app.get("/api/ping")
def ping():
    storage = "postgresql" if engine.url.get_backend_name().startswith("postgresql") else "local-sqlite"
    return {"status": "awake", "message": "Pong!", "storage": storage}

_business_tables_ready = False

def ensure_business_tables(db: Session):
    global _business_tables_ready
    if _business_tables_ready:
        return
    try:
        models.BusinessProduct.__table__.create(bind=engine, checkfirst=True)
        models.BusinessTransaction.__table__.create(bind=engine, checkfirst=True)
        models.BusinessLedger.__table__.create(bind=engine, checkfirst=True)
        models.BusinessStockReceipt.__table__.create(bind=engine, checkfirst=True)
        models.BusinessStockReceiptItem.__table__.create(bind=engine, checkfirst=True)
        models.BusinessOrder.__table__.create(bind=engine, checkfirst=True)
        models.BusinessOrderItem.__table__.create(bind=engine, checkfirst=True)
        models.BusinessExpense.__table__.create(bind=engine, checkfirst=True)
        for table in [models.BusinessProduct.__table__, models.BusinessOrder.__table__, models.BusinessExpense.__table__]:
            for index in table.indexes:
                index.create(bind=engine, checkfirst=True)
        _business_tables_ready = True
    except Exception as e:
        print(f"[Business Tables] create/check failed: {e}")

def validate_business_transaction(tx_type: str, category: str):
    if tx_type not in ["income", "expense"]:
        raise HTTPException(status_code=400, detail="type must be income or expense")
    if not category or not category.strip():
        raise HTTPException(status_code=400, detail="category is required")

def transaction_net_profit(t: models.BusinessTransaction) -> int:
    if t.type == "income":
        return (t.amount or 0) - (t.capital_cost or 0) - (t.shipping_fee or 0) - (t.other_fee or 0)
    return -(t.amount or 0)

def serialize_business_transaction(t: models.BusinessTransaction) -> dict:
    return {
        "id": t.id,
        "user_id": t.user_id,
        "product_id": t.product_id,
        "type": t.type,
        "category": t.category,
        "amount": t.amount or 0,
        "quantity": t.quantity or 0,
        "capital_cost": t.capital_cost or 0,
        "shipping_fee": t.shipping_fee or 0,
        "other_fee": t.other_fee or 0,
        "customer_name": t.customer_name,
        "customer_contact": t.customer_contact,
        "social_link": t.social_link,
        "note": t.note,
        "transaction_date": t.transaction_date,
        "created_at": t.created_at,
        "updated_at": t.updated_at,
        "product_name": t.product.name if t.product else None,
        "product_image_url": t.product.image_url if t.product else None,
        "net_profit": transaction_net_profit(t),
    }

def serialize_business_product(p: models.BusinessProduct, transactions: Optional[list] = None) -> dict:
    txs = transactions if transactions is not None else p.transactions
    total_income = sum((t.amount or 0) for t in txs if t.type == "income")
    total_expense = sum((t.amount or 0) for t in txs if t.type == "expense")
    total_profit = sum(transaction_net_profit(t) for t in txs)
    sold_quantity = sum((t.quantity or 0) for t in txs if t.type == "income")
    return {
        "id": p.id,
        "user_id": p.user_id,
        "name": p.name,
        "sku": p.sku,
        "category": p.category,
        "image_url": p.image_url,
        "selling_price": p.selling_price or 0,
        "unit_cost": p.unit_cost or 0,
        "stock_quantity": p.stock_quantity or 0,
        "social_link": p.social_link,
        "supplier_info": p.supplier_info,
        "customer_info": p.customer_info,
        "notes": p.notes,
        "is_active": p.is_active,
        "created_at": p.created_at,
        "updated_at": p.updated_at,
        "total_income": total_income,
        "total_expense": total_expense,
        "total_profit": total_profit,
        "sold_quantity": sold_quantity,
    }


def serialize_business_order(order: models.BusinessOrder) -> dict:
    items = order.items or []
    subtotal = sum((item.unit_price or 0) * (item.quantity or 0) for item in items)
    capital_cost = sum((item.unit_cost or 0) * (item.quantity or 0) for item in items)
    total = subtotal + (order.shipping_fee or 0) - (order.discount or 0)
    profit = total - capital_cost - (order.shipping_cost or 0) - (order.other_fee or 0)
    return {
        "id": order.id,
        "ledger_id": order.ledger_id,
        "code": order.code,
        "customer_name": order.customer_name,
        "customer_contact": order.customer_contact,
        "social_link": order.social_link,
        "shipping_fee": order.shipping_fee or 0,
        "shipping_cost": order.shipping_cost or 0,
        "discount": order.discount or 0,
        "other_fee": order.other_fee or 0,
        "payment_status": order.payment_status,
        "status": order.status,
        "note": order.note,
        "ordered_at": order.ordered_at,
        "created_at": order.created_at,
        "subtotal": subtotal,
        "total": total,
        "capital_cost": capital_cost,
        "profit": profit,
        "item_count": sum(item.quantity or 0 for item in items),
        "items": [{
            "id": item.id,
            "product_id": item.product_id,
            "product_name": item.product_name,
            "quantity": item.quantity or 0,
            "unit_price": item.unit_price or 0,
            "unit_cost": item.unit_cost or 0,
            "line_total": (item.unit_price or 0) * (item.quantity or 0),
        } for item in items],
    }


def serialize_stock_receipt(receipt: models.BusinessStockReceipt) -> dict:
    items = receipt.items or []
    item_cost = sum((item.unit_cost or 0) * (item.quantity or 0) for item in items)
    return {
        "id": receipt.id,
        "code": receipt.code,
        "supplier_name": receipt.supplier_name,
        "extra_cost": receipt.extra_cost or 0,
        "note": receipt.note,
        "received_at": receipt.received_at,
        "created_at": receipt.created_at,
        "total_cost": item_cost + (receipt.extra_cost or 0),
        "total_quantity": sum(item.quantity or 0 for item in items),
        "items": [{
            "id": item.id,
            "product_id": item.product_id,
            "product_name": item.product.name if item.product else "Sản phẩm đã xóa",
            "quantity": item.quantity or 0,
            "unit_cost": item.unit_cost or 0,
        } for item in items],
    }


def serialize_ledger(ledger: models.BusinessLedger) -> dict:
    orders = [serialize_business_order(order) for order in (ledger.orders or []) if order.status != "cancelled"]
    expenses = sum(expense.amount or 0 for expense in (ledger.expenses or []))
    return {
        "id": ledger.id,
        "user_id": ledger.user_id,
        "name": ledger.name,
        "month": ledger.month,
        "opening_cash": ledger.opening_cash or 0,
        "note": ledger.note,
        "is_closed": ledger.is_closed,
        "order_count": len(orders),
        "revenue": sum(order["total"] for order in orders),
        "profit": sum(order["profit"] for order in orders) - expenses,
        "created_at": ledger.created_at,
    }

@app.on_event("startup")
def startup_event():
    # Khởi động tiến trình chống ngủ
    import threading
    threading.Thread(target=keep_alive_task, daemon=True).start()
    
    # Auto-migrate database to add email column if it's missing
    from database import SessionLocal
    from sqlalchemy import text
    db = SessionLocal()
    try:
        ensure_business_tables(db)
        db.execute(text("ALTER TABLE users ADD COLUMN email VARCHAR;"))
        db.commit()
    except Exception:
        db.rollback() # Column already exists or error
        
    try:
        db.execute(text("ALTER TABLE books ADD COLUMN display_order INTEGER DEFAULT 0;"))
        db.commit()
    except Exception:
        db.rollback()

    try:
        timestamp_type = "TIMESTAMP WITH TIME ZONE" if engine.dialect.name == "postgresql" else "DATETIME"
        db.execute(text(f"ALTER TABLE registration_codes ADD COLUMN created_at {timestamp_type};"))
        db.commit()
    except Exception:
        db.rollback()

    try:
        db.execute(text("UPDATE registration_codes SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;"))
        db.commit()
    except Exception as e:
        print(f"Error initializing registration code dates: {e}")
        db.rollback()

    try:
        # Initialize display_order if all are 0
        count_zero = db.execute(text("SELECT COUNT(*) FROM books WHERE display_order = 0")).scalar()
        total = db.execute(text("SELECT COUNT(*) FROM books")).scalar()
        if count_zero == total and total > 0:
            # Set display_order = row_number based on created_at DESC
            # SQLite doesn't support UPDATE ... FROM easily in older versions, so we do it in Python
            all_books = db.query(models.Book).order_by(models.Book.created_at.desc()).all()
            for i, b in enumerate(all_books):
                b.display_order = i + 1
            db.commit()
    except Exception as e:
        print(f"Error initializing display_order: {e}")
        db.rollback()
    finally:
        db.close()
        
    create_default_admin()
    migrate_sqlite_to_target_db()
    sync_local_disk_files_to_db()

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

def serialize_book_lightweight(b: models.Book, existing_files_set: Optional[set] = None) -> dict:
    has_file = True
    if not (b.external_url and b.external_url.strip()):
        has_in_db = existing_files_set is not None and ((b.id in existing_files_set) or (bool(b.drive_file_id) and b.drive_file_id in existing_files_set))
        if has_in_db:
            has_file = True
        elif not b.drive_file_id or not str(b.drive_file_id).strip():
            has_file = False
        elif b.drive_file_id.startswith("local_") and existing_files_set is not None:
            has_file = False
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
        "has_file": has_file,
        "created_at": b.created_at,
        "updated_at": b.updated_at,
    }

@app.get("/api/books", response_model=List[schemas.BookResponse])
def get_books(
    skip: int = 0,
    limit: int = 1000,
    search: Optional[str] = None,
    sort_by: Optional[str] = "newest",
    db: Session = Depends(get_db)
):
    query = db.query(models.Book).options(defer(models.Book.cover_url))
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(models.Book.title.ilike(search_term) | models.Book.author.ilike(search_term))
        
    if sort_by == "a-z":
        query = query.order_by(models.Book.title.asc())
    elif sort_by == "z-a":
        query = query.order_by(models.Book.title.desc())
    elif sort_by == "author":
        # Handle cases where author might be null to prevent them from sorting weirdly
        query = query.order_by(models.Book.author.asc(), models.Book.display_order.asc(), models.Book.created_at.desc())
    else: # newest
        query = query.order_by(models.Book.display_order.asc(), models.Book.created_at.desc())
        
    books = query.offset(skip).limit(limit).all()
    existing_file_keys = set(k[0] for k in db.query(models.BookFile.file_key).all() if k[0])
    existing_book_file_ids = set(k[0] for k in db.query(models.BookFile.book_id).all() if k[0])
    all_existing_files = existing_file_keys.union(existing_book_file_ids)
    return [serialize_book_lightweight(b, all_existing_files) for b in books]

@app.get("/api/books/{book_id}", response_model=schemas.BookResponse)
def get_book(book_id: str, db: Session = Depends(get_db)):
    book = db.query(models.Book).options(defer(models.Book.cover_url)).filter(models.Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    existing_file_keys = set(k[0] for k in db.query(models.BookFile.file_key).filter(models.BookFile.book_id == book_id).all() if k[0])
    has_bf = bool(existing_file_keys) or bool(db.query(models.BookFile.id).filter(models.BookFile.book_id == book_id).first())
    has_file = bool(book.external_url and book.external_url.strip()) or has_bf or (book.drive_file_id and not book.drive_file_id.startswith("local_"))
    res = serialize_book_lightweight(book)
    res["has_file"] = has_file
    return res

@app.post("/api/books/upload", response_model=schemas.BookResponse)
async def upload_book(
    file: UploadFile = File(...),
    title: Optional[str] = Form(""),
    external_url: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    try:
        contents = await file.read()
        filename = file.filename or "uploaded_book"
        filename_lower = filename.lower()
        
        # Nhận diện mime_type chính xác dựa trên Header + Magic Bytes + Đuôi file
        mime_type = file.content_type
        if filename_lower.endswith('.pdf') or contents.startswith(b'%PDF'):
            mime_type = 'application/pdf'
            extracted = extract_pdf_info(contents)
        elif filename_lower.endswith('.epub') or contents.startswith(b'PK') or 'epub' in (mime_type or '').lower():
            mime_type = 'application/epub+zip'
            extracted = extract_epub_info(contents)
        elif mime_type == 'application/pdf':
            extracted = extract_pdf_info(contents)
        elif mime_type in ['application/epub+zip', 'application/epub']:
            mime_type = 'application/epub+zip'
            extracted = extract_epub_info(contents)
        else:
            mime_type = mime_type or 'application/octet-stream'
            extracted = {}
            
        raw_name = filename.rsplit('.', 1)[0] if '.' in filename else filename
        final_title = extracted.get('title') or (title.strip() if title and title.strip() else None) or raw_name or "Sách chưa đặt tên"
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
                
        db_book = models.Book(
            title=final_title,
            author=final_author,
            summary=final_summary,
            cover_url=cover_b64,
            external_url=external_url,
            mime_type=mime_type,
            file_size=len(contents),
            progress=0
        )
        db.add(db_book)
        db.flush()

        drive_file_id = None
        if not external_url or not external_url.strip():
            file_stream = io.BytesIO(contents)
            drive_file_id = drive_service.upload_file(file_stream, filename, mime_type, db=db, book_id=db_book.id)
            db_book.drive_file_id = drive_file_id

        db.commit()
        db.refresh(db_book)
        
        return db_book
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Lỗi khi tải sách lên: {str(e)}")

def normalize_match_str(s: str) -> str:
    if not s:
        return ""
    s = unicodedata.normalize('NFD', str(s))
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = re.sub(r'[^a-zA-Z0-9]+', ' ', s).lower().strip()
    return s

def is_book_downloadable(b: models.Book, existing_file_keys: set, existing_book_file_ids: set, upload_dir: Optional[str] = None) -> tuple[bool, Optional[str]]:
    # 1. Có external link (Google Drive hoặc link ngoài hợp lệ)
    if b.external_url and str(b.external_url).strip():
        return True, None

    # 2. Không có file key
    if not b.drive_file_id or not str(b.drive_file_id).strip():
        return False, "Chưa có file hoặc liên kết tải"

    # 3. Cloudflare R2
    if b.drive_file_id.startswith("r2_"):
        return True, None

    # 4. Google Drive (không phải local_)
    if not b.drive_file_id.startswith("local_") and getattr(drive_service, 'use_gdrive', False):
        return True, None

    # 5. Local mode: Kiểm tra xem file có trong BookFile table (PostgreSQL) hoặc trên đĩa cục bộ không
    has_db_file = (b.drive_file_id in existing_file_keys) or (b.id in existing_book_file_ids)
    file_path = os.path.join(upload_dir, b.drive_file_id) if upload_dir else ""
    has_disk_file = os.path.exists(file_path) if file_path else False

    if has_db_file or has_disk_file:
        return True, None

    return False, "Chưa có file dữ liệu EPUB/PDF để tải về"

@app.get("/api/admin/books/check-files")
def check_book_files(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_admin_user)
):
    """
    Kiểm tra toàn bộ sách xem cuốn nào bị mất file hoặc chưa có file liên kết.
    """
    books = db.query(models.Book).all()
    broken_books = []
    
    # Lấy danh sách file_keys và book_ids đã lưu trong bảng BookFile
    existing_file_keys = set(k[0] for k in db.query(models.BookFile.file_key).all() if k[0])
    existing_book_file_ids = set(k[0] for k in db.query(models.BookFile.book_id).all() if k[0])
    upload_dir = getattr(drive_service, 'upload_dir', None)
    
    for b in books:
        # TỰ ĐỘNG ĐẨY LÊN DATABASE: Nếu file có trên đĩa cục bộ nhưng chưa có trong Database
        if b.drive_file_id and b.drive_file_id.startswith("local_") and upload_dir:
            has_db_file = (b.drive_file_id in existing_file_keys) or (b.id in existing_book_file_ids)
            file_path = os.path.join(upload_dir, b.drive_file_id)
            if os.path.exists(file_path) and not has_db_file:
                try:
                    with open(file_path, "rb") as f:
                        f_bytes = f.read()
                    bf = models.BookFile(
                        file_key=b.drive_file_id,
                        book_id=b.id,
                        filename=f"{b.title}.epub" if "epub" in (b.mime_type or "") else f"{b.title}.pdf",
                        mime_type=b.mime_type or "application/octet-stream",
                        file_data=f_bytes,
                        file_size=len(f_bytes)
                    )
                    db.add(bf)
                    db.commit()
                    existing_file_keys.add(b.drive_file_id)
                    existing_book_file_ids.add(b.id)
                except Exception:
                    db.rollback()

        is_avail, reason = is_book_downloadable(b, existing_file_keys, existing_book_file_ids, upload_dir)
        if not is_avail:
            cover = f"/api/books/cover/{b.id}" if b.cover_url else None
            broken_books.append({
                "id": b.id,
                "title": b.title,
                "author": b.author,
                "cover_url": cover,
                "reason": reason or "Chưa có file dữ liệu EPUB/PDF để tải về"
            })
                
    healthy_count = len(books) - len(broken_books)
    return {
        "total_books": len(books),
        "healthy_count": healthy_count,
        "broken_count": len(broken_books),
        "unlinked_count": len(broken_books),
        "broken_books": broken_books,
        "unlinked_books": broken_books
    }

@app.post("/api/admin/books/sync-files")
async def sync_book_files(
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_admin_user)
):
    """
    Thuật toán tự động đối chiếu và phục hồi file sách vĩnh viễn vào Database PostgreSQL.
    Giải quyết triệt để vấn đề mất file khi Render restart / redeploy.
    """
    if not files:
        raise HTTPException(status_code=400, detail="Không có file nào được gửi lên")

    all_books = db.query(models.Book).all()
    matched_books = []
    created_books = []
    already_matched_book_ids = set()

    for file in files:
        contents = await file.read()
        if not contents or len(contents) < 50:
            continue

        filename = file.filename or "book"
        name_no_ext, ext = os.path.splitext(filename)
        filename_clean = normalize_match_str(name_no_ext)
        mime_type = file.content_type or 'application/octet-stream'

        is_pdf = filename.lower().endswith('.pdf') or mime_type == 'application/pdf' or contents.startswith(b'%PDF')
        if is_pdf:
            mime_type = 'application/pdf'
            extracted = extract_pdf_info(contents)
        else:
            mime_type = 'application/epub+zip'
            extracted = extract_epub_info(contents)

        meta_title = extracted.get('title') or ""
        meta_author = extracted.get('author') or ""
        meta_cover = extracted.get('cover_b64')
        meta_summary = extracted.get('summary') or ""

        meta_title_clean = normalize_match_str(meta_title)
        meta_author_clean = normalize_match_str(meta_author)

        # Tìm kiếm cuốn sách phù hợp nhất trong cơ sở dữ liệu
        best_book = None
        best_score = 0

        for book in all_books:
            if book.id in already_matched_book_ids:
                continue

            book_title_clean = normalize_match_str(book.title)
            book_drive_clean = normalize_match_str(book.drive_file_id or '')
            book_author_clean = normalize_match_str(book.author or '')

            score = 0
            # 1. Khớp chính xác hoặc gần như chính xác với drive_file_id cũ
            if book_drive_clean and (filename_clean in book_drive_clean or book_drive_clean in filename_clean):
                score = max(score, 100)

            # 2. Khớp chính xác tiêu đề từ metadata EPUB/PDF
            if meta_title_clean and book_title_clean == meta_title_clean:
                score = max(score, 95)

            # 3. Khớp chính xác tên file và tiêu đề trong DB
            if filename_clean and book_title_clean == filename_clean:
                score = max(score, 90)

            # 4. Tên sách là chuỗi con của tên file hoặc ngược lại
            if book_title_clean and (book_title_clean in filename_clean or filename_clean in book_title_clean):
                score = max(score, 85)

            # 5. Khớp từ khóa tác giả + tên sách
            combined_file = f"{filename_clean} {meta_title_clean} {meta_author_clean}"
            combined_book = f"{book_title_clean} {book_author_clean}"
            file_tokens = set(combined_file.split())
            book_tokens = set(combined_book.split())
            if file_tokens and book_tokens:
                overlap = len(file_tokens.intersection(book_tokens))
                ratio = overlap / max(len(book_tokens), 1)
                if ratio >= 0.5:
                    score = max(score, int(60 + 35 * ratio))

            if score > best_score:
                best_score = score
                best_book = book

        # Nếu độ tin cậy >= 60, liên kết file với cuốn sách đã có
        if best_book and best_score >= 60:
            already_matched_book_ids.add(best_book.id)
            file_stream = io.BytesIO(contents)
            file_key = drive_service.upload_file(file_stream, filename, mime_type, db=db, book_id=best_book.id)

            best_book.drive_file_id = file_key
            best_book.file_size = len(contents)
            best_book.mime_type = mime_type

            # Cập nhật bìa nếu sách chưa có bìa hoặc bìa bị lỗi
            if meta_cover and (not best_book.cover_url or len(best_book.cover_url) < 100):
                best_book.cover_url = meta_cover

            # Cập nhật tác giả nếu chưa có
            if meta_author and meta_author != "Unknown Author" and (not best_book.author or best_book.author == "Unknown Author"):
                best_book.author = meta_author

            # Cập nhật tóm tắt nếu chưa có
            if meta_summary and not best_book.summary:
                best_book.summary = meta_summary

            matched_books.append({
                "id": best_book.id,
                "title": best_book.title,
                "author": best_book.author,
                "score": best_score,
                "filename": filename
            })
        else:
            # Không có sách nào trong DB khớp, tạo mới cuốn sách
            final_title = meta_title if meta_title.strip() else name_no_ext.replace("_", " ")
            final_author = meta_author if meta_author.strip() else "Unknown Author"

            new_book = models.Book(
                title=final_title,
                author=final_author,
                summary=meta_summary,
                cover_url=meta_cover,
                mime_type=mime_type,
                file_size=len(contents),
                progress=0
            )
            db.add(new_book)
            db.flush()

            file_stream = io.BytesIO(contents)
            file_key = drive_service.upload_file(file_stream, filename, mime_type, db=db, book_id=new_book.id)
            new_book.drive_file_id = file_key

            created_books.append({
                "id": new_book.id,
                "title": final_title,
                "author": final_author,
                "filename": filename
            })

    db.commit()

    return {
        "success": True,
        "total_files": len(files),
        "matched_count": len(matched_books),
        "created_count": len(created_books),
        "matched_books": matched_books,
        "created_books": created_books
    }

@app.post("/api/admin/books/{book_id}/upload-file")
async def upload_file_for_book(
    book_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_admin_user)
):
    """
    Tải lên và gắn file EPUB/PDF trực tiếp cho một cuốn sách cụ thể,
    lưu vĩnh viễn vào Database PostgreSQL.
    """
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Không tìm thấy cuốn sách này")
        
    contents = await file.read()
    if not contents or len(contents) < 50:
        raise HTTPException(status_code=400, detail="File không hợp lệ hoặc dung lượng quá nhỏ")
        
    filename = file.filename or f"{book.title}.epub"
    mime_type = file.content_type or 'application/octet-stream'
    if filename.lower().endswith('.pdf') or contents.startswith(b'%PDF'):
        mime_type = 'application/pdf'
    elif filename.lower().endswith('.epub'):
        mime_type = 'application/epub+zip'
        
    file_stream = io.BytesIO(contents)
    drive_file_id = drive_service.upload_file(file_stream, filename, mime_type, db=db, book_id=book.id)
    
    book.drive_file_id = drive_file_id
    book.mime_type = mime_type
    book.file_size = len(contents)
    db.commit()
    db.refresh(book)
    
    return {
        "success": True,
        "message": f"Đã nạp file thành công cho cuốn '{book.title}' và lưu vĩnh viễn vào hệ thống!",
        "book_id": book.id,
        "title": book.title,
        "drive_file_id": drive_file_id
    }

@app.put("/api/admin/books/reorder")
def reorder_books(
    req: schemas.BookReorderRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_admin_user)
):
    # Lấy các sách trong danh sách
    books = db.query(models.Book).filter(models.Book.id.in_(req.book_ids)).all()
    if not books:
        return {"message": "No books found"}
        
    # Tạo map id -> book
    book_map = {b.id: b for b in books}
    
    # Lấy ra danh sách display_order hiện tại của các sách này và sắp xếp tăng dần
    current_orders = sorted([b.display_order for b in books])
    
    # Gán lại display_order theo đúng thứ tự book_ids truyền lên
    for i, book_id in enumerate(req.book_ids):
        if book_id in book_map:
            book_map[book_id].display_order = current_orders[i]
            
    db.commit()
    return {"message": "Reordered successfully"}

def normalize_author_py(author: Optional[str]) -> str:
    if not author:
        return ""
    s = author.lower().strip()
    s = re.sub(r"[.,\/#!$%\^&\*;:{}=\-_`~()\[\]\"\']", " ", s)
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.replace("đ", "d").replace("Đ", "d")
    tokens = sorted(list(set([w for w in s.split() if w])))
    return " ".join(tokens)

def normalize_title_py(title: Optional[str]) -> str:
    if not title:
        return ""
    s = title.lower().strip()
    s = re.sub(r"[.,\/#!$%\^&\*;:{}=\-_`~()\[\]\"\']", " ", s)
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.replace("đ", "d").replace("Đ", "d")
    return " ".join([w for w in s.split() if w])

@app.get("/api/admin/books/duplicates")
def get_duplicate_books(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_admin_user)
):
    books = db.query(models.Book).options(defer(models.Book.cover_url)).all()
    groups = {}
    for b in books:
        n_title = normalize_title_py(b.title)
        if not n_title:
            continue
        n_author = normalize_author_py(b.author)
        key = f"{n_title}:::{n_author}"
        if key not in groups:
            groups[key] = []
        groups[key].append(serialize_book_lightweight(b))
    
    dup_groups = [
        {
            "key": k,
            "title": g[0]["title"],
            "author": g[0].get("author") or "Chưa rõ tác giả",
            "count": len(g),
            "books": g
        }
        for k, g in groups.items() if len(g) >= 2
    ]
    total_redundant = sum(len(g["books"]) - 1 for g in dup_groups)
    return {
        "groups": dup_groups,
        "total_groups": len(dup_groups),
        "total_redundant": total_redundant
    }

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
    import book_search_service
    try:
        books = await book_search_service.search_all_sources(q, source=source)
        return books
    except Exception as e:
        print(f"[external_search error]: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@app.get("/api/admin/telegram/status")
async def get_telegram_status_endpoint(current_user: models.User = Depends(auth.get_current_admin_user)):
    import telegram_client
    return await telegram_client.get_telegram_status()

@app.post("/api/external-import", response_model=schemas.BookResponse)
async def external_import(
    request: schemas.ExternalImportRequest, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    import io
    file_bytes = None
    filename = "book"

    try:
        if request.id.startswith('openlibrary|') or request.id.startswith('ia|'):
            import book_search_service
            file_bytes, filename = book_search_service.download_openlibrary_book(request.id)
        else:
            import telegram_client
            file_bytes, filename = await telegram_client.download_book_via_telegram(request.id)
    except Exception as e:
        err_str = str(e)
        if err_str.startswith("MANUAL_DOWNLOAD|"):
            url = err_str.split("|", 1)[1]
            return {"status": "manual_download", "external_url": url, "id": "manual", "title": request.title, "progress": 0}
        raise HTTPException(status_code=500, detail=str(e))
        
    try:
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
        
        db_book = None
        if hasattr(request, 'target_book_id') and request.target_book_id:
            db_book = db.query(models.Book).filter(models.Book.id == request.target_book_id).first()
            
        if not db_book:
            # Kiểm tra xem có sách nào trong thư viện đang bị mất file trùng tên không
            target_title_norm = normalize_match_str(final_title)
            candidates = db.query(models.Book).all()
            for cand in candidates:
                if normalize_match_str(cand.title) == target_title_norm:
                    db_book = cand
                    break

        if db_book:
            db_book.file_size = len(file_bytes)
            db_book.mime_type = mime_type
            if cover_b64 and (not db_book.cover_url or len(db_book.cover_url) < 100):
                db_book.cover_url = cover_b64
            if final_author != "Unknown Author" and (not db_book.author or db_book.author == "Unknown Author"):
                db_book.author = final_author
        else:
            db_book = models.Book(
                title=final_title,
                author=final_author,
                summary="",
                cover_url=cover_b64,
                mime_type=mime_type,
                file_size=len(file_bytes),
                progress=0
            )
            db.add(db_book)
            db.flush()

        file_stream = io.BytesIO(file_bytes)
        drive_file_id = drive_service.upload_file(file_stream, filename, mime_type, db=db, book_id=db_book.id)
        db_book.drive_file_id = drive_file_id
        
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

@app.post("/api/books/{book_id}/re-extract", response_model=schemas.BookResponse)
def re_extract_book_info(book_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    file_bytes = None
    if book.drive_file_id:
        file_bytes = drive_service.download_file_bytes(book.drive_file_id, db=db, book_id=book.id)
        
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Không tìm thấy file nguồn để trích xuất lại")
        
    is_pdf = True if (book.mime_type == 'application/pdf' or file_bytes.startswith(b'%PDF')) else False
    extracted = extract_pdf_info(file_bytes) if is_pdf else extract_epub_info(file_bytes)
    
    if extracted.get('cover_b64'):
        book.cover_url = extracted.get('cover_b64')
    if extracted.get('title'):
        book.title = extracted.get('title')
    if extracted.get('author') and extracted.get('author') != 'Unknown Author':
        book.author = extracted.get('author')
    if extracted.get('summary'):
        book.summary = extracted.get('summary')
        
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
    return drive_service.stream_download(book.drive_file_id, filename, book.mime_type, file_size=book.file_size, db=db, book_id=book.id)

import socket
import random
import time

kindle_pins = {}

def get_local_ip():
    try:
        hostname = socket.gethostname()
        ip_list = socket.gethostbyname_ex(hostname)[2]
        
        # 1. Ưu tiên IP Wi-Fi gia đình chuẩn (192.168.x.x)
        for ip in ip_list:
            if ip.startswith("192.168."):
                return ip
                
        # 2. Thử các IP LAN khác (loại bỏ cạc mạng ảo Radmin VPN 10.29.x.x)
        for ip in ip_list:
            if (ip.startswith("172.") or ip.startswith("10.")) and not ip.startswith("10.29."):
                return ip

        # 3. Fallback UDP Socket
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'

def clean_expired_pins():
    now = time.time()
    expired = [k for k, v in list(kindle_pins.items()) if v.get('expires_at', 0) < now]
    for k in expired:
        del kindle_pins[k]

@app.post("/api/kindle/generate-pin/{book_id}")
def generate_kindle_pin(book_id: str, db: Session = Depends(get_db)):
    clean_expired_pins()
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
        
    pin = "8492"
    for _ in range(100):
        candidate = f"{random.randint(1000, 9999)}"
        if candidate not in kindle_pins:
            pin = candidate
            break
            
    kindle_pins[pin] = {
        "book_id": book_id,
        "title": book.title,
        "expires_at": time.time() + 300
    }
    
    local_ip = get_local_ip()
    port = os.getenv("PORT", "8000")
    kindle_url = f"http://{local_ip}:{port}/k"
    
    return {
        "pin": pin,
        "expires_in": 300,
        "local_ip": local_ip,
        "kindle_url": kindle_url,
        "book_title": book.title
    }

@app.get("/api/kindle/verify-pin/{pin}")
def verify_kindle_pin(pin: str):
    clean_expired_pins()
    clean_pin = pin.strip()
    if clean_pin not in kindle_pins:
        raise HTTPException(status_code=400, detail="Mã PIN không đúng hoặc đã hết hạn (5 phút).")
    return {"valid": True, "title": kindle_pins[clean_pin].get("title", "")}

@app.get("/api/kindle/download")
def download_by_pin_query(pin: str, db: Session = Depends(get_db)):
    return download_by_pin(pin, db)

@app.get("/api/kindle/download-by-pin/{pin}")
def download_by_pin(pin: str, db: Session = Depends(get_db)):
    clean_expired_pins()
    clean_pin = pin.strip()
    if clean_pin not in kindle_pins:
        raise HTTPException(status_code=400, detail="Mã PIN không hợp lệ hoặc đã hết hạn (5 phút).")
        
    item = kindle_pins[clean_pin]
    book_id = item["book_id"]
    
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Sách không tồn tại")
        
    # Handle external link download redirect
    if book.external_url:
        url = book.external_url
        file_id = None
        match_d = re.search(r'/file/d/([a-zA-Z0-9_-]+)', url)
        if match_d:
            file_id = match_d.group(1)
        else:
            match_id = re.search(r'[?&]id=([a-zA-Z0-9_-]+)', url)
            if match_id:
                file_id = match_id.group(1)
                
        if file_id:
            direct_download_url = f"https://drive.google.com/uc?export=download&id={file_id}"
            return RedirectResponse(url=direct_download_url)
            
        return RedirectResponse(url=url)

    if not book.drive_file_id:
        raise HTTPException(status_code=400, detail="Sách này không có file đính kèm để tải về.")
    
    filename = f"{book.title}.pdf" if book.mime_type == 'application/pdf' else f"{book.title}.epub"
    return drive_service.stream_download(book.drive_file_id, filename, book.mime_type, file_size=book.file_size, db=db, book_id=book.id)

@app.get("/k", response_class=HTMLResponse)
def kindle_receiver_html():
    html_content = """<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BookCase Receiver - Máy Đọc Sách</title>
    <style>
        * { box-sizing: border-box; }
        body {
            background-color: #FFFFFF;
            color: #000000;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            margin: 0;
            padding: 20px;
            text-align: center;
        }
        .container {
            max-width: 480px;
            margin: 0 auto;
            padding-top: 10px;
        }
        h1 {
            font-size: 24px;
            font-weight: bold;
            border-bottom: 3px solid #000000;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        p {
            font-size: 15px;
            line-height: 1.4;
            margin-bottom: 20px;
        }
        input[type="text"] {
            font-size: 36px;
            text-align: center;
            letter-spacing: 8px;
            font-weight: bold;
            width: 80%;
            padding: 12px;
            border: 3px solid #000000;
            border-radius: 8px;
            background-color: #FFFFFF;
            color: #000000;
            margin-bottom: 15px;
        }
        .btn-submit {
            background-color: #000000;
            color: #FFFFFF;
            font-size: 18px;
            font-weight: bold;
            padding: 14px 28px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            width: 85%;
            margin-top: 5px;
            display: inline-block;
            text-decoration: none;
        }
        .btn-direct {
            background-color: #15803D;
            color: #FFFFFF;
            font-size: 16px;
            font-weight: bold;
            padding: 14px 20px;
            border: none;
            border-radius: 8px;
            display: none;
            width: 85%;
            margin: 15px auto 0 auto;
            text-decoration: none;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .tip {
            margin-top: 30px;
            border-top: 1px solid #CCCCCC;
            padding-top: 15px;
            font-size: 13px;
            color: #444444;
        }
        .error-box {
            color: #7f1d1d;
            background-color: #fef2f2;
            border: 2px solid #991b1b;
            padding: 10px;
            border-radius: 6px;
            margin-bottom: 15px;
            font-weight: bold;
            font-size: 14px;
            display: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>BookCase Kindle Receiver</h1>
        <p>Nhập <strong>mã PIN 4 số</strong> hiển thị trên máy tính/điện thoại để nhận sách trực tiếp:</p>
        
        <div id="errorBox" class="error-box"></div>

        <form action="/api/kindle/download" method="GET">
            <input type="text" name="pin" maxlength="4" placeholder="0 0 0 0" pattern="[0-9]*" inputmode="numeric" required autofocus autocomplete="off" />
            <br>
            <button type="submit" class="btn-submit">📥 TẢI SÁCH NGAY</button>
        </form>

        <div class="tip">
            💡 <strong>Mẹo:</strong> Bấm nút Menu (⋮) trên trình duyệt máy đọc sách và chọn <strong>Add Bookmark (Lưu Dấu Trang)</strong> để lần sau mở nhanh!
        </div>
    </div>
</body>
</html>"""
    return HTMLResponse(content=html_content)

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
def get_collection(
    collection_id: str, 
    skip: int = 0, 
    limit: int = 1000, 
    db: Session = Depends(get_db)
):
    collection = db.query(models.Collection).filter(models.Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    total_books = db.query(models.CollectionBook).filter(models.CollectionBook.collection_id == collection_id).count()
    
    collection_books = db.query(models.CollectionBook)\
        .filter(models.CollectionBook.collection_id == collection_id)\
        .offset(skip).limit(limit).all()
        
    books = [serialize_book_lightweight(cb.book) for cb in collection_books if cb.book]
        
    return {
        "id": collection.id,
        "name": collection.name,
        "description": collection.description,
        "created_at": collection.created_at,
        "book_count": total_books,
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
        # Cryptographically secure, 60-bit invite key. Avoid ambiguous chars
        # (0/O and 1/I) when an admin reads the key to a user.
        alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        code_str = "BC-" + ''.join(secrets.choice(alphabet) for _ in range(12))
        exists = db.query(models.RegistrationCode).filter(models.RegistrationCode.code == code_str).first()
        if not exists:
            break
            
    reg_code = models.RegistrationCode(
        code=code_str,
        created_by=current_user.username,
        created_at=datetime.now(timezone.utc),
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
        alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        code_str = "BC-" + ''.join(secrets.choice(alphabet) for _ in range(12))
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
    username = user.username.strip()
    email = user.email.strip().lower()
    # Check registration code
    if not user.registration_code:
        raise HTTPException(status_code=400, detail="Vui lòng cung cấp mã đăng ký do Admin cấp.")
        
    # Lock the row so two simultaneous requests cannot redeem one key twice.
    reg_code = db.query(models.RegistrationCode).filter(
        models.RegistrationCode.code == user.registration_code.strip().upper(),
        models.RegistrationCode.is_used == False
    ).with_for_update().first()
    if not reg_code:
        raise HTTPException(status_code=400, detail="Mã đăng ký không hợp lệ hoặc đã được sử dụng.")

    # Check username
    db_user_by_username = db.query(models.User).filter(models.User.username == username).first()
    if db_user_by_username:
        raise HTTPException(status_code=400, detail="Tên đăng nhập đã tồn tại.")
        
    db_user_by_email = db.query(models.User).filter(func.lower(models.User.email) == email).first()
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
    reg_code.used_by_username = username
    
    hashed_password = auth.get_password_hash(user.password)
    # Registration keys only create normal users. Never trust a public payload
    # to grant the admin role.
    new_user = models.User(username=username, email=email, password_hash=hashed_password, role="user")
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
                # Cố gắng dùng Service Account / Local DB
                file_bytes = drive_service.download_file_bytes(file_id, db=db, book_id=book.id)
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

@app.get("/api/admin/check-file-links", response_model=schemas.FileCheckResponse)
def check_file_links(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    res = check_book_files(db=db, current_user=current_user)
    return schemas.FileCheckResponse(**res)

@app.post("/api/admin/repair-file-links")
async def repair_file_links(
    files: List[UploadFile] = File(...),
    book_ids: Optional[List[str]] = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_admin_user)
):
    repaired_count = 0
    matched_books = []
    
    all_books = db.query(models.Book).all()
    existing_file_keys = set(k[0] for k in db.query(models.BookFile.file_key).all() if k[0])
    existing_book_file_ids = set(k[0] for k in db.query(models.BookFile.book_id).all() if k[0])
    upload_dir = getattr(drive_service, 'upload_dir', None)

    # Lấy danh sách các cuốn sách chưa có file dữ liệu để tải
    unlinked_books = []
    for b in all_books:
        is_avail, _ = is_book_downloadable(b, existing_file_keys, existing_book_file_ids, upload_dir)
        if not is_avail:
            unlinked_books.append(b)
            
    unlinked_map = {b.id: b for b in unlinked_books}
    already_matched_ids = set()

    for idx, file in enumerate(files):
        try:
            contents = await file.read()
            if not contents or len(contents) < 50:
                continue
                
            filename = file.filename or "book"
            name_no_ext, ext = os.path.splitext(filename)
            filename_clean = normalize_match_str(name_no_ext)
            mime_type = file.content_type or 'application/octet-stream'
            
            is_pdf = filename.lower().endswith('.pdf') or contents.startswith(b'%PDF')
            if is_pdf:
                mime_type = 'application/pdf'
                extracted = extract_pdf_info(contents)
            else:
                mime_type = 'application/epub+zip'
                extracted = extract_epub_info(contents)
                
            meta_title = extracted.get('title') or ""
            meta_author = extracted.get('author') or ""
            meta_cover = extracted.get('cover_b64')
            meta_summary = extracted.get('summary') or ""
            
            meta_title_clean = normalize_match_str(meta_title)
            meta_author_clean = normalize_match_str(meta_author)
            
            target_book = None
            if book_ids and idx < len(book_ids) and book_ids[idx] in unlinked_map:
                target_book = unlinked_map[book_ids[idx]]
            else:
                # Đối soát thông minh với các cuốn sách đang thiếu file
                best_book = None
                best_score = 0
                for b in unlinked_books:
                    if b.id in already_matched_ids:
                        continue
                    b_title_clean = normalize_match_str(b.title)
                    b_author_clean = normalize_match_str(b.author or '')
                    b_drive_clean = normalize_match_str(b.drive_file_id or '')
                    
                    score = 0
                    if b_drive_clean and (filename_clean in b_drive_clean or b_drive_clean in filename_clean):
                        score = max(score, 100)
                    if meta_title_clean and b_title_clean == meta_title_clean:
                        score = max(score, 95)
                    if filename_clean and b_title_clean == filename_clean:
                        score = max(score, 90)
                    if b_title_clean and (b_title_clean in filename_clean or filename_clean in b_title_clean):
                        score = max(score, 85)
                    
                    combined_file = f"{filename_clean} {meta_title_clean} {meta_author_clean}"
                    combined_book = f"{b_title_clean} {b_author_clean}"
                    f_toks = set(combined_file.split())
                    b_toks = set(combined_book.split())
                    if f_toks and b_toks:
                        overlap = len(f_toks.intersection(b_toks))
                        ratio = overlap / max(len(b_toks), 1)
                        if ratio >= 0.5:
                            score = max(score, int(60 + 35 * ratio))
                            
                    if score > best_score:
                        best_score = score
                        best_book = b
                        
                if best_book and best_score >= 50:
                    target_book = best_book

            if target_book:
                already_matched_ids.add(target_book.id)
                file_stream = io.BytesIO(contents)
                # Lưu vĩnh viễn vào BookFile PostgreSQL
                drive_file_id = drive_service.upload_file(file_stream, filename, mime_type, db=db, book_id=target_book.id)
                
                target_book.drive_file_id = drive_file_id
                target_book.mime_type = mime_type
                target_book.file_size = len(contents)
                if meta_cover and (not target_book.cover_url or len(target_book.cover_url) < 100):
                    target_book.cover_url = meta_cover
                if meta_author and meta_author != "Unknown Author" and (not target_book.author or target_book.author == "Unknown Author"):
                    target_book.author = meta_author
                if meta_summary and not target_book.summary:
                    target_book.summary = meta_summary
                    
                db.commit()
                repaired_count += 1
                matched_books.append(target_book.title)
        except Exception as e:
            print(f"Lỗi ghép nối file {file.filename}: {e}")
            
    return {"message": f"Đã ghép nối và lưu vĩnh viễn {repaired_count} file vào Database PostgreSQL!", "repaired_count": repaired_count, "matched_books": matched_books}


# --- MY BOOKS & QUOTES API ---

@app.get("/api/users/me/books", response_model=List[schemas.UserBookResponse])
def get_my_books(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    user_books = db.query(models.UserBook).filter(models.UserBook.user_id == current_user.id).order_by(models.UserBook.added_at.desc()).all()
    # We may need to manually fetch book details for each user_book to comply with schema
    for ub in user_books:
        if ub.book_id:
            ub.book = db.query(models.Book).options(defer(models.Book.cover_url)).filter(models.Book.id == ub.book_id).first()
    return user_books

@app.post("/api/users/me/books", response_model=schemas.UserBookResponse)
def add_my_book(book_in: schemas.UserBookCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ub = models.UserBook(
        user_id=current_user.id,
        book_id=book_in.book_id,
        custom_title=book_in.custom_title,
        custom_author=book_in.custom_author,
        custom_cover_url=book_in.custom_cover_url
    )
    db.add(ub)
    db.commit()
    db.refresh(ub)
    if ub.book_id:
        ub.book = db.query(models.Book).options(defer(models.Book.cover_url)).filter(models.Book.id == ub.book_id).first()
    return ub

@app.delete("/api/users/me/books/{user_book_id}")
def delete_my_book(user_book_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ub = db.query(models.UserBook).filter(models.UserBook.id == user_book_id, models.UserBook.user_id == current_user.id).first()
    if not ub:
        raise HTTPException(status_code=404, detail="User book not found")
    db.delete(ub)
    db.commit()
    return {"message": "Deleted successfully"}

@app.get("/api/users/me/quotes", response_model=List[schemas.GlobalQuoteResponse])
def get_all_my_quotes(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    user_books = db.query(models.UserBook).filter(models.UserBook.user_id == current_user.id).all()
    user_book_ids = [ub.id for ub in user_books]
    
    if not user_book_ids:
        return []
        
    quotes = db.query(models.Quote).filter(models.Quote.user_book_id.in_(user_book_ids)).order_by(models.Quote.created_at.desc()).all()
    
    # Map quotes with book details
    ub_map = {ub.id: ub for ub in user_books}
    results = []
    for q in quotes:
        ub = ub_map.get(q.user_book_id)
        book_title = ub.custom_title or (ub.book.title if ub and ub.book else "Unknown Book")
        book_author = ub.custom_author or (ub.book.author if ub and ub.book else "Unknown Author")
        book_cover = ub.custom_cover_url or (ub.book.cover_url if ub and ub.book else None)
        
        results.append(schemas.GlobalQuoteResponse(
            id=q.id,
            user_book_id=q.user_book_id,
            image_url=q.image_url,
            text_content=q.text_content,
            page_number=q.page_number,
            created_at=q.created_at,
            book_title=book_title,
            book_author=book_author,
            book_cover_url=book_cover
        ))
    return results

@app.get("/api/users/me/books/{user_book_id}/quotes", response_model=List[schemas.QuoteResponse])
def get_my_book_quotes(user_book_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ub = db.query(models.UserBook).filter(models.UserBook.id == user_book_id, models.UserBook.user_id == current_user.id).first()
    if not ub:
        raise HTTPException(status_code=404, detail="User book not found")
    quotes = db.query(models.Quote).filter(models.Quote.user_book_id == user_book_id).order_by(models.Quote.created_at.desc()).all()
    return quotes

@app.post("/api/users/me/books/{user_book_id}/quotes", response_model=schemas.QuoteResponse)
async def add_my_book_quote(user_book_id: str, quote_in: schemas.QuoteCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ub = db.query(models.UserBook).filter(models.UserBook.id == user_book_id, models.UserBook.user_id == current_user.id).first()
    if not ub:
        raise HTTPException(status_code=404, detail="User book not found")
    
    image_url = quote_in.image_url or ""
    imgbb_key = os.getenv("IMGBB_API_KEY")
    if imgbb_key and image_url.startswith("data:image"):
        try:
            b64_data = image_url.split(",")[1]
            url = "https://api.imgbb.com/1/upload"
            data = urllib.parse.urlencode({'key': imgbb_key, 'image': b64_data}).encode('utf-8')
            req = urllib.request.Request(url, data=data)
            with urllib.request.urlopen(req, timeout=5) as response:
                res = json.loads(response.read().decode('utf-8'))
                img_url = res.get("data", {}).get("url")
                if img_url:
                    image_url = img_url
        except Exception as e:
            print(f"ImgBB Upload Failed for Quote: {e}")

    new_quote = models.Quote(
        id=models.generate_uuid(),
        user_book_id=user_book_id,
        image_url=image_url or None,
        text_content=quote_in.text_content or "",
        page_number=quote_in.page_number
    )
    try:
        db.add(new_quote)
        db.commit()
        db.refresh(new_quote)
        return new_quote
    except Exception as e:
        db.rollback()
        print(f"Database error saving quote: {e}")
        # Schema column fallback in case page_number column is missing in older remote DB
        try:
            new_quote.page_number = None
            db.add(new_quote)
            db.commit()
            db.refresh(new_quote)
            return new_quote
        except Exception as e2:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Không thể lưu trích dẫn vào cơ sở dữ liệu: {str(e2)}")

@app.post("/api/users/me/books/{user_book_id}/quotes/batch", response_model=List[schemas.QuoteResponse])
async def add_my_book_quotes_batch(user_book_id: str, payload: schemas.QuoteBatchCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ub = db.query(models.UserBook).filter(models.UserBook.id == user_book_id, models.UserBook.user_id == current_user.id).first()
    if not ub:
        raise HTTPException(status_code=404, detail="User book not found")
    
    image_url = payload.image_url or None
    imgbb_key = os.getenv("IMGBB_API_KEY")
    if imgbb_key and image_url and image_url.startswith("data:image"):
        try:
            b64_data = image_url.split(",")[1]
            url = "https://api.imgbb.com/1/upload"
            data = urllib.parse.urlencode({'key': imgbb_key, 'image': b64_data}).encode('utf-8')
            req = urllib.request.Request(url, data=data)
            with urllib.request.urlopen(req, timeout=5) as response:
                res = json.loads(response.read().decode('utf-8'))
                img_url = res.get("data", {}).get("url")
                if img_url:
                    image_url = img_url
        except Exception as e:
            print(f"ImgBB Batch Upload Warning: {e}")

    quote_entities = []
    if payload.quotes:
        for item in payload.quotes:
            if item.text_content and item.text_content.strip():
                quote_entities.append(models.Quote(
                    id=models.generate_uuid(),
                    user_book_id=user_book_id,
                    image_url=image_url,
                    text_content=item.text_content.strip(),
                    page_number=item.page_number
                ))
    
    # If no text quotes but there is an image, save one image quote
    if not quote_entities and image_url:
        quote_entities.append(models.Quote(
            id=models.generate_uuid(),
            user_book_id=user_book_id,
            image_url=image_url,
            text_content="",
            page_number=None
        ))

    if not quote_entities:
        raise HTTPException(status_code=400, detail="Không có nội dung trích dẫn hợp lệ để lưu.")

    try:
        db.add_all(quote_entities)
        db.commit()
        for q in quote_entities:
            db.refresh(q)
        return quote_entities
    except Exception as e:
        db.rollback()
        print(f"Database error saving batch quotes: {e}")
        try:
            for q in quote_entities:
                q.page_number = None
            db.add_all(quote_entities)
            db.commit()
            for q in quote_entities:
                db.refresh(q)
            return quote_entities
        except Exception as e2:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Lỗi khi lưu danh sách trích dẫn vào cơ sở dữ liệu: {str(e2)}")

@app.post("/api/ocr/scan")
async def scan_image_ocr(payload: dict, current_user: models.User = Depends(auth.get_current_user)):
    image_base64 = payload.get("image_base64", "")
    client_api_key = payload.get("api_key", "")
    
    gemini_key = client_api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    
    if not gemini_key:
        raise HTTPException(status_code=400, detail="Chưa có Google Gemini API Key. Bạn có thể nhập API Key miễn phí từ Google AI Studio.")

    # Clean base64 data
    clean_b64 = image_base64
    mime_type = "image/jpeg"
    if "," in image_base64:
        header, clean_b64 = image_base64.split(",", 1)
        if "png" in header:
            mime_type = "image/png"
        elif "webp" in header:
            mime_type = "image/webp"

    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
        prompt = (
            "Bạn là công cụ OCR tiếng Việt siêu chính xác chuyên đọc sách. "
            "Hãy đọc và trích xuất toàn bộ văn bản trong bức ảnh trang sách này. "
            "Yêu cầu: "
            "1. Giữ nguyên 100% từng từ ngữ, câu chữ, dấu câu tiếng Việt chuẩn ngữ pháp, không thêm bớt, không bịa đặt. "
            "2. Tự động nhận diện số trang nếu có (thường ở đầu hoặc chân trang). "
            "3. Tách các câu văn/đoạn văn thành mảng danh sách sentences. "
            "4. Trả về DUY NHẤT một chuỗi JSON hợp lệ với cấu trúc: "
            "{\"full_text\": \"toàn bộ nội dung văn bản\", \"page_number\": 34, \"sentences\": [\"câu 1\", \"câu 2\"]}. "
            "Không kèm theo bất kỳ giải thích hay markdown code block nào."
        )
        
        req_body = {
            "contents": [{
                "parts": [
                    {"text": prompt},
                    {"inline_data": {"mime_type": mime_type, "data": clean_b64}}
                ]
            }],
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": 0.1
            }
        }
        
        req_data = json.dumps(req_body).encode('utf-8')
        req = urllib.request.Request(
            url, 
            data=req_data, 
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        
        with urllib.request.urlopen(req, timeout=15) as response:
            res_json = json.loads(response.read().decode('utf-8'))
            text_result = res_json["candidates"][0]["content"]["parts"][0]["text"]
            data = json.loads(text_result)
            return data
            
    except Exception as e:
        print(f"Gemini OCR Error: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi khi quét bằng Gemini AI: {str(e)}")

@app.delete("/api/users/me/quotes/{quote_id}")
def delete_my_quote(quote_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    quote = db.query(models.Quote).join(models.UserBook).filter(models.Quote.id == quote_id, models.UserBook.user_id == current_user.id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    db.delete(quote)
    db.commit()
    return {"message": "Deleted quote successfully"}


# ==========================================
# --- BOOK REVIEWS, RATINGS & READER INSIGHTS API ---
# ==========================================

def serialize_review(review: models.BookReview, db: Session) -> dict:
    username = review.user.username if review.user else "Độc giả"
    book_title = None
    book_author = None
    book_cover_url = None
    
    if review.book:
        book_title = review.book.title
        book_author = review.book.author
        book_cover_url = f"/api/books/cover/{review.book.id}"
    elif review.user_book:
        book_title = review.user_book.custom_title or (review.user_book.book.title if review.user_book.book else "Sách cá nhân")
        book_author = review.user_book.custom_author or (review.user_book.book.author if review.user_book.book else "Chưa rõ")
        book_cover_url = review.user_book.custom_cover_url or (f"/api/books/cover/{review.user_book.book.id}" if review.user_book.book else None)

    return {
        "id": review.id,
        "user_id": review.user_id,
        "book_id": review.book_id,
        "user_book_id": review.user_book_id,
        "rating": review.rating,
        "reading_status": review.reading_status or "completed",
        "progress_percent": review.progress_percent if review.progress_percent is not None else 100,
        "review_title": review.review_title,
        "review_text": review.review_text,
        "key_takeaway": review.key_takeaway,
        "favorite_quote": review.favorite_quote,
        "tags": review.tags,
        "created_at": review.created_at,
        "updated_at": review.updated_at,
        "username": username,
        "book_title": book_title,
        "book_author": book_author,
        "book_cover_url": book_cover_url
    }

@app.get("/api/books/ratings/batch")
def get_books_ratings_batch(db: Session = Depends(get_db)):
    """Lấy điểm đánh giá trung bình và số lượt review cho tất cả sách theo batch gọn nhẹ"""
    reviews = db.query(models.BookReview.book_id, models.BookReview.rating).filter(models.BookReview.book_id.isnot(None)).all()
    stats = {}
    for book_id, rating in reviews:
        if not book_id:
            continue
        if book_id not in stats:
            stats[book_id] = {"sum": 0, "count": 0}
        stats[book_id]["sum"] += rating
        stats[book_id]["count"] += 1
    
    result = {}
    for b_id, s in stats.items():
        result[b_id] = {
            "average_rating": round(s["sum"] / s["count"], 1) if s["count"] > 0 else 0.0,
            "count": s["count"]
        }
    return result

@app.get("/api/books/{book_id}/rating-summary", response_model=schemas.BookRatingSummaryResponse)
def get_book_rating_summary(book_id: str, db: Session = Depends(get_db)):
    """Lấy chi tiết thống kê rating và danh sách nhận xét, insight của một cuốn sách (Public)"""
    reviews = db.query(models.BookReview).filter(models.BookReview.book_id == book_id).order_by(models.BookReview.created_at.desc()).all()
    total = len(reviews)
    avg = round(sum(r.rating for r in reviews) / total, 1) if total > 0 else 0.0
    dist = {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}
    for r in reviews:
        star_key = str(r.rating)
        dist[star_key] = dist.get(star_key, 0) + 1
    
    serialized_reviews = [serialize_review(r, db) for r in reviews]
    return {
        "book_id": book_id,
        "average_rating": avg,
        "total_reviews": total,
        "rating_distribution": dist,
        "reviews": serialized_reviews
    }

@app.get("/api/books/{book_id}/my-review")
def get_my_review_for_book(book_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Lấy review & insight của chính người dùng hiện tại đối với cuốn sách này"""
    review = db.query(models.BookReview).filter(
        models.BookReview.book_id == book_id,
        models.BookReview.user_id == current_user.id
    ).first()
    if not review:
        return None
    return serialize_review(review, db)

@app.post("/api/books/{book_id}/reviews", response_model=schemas.BookReviewResponse)
def create_or_update_book_review(
    book_id: str, 
    review_in: schemas.BookReviewCreate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    """Đánh giá sách & đúc kết Insight cốt lõi (Upsert)"""
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Không tìm thấy sách")
    
    existing = db.query(models.BookReview).filter(
        models.BookReview.book_id == book_id,
        models.BookReview.user_id == current_user.id
    ).first()

    valid_rating = max(1, min(5, review_in.rating))
    valid_progress = max(0, min(100, review_in.progress_percent if review_in.progress_percent is not None else 100))
    status = review_in.reading_status or ("completed" if valid_progress >= 100 else "reading")

    if existing:
        existing.rating = valid_rating
        existing.reading_status = status
        existing.progress_percent = valid_progress
        existing.review_title = review_in.review_title
        existing.review_text = review_in.review_text
        existing.key_takeaway = review_in.key_takeaway
        existing.favorite_quote = review_in.favorite_quote
        existing.tags = review_in.tags
        db.commit()
        db.refresh(existing)
        return serialize_review(existing, db)
    else:
        new_review = models.BookReview(
            id=models.generate_uuid(),
            user_id=current_user.id,
            book_id=book_id,
            rating=valid_rating,
            reading_status=status,
            progress_percent=valid_progress,
            review_title=review_in.review_title,
            review_text=review_in.review_text,
            key_takeaway=review_in.key_takeaway,
            favorite_quote=review_in.favorite_quote,
            tags=review_in.tags
        )
        db.add(new_review)
        db.commit()
        db.refresh(new_review)
        return serialize_review(new_review, db)

@app.get("/api/users/me/insights", response_model=schemas.ReaderDashboardResponse)
def get_my_reader_insights(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Lấy toàn bộ chỉ số, thống kê thói quen, bài học cốt lõi cho Không Gian Đọc Sách của User"""
    reviews = db.query(models.BookReview).filter(models.BookReview.user_id == current_user.id).order_by(models.BookReview.created_at.desc()).all()
    
    total_completed = 0
    currently_reading = 0
    want_to_read = 0
    ratings = []
    rating_dist = {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}
    genre_dist = {}
    key_takeaways = []
    current_reads = []
    
    for r in reviews:
        ratings.append(r.rating)
        star_key = str(r.rating)
        rating_dist[star_key] = rating_dist.get(star_key, 0) + 1
        
        status = r.reading_status or "completed"
        if status == "completed" or (r.progress_percent and r.progress_percent >= 100):
            total_completed += 1
        elif status == "reading":
            currently_reading += 1
        elif status == "want_to_read":
            want_to_read += 1
        
        book_title = "Unknown Book"
        book_author = "Unknown Author"
        book_cover = None
        book_genre = "Tổng hợp"
        
        if r.book:
            book_title = r.book.title
            book_author = r.book.author or "Unknown Author"
            book_cover = f"/api/books/cover/{r.book.id}"
            book_genre = r.book.genre or "Khác"
        elif r.user_book:
            book_title = r.user_book.custom_title or (r.user_book.book.title if r.user_book.book else "Sách cá nhân")
            book_author = r.user_book.custom_author or (r.user_book.book.author if r.user_book.book else "Unknown")
            book_cover = r.user_book.custom_cover_url or (f"/api/books/cover/{r.user_book.book.id}" if r.user_book.book else None)
            book_genre = (r.user_book.book.genre if r.user_book.book else None) or "Cá nhân"
            
        genre_dist[book_genre] = genre_dist.get(book_genre, 0) + 1

        if r.key_takeaway and r.key_takeaway.strip():
            key_takeaways.append({
                "id": r.id,
                "book_id": r.book_id,
                "book_title": book_title,
                "book_author": book_author,
                "book_cover_url": book_cover,
                "rating": r.rating,
                "key_takeaway": r.key_takeaway.strip(),
                "favorite_quote": r.favorite_quote,
                "tags": r.tags,
                "created_at": r.created_at or datetime.now(timezone.utc)
            })
            
        if status == "reading" or (r.progress_percent is not None and 0 < r.progress_percent < 100):
            current_reads.append({
                "id": r.id,
                "book_id": r.book_id,
                "book_title": book_title,
                "book_author": book_author,
                "book_cover_url": book_cover,
                "progress_percent": r.progress_percent or 0,
                "rating": r.rating,
                "reading_status": status,
                "key_takeaway": r.key_takeaway,
                "updated_at": r.updated_at or r.created_at
            })

    user_books = db.query(models.UserBook).filter(models.UserBook.user_id == current_user.id).all()
    user_book_ids = [ub.id for ub in user_books]
    total_quotes = 0
    if user_book_ids:
        total_quotes = db.query(models.Quote).filter(models.Quote.user_book_id.in_(user_book_ids)).count()

    avg_rating = round(sum(ratings) / len(ratings), 1) if ratings else 0.0
    yearly_goal = 24
    goal_progress = min(100, int((total_completed / yearly_goal) * 100))
    streak_days = max(1, len(set(r.created_at.date() for r in reviews if r.created_at))) if reviews else 1

    serialized_reviews = [serialize_review(r, db) for r in reviews]

    return {
        "total_completed": total_completed,
        "currently_reading": currently_reading,
        "want_to_read": want_to_read,
        "total_reviews": len(reviews),
        "average_rating": avg_rating,
        "total_quotes": total_quotes,
        "reading_streak_days": streak_days,
        "yearly_goal": yearly_goal,
        "yearly_goal_progress": goal_progress,
        "genre_distribution": genre_dist,
        "rating_distribution": rating_dist,
        "key_takeaways": key_takeaways,
        "current_reads": current_reads,
        "recent_reviews": serialized_reviews
    }

@app.delete("/api/users/me/reviews/{review_id}")
def delete_my_review(review_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Xóa bài review / insight của user"""
    review = db.query(models.BookReview).filter(models.BookReview.id == review_id, models.BookReview.user_id == current_user.id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Không tìm thấy đánh giá")
    db.delete(review)
    db.commit()
    return {"message": "Đã xóa đánh giá thành công"}

@app.patch("/api/users/me/reading-progress")
def update_reading_progress(
    book_id: str, 
    progress_percent: int,
    reading_status: Optional[str] = None,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    """Cập nhật nhanh tiến độ đọc & trạng thái (ví dụ trượt thanh % hoặc đổi trạng thái)"""
    review = db.query(models.BookReview).filter(models.BookReview.book_id == book_id, models.BookReview.user_id == current_user.id).first()
    val_percent = max(0, min(100, progress_percent))
    status = reading_status or ("completed" if val_percent >= 100 else "reading")
    
    if not review:
        review = models.BookReview(
            id=models.generate_uuid(),
            user_id=current_user.id,
            book_id=book_id,
            rating=5,
            reading_status=status,
            progress_percent=val_percent
        )
        db.add(review)
    else:
        review.progress_percent = val_percent
        review.reading_status = status
        
    db.commit()
    db.refresh(review)
    return serialize_review(review, db)


@app.get("/api/business/ledgers", response_model=List[schemas.BusinessLedgerResponse])
def get_business_ledgers(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ensure_business_tables(db)
    ledgers = (
        db.query(models.BusinessLedger)
        .filter(models.BusinessLedger.user_id == current_user.id)
        .order_by(models.BusinessLedger.month.desc(), models.BusinessLedger.created_at.desc())
        .all()
    )
    order_counts = dict(
        db.query(models.BusinessOrder.ledger_id, func.count(models.BusinessOrder.id))
        .filter(models.BusinessOrder.user_id == current_user.id, models.BusinessOrder.status != "cancelled")
        .group_by(models.BusinessOrder.ledger_id)
        .all()
    )
    return [{
        "id": ledger.id,
        "user_id": ledger.user_id,
        "name": ledger.name,
        "month": ledger.month,
        "opening_cash": ledger.opening_cash or 0,
        "note": ledger.note,
        "is_closed": ledger.is_closed,
        "order_count": order_counts.get(ledger.id, 0),
        "revenue": 0,
        "profit": 0,
        "created_at": ledger.created_at,
    } for ledger in ledgers]


@app.post("/api/business/ledgers", response_model=schemas.BusinessLedgerResponse)
def create_business_ledger(ledger_in: schemas.BusinessLedgerCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ensure_business_tables(db)
    if not re.fullmatch(r"\d{4}-\d{2}", ledger_in.month):
        raise HTTPException(status_code=400, detail="Tháng phải có định dạng YYYY-MM")
    existing = db.query(models.BusinessLedger).filter(
        models.BusinessLedger.user_id == current_user.id,
        models.BusinessLedger.month == ledger_in.month,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Tháng này đã có sổ bán hàng")
    ledger = models.BusinessLedger(user_id=current_user.id, **ledger_in.dict())
    db.add(ledger)
    db.commit()
    db.refresh(ledger)
    return serialize_ledger(ledger)


@app.get("/api/business/stock-receipts", response_model=List[schemas.BusinessStockReceiptResponse])
def get_stock_receipts(limit: int = 30, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ensure_business_tables(db)
    receipts = (
        db.query(models.BusinessStockReceipt)
        .options(selectinload(models.BusinessStockReceipt.items).selectinload(models.BusinessStockReceiptItem.product))
        .filter(models.BusinessStockReceipt.user_id == current_user.id)
        .order_by(models.BusinessStockReceipt.received_at.desc())
        .limit(min(max(limit, 1), 100))
        .all()
    )
    return [serialize_stock_receipt(receipt) for receipt in receipts]


@app.post("/api/business/stock-receipts", response_model=schemas.BusinessStockReceiptResponse)
def create_stock_receipt(receipt_in: schemas.BusinessStockReceiptCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ensure_business_tables(db)
    if not receipt_in.items:
        raise HTTPException(status_code=400, detail="Phiếu nhập cần ít nhất một sản phẩm")
    product_ids = [item.product_id for item in receipt_in.items]
    if len(product_ids) != len(set(product_ids)):
        raise HTTPException(status_code=400, detail="Một sản phẩm chỉ nên xuất hiện một lần trong phiếu")
    products = db.query(models.BusinessProduct).filter(
        models.BusinessProduct.user_id == current_user.id,
        models.BusinessProduct.id.in_(product_ids),
    ).all()
    product_map = {product.id: product for product in products}
    if len(product_map) != len(product_ids):
        raise HTTPException(status_code=404, detail="Có sản phẩm không tồn tại")
    if any(item.quantity <= 0 or item.unit_cost < 0 for item in receipt_in.items):
        raise HTTPException(status_code=400, detail="Số lượng phải lớn hơn 0 và giá vốn không được âm")
    count = db.query(models.BusinessStockReceipt).filter(models.BusinessStockReceipt.user_id == current_user.id).count() + 1
    receipt = models.BusinessStockReceipt(
        user_id=current_user.id,
        code=f"NK-{datetime.now().strftime('%y%m')}-{count:04d}",
        supplier_name=receipt_in.supplier_name,
        extra_cost=max(receipt_in.extra_cost, 0),
        note=receipt_in.note,
        received_at=receipt_in.received_at or datetime.now(timezone.utc),
    )
    db.add(receipt)
    db.flush()
    for item in receipt_in.items:
        product = product_map[item.product_id]
        product.stock_quantity = (product.stock_quantity or 0) + item.quantity
        product.unit_cost = item.unit_cost
        db.add(models.BusinessStockReceiptItem(
            receipt_id=receipt.id,
            product_id=product.id,
            quantity=item.quantity,
            unit_cost=item.unit_cost,
        ))
    db.commit()
    receipt = db.query(models.BusinessStockReceipt).options(
        selectinload(models.BusinessStockReceipt.items).selectinload(models.BusinessStockReceiptItem.product)
    ).filter(models.BusinessStockReceipt.id == receipt.id).first()
    return serialize_stock_receipt(receipt)


@app.get("/api/business/orders", response_model=List[schemas.BusinessOrderResponse])
def get_business_orders(
    ledger_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    ensure_business_tables(db)
    query = db.query(models.BusinessOrder).options(selectinload(models.BusinessOrder.items)).filter(models.BusinessOrder.user_id == current_user.id)
    if ledger_id:
        query = query.filter(models.BusinessOrder.ledger_id == ledger_id)
    orders = query.order_by(models.BusinessOrder.ordered_at.desc(), models.BusinessOrder.created_at.desc()).offset(max(offset, 0)).limit(min(max(limit, 1), 100)).all()
    return [serialize_business_order(order) for order in orders]


@app.post("/api/business/orders", response_model=schemas.BusinessOrderResponse)
def create_business_order(order_in: schemas.BusinessOrderCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ensure_business_tables(db)
    ledger = db.query(models.BusinessLedger).filter(models.BusinessLedger.id == order_in.ledger_id, models.BusinessLedger.user_id == current_user.id).first()
    if not ledger:
        raise HTTPException(status_code=404, detail="Không tìm thấy sổ bán hàng")
    if ledger.is_closed:
        raise HTTPException(status_code=400, detail="Sổ này đã được khóa")
    if not order_in.customer_name.strip() or not order_in.items:
        raise HTTPException(status_code=400, detail="Cần tên khách và ít nhất một sản phẩm")
    product_ids = [item.product_id for item in order_in.items]
    if len(product_ids) != len(set(product_ids)):
        raise HTTPException(status_code=400, detail="Một sản phẩm chỉ nên xuất hiện một lần trong đơn")
    products = db.query(models.BusinessProduct).filter(
        models.BusinessProduct.user_id == current_user.id,
        models.BusinessProduct.id.in_(product_ids),
    ).all()
    product_map = {product.id: product for product in products}
    if len(product_map) != len(product_ids):
        raise HTTPException(status_code=404, detail="Có sản phẩm không tồn tại")
    for item in order_in.items:
        product = product_map[item.product_id]
        if item.quantity <= 0:
            raise HTTPException(status_code=400, detail="Số lượng bán phải lớn hơn 0")
        if (product.stock_quantity or 0) < item.quantity:
            raise HTTPException(status_code=409, detail=f"{product.name} chỉ còn {product.stock_quantity or 0} sản phẩm")
    order_count = db.query(models.BusinessOrder).filter(models.BusinessOrder.ledger_id == ledger.id).count() + 1
    order = models.BusinessOrder(
        user_id=current_user.id,
        ledger_id=ledger.id,
        code=f"DH-{ledger.month.replace('-', '')}-{order_count:04d}",
        customer_name=order_in.customer_name.strip(),
        customer_contact=order_in.customer_contact,
        social_link=order_in.social_link,
        shipping_fee=max(order_in.shipping_fee, 0),
        shipping_cost=max(order_in.shipping_cost, 0),
        discount=max(order_in.discount, 0),
        other_fee=max(order_in.other_fee, 0),
        payment_status=order_in.payment_status if order_in.payment_status in ["paid", "pending", "partial"] else "pending",
        note=order_in.note,
        ordered_at=order_in.ordered_at or datetime.now(timezone.utc),
    )
    db.add(order)
    db.flush()
    for item in order_in.items:
        product = product_map[item.product_id]
        product.stock_quantity = (product.stock_quantity or 0) - item.quantity
        db.add(models.BusinessOrderItem(
            order_id=order.id,
            product_id=product.id,
            product_name=product.name,
            quantity=item.quantity,
            unit_price=product.selling_price if item.unit_price is None else max(item.unit_price, 0),
            unit_cost=product.unit_cost or 0,
        ))
    db.commit()
    order = db.query(models.BusinessOrder).options(selectinload(models.BusinessOrder.items)).filter(models.BusinessOrder.id == order.id).first()
    return serialize_business_order(order)


@app.put("/api/business/orders/{order_id}", response_model=schemas.BusinessOrderResponse)
def update_business_order(order_id: str, order_in: schemas.BusinessOrderCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    order = db.query(models.BusinessOrder).options(selectinload(models.BusinessOrder.items)).filter(
        models.BusinessOrder.id == order_id,
        models.BusinessOrder.user_id == current_user.id,
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")
    ledger = db.query(models.BusinessLedger).filter(
        models.BusinessLedger.id == order_in.ledger_id,
        models.BusinessLedger.user_id == current_user.id,
    ).first()
    if not ledger:
        raise HTTPException(status_code=404, detail="Không tìm thấy sổ bán hàng")
    if ledger.is_closed:
        raise HTTPException(status_code=400, detail="Sổ này đã được khóa")
    if not order_in.customer_name.strip() or not order_in.items:
        raise HTTPException(status_code=400, detail="Cần tên khách và ít nhất một sản phẩm")

    product_ids = [item.product_id for item in order_in.items]
    if len(product_ids) != len(set(product_ids)):
        raise HTTPException(status_code=400, detail="Một sản phẩm chỉ nên xuất hiện một lần trong đơn")
    old_quantities = {}
    for item in order.items:
        old_quantities[item.product_id] = old_quantities.get(item.product_id, 0) + (item.quantity or 0)
    all_product_ids = list(set(product_ids + list(old_quantities.keys())))
    products = db.query(models.BusinessProduct).filter(
        models.BusinessProduct.user_id == current_user.id,
        models.BusinessProduct.id.in_(all_product_ids),
    ).all()
    product_map = {product.id: product for product in products}
    if any(product_id not in product_map for product_id in product_ids):
        raise HTTPException(status_code=404, detail="Có sản phẩm không tồn tại")
    for item in order_in.items:
        product = product_map[item.product_id]
        available = (product.stock_quantity or 0) + old_quantities.get(item.product_id, 0)
        if item.quantity <= 0:
            raise HTTPException(status_code=400, detail="Số lượng bán phải lớn hơn 0")
        if available < item.quantity:
            raise HTTPException(status_code=409, detail=f"{product.name} chỉ còn {available} sản phẩm")

    for product_id, quantity in old_quantities.items():
        product = product_map.get(product_id)
        if product:
            product.stock_quantity = (product.stock_quantity or 0) + quantity
    for old_item in list(order.items):
        db.delete(old_item)
    db.flush()

    order.ledger_id = ledger.id
    order.customer_name = order_in.customer_name.strip()
    order.customer_contact = order_in.customer_contact
    order.social_link = order_in.social_link
    order.shipping_fee = max(order_in.shipping_fee, 0)
    order.shipping_cost = max(order_in.shipping_cost, 0)
    order.discount = max(order_in.discount, 0)
    order.other_fee = max(order_in.other_fee, 0)
    order.payment_status = order_in.payment_status if order_in.payment_status in ["paid", "pending", "partial"] else "pending"
    order.note = order_in.note
    order.ordered_at = order_in.ordered_at or order.ordered_at
    for item in order_in.items:
        product = product_map[item.product_id]
        product.stock_quantity = (product.stock_quantity or 0) - item.quantity
        db.add(models.BusinessOrderItem(
            order_id=order.id,
            product_id=product.id,
            product_name=product.name,
            quantity=item.quantity,
            unit_price=product.selling_price if item.unit_price is None else max(item.unit_price, 0),
            unit_cost=product.unit_cost or 0,
        ))
    db.commit()
    order = db.query(models.BusinessOrder).options(selectinload(models.BusinessOrder.items)).filter(models.BusinessOrder.id == order.id).first()
    return serialize_business_order(order)


@app.delete("/api/business/orders/{order_id}")
def delete_business_order(order_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    order = db.query(models.BusinessOrder).options(selectinload(models.BusinessOrder.items)).filter(
        models.BusinessOrder.id == order_id,
        models.BusinessOrder.user_id == current_user.id,
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")
    for item in order.items:
        product = db.query(models.BusinessProduct).filter(models.BusinessProduct.id == item.product_id, models.BusinessProduct.user_id == current_user.id).first()
        if product:
            product.stock_quantity = (product.stock_quantity or 0) + (item.quantity or 0)
    db.delete(order)
    db.commit()
    return {"message": "Đã xóa đơn và hoàn lại tồn kho"}


@app.post("/api/business/expenses", response_model=schemas.BusinessExpenseResponse)
def create_business_expense(expense_in: schemas.BusinessExpenseCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ledger = db.query(models.BusinessLedger).filter(models.BusinessLedger.id == expense_in.ledger_id, models.BusinessLedger.user_id == current_user.id).first()
    if not ledger:
        raise HTTPException(status_code=404, detail="Không tìm thấy sổ bán hàng")
    if expense_in.amount <= 0 or not expense_in.category.strip():
        raise HTTPException(status_code=400, detail="Khoản chi chưa hợp lệ")
    expense = models.BusinessExpense(
        user_id=current_user.id,
        ledger_id=ledger.id,
        category=expense_in.category.strip(),
        amount=expense_in.amount,
        note=expense_in.note,
        spent_at=expense_in.spent_at or datetime.now(timezone.utc),
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@app.get("/api/business/reports/{ledger_id}", response_model=schemas.BusinessReportResponse)
def get_business_report(ledger_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ledger = db.query(models.BusinessLedger).filter(models.BusinessLedger.id == ledger_id, models.BusinessLedger.user_id == current_user.id).first()
    if not ledger:
        raise HTTPException(status_code=404, detail="Không tìm thấy sổ bán hàng")
    orders = db.query(models.BusinessOrder).options(selectinload(models.BusinessOrder.items)).filter(
        models.BusinessOrder.ledger_id == ledger.id,
        models.BusinessOrder.user_id == current_user.id,
        models.BusinessOrder.status != "cancelled",
    ).order_by(models.BusinessOrder.ordered_at.asc()).all()
    expenses = db.query(models.BusinessExpense).filter(models.BusinessExpense.ledger_id == ledger.id, models.BusinessExpense.user_id == current_user.id).order_by(models.BusinessExpense.spent_at.desc()).all()
    serialized = [serialize_business_order(order) for order in orders]
    daily = {}
    product_stats = {}
    for order, data in zip(orders, serialized):
        day = order.ordered_at.strftime("%Y-%m-%d")
        row = daily.setdefault(day, {"date": day, "orders": 0, "revenue": 0, "profit": 0})
        row["orders"] += 1
        row["revenue"] += data["total"]
        row["profit"] += data["profit"]
        for item in order.items:
            product = product_stats.setdefault(item.product_id, {"product_id": item.product_id, "name": item.product_name, "quantity": 0, "revenue": 0, "profit": 0})
            product["quantity"] += item.quantity or 0
            product["revenue"] += (item.unit_price or 0) * (item.quantity or 0)
            product["profit"] += ((item.unit_price or 0) - (item.unit_cost or 0)) * (item.quantity or 0)
    operating_expense = sum(expense.amount or 0 for expense in expenses)
    revenue = sum(order["total"] for order in serialized)
    capital_cost = sum(order["capital_cost"] for order in serialized)
    shipping_cost = sum(order["shipping_cost"] for order in serialized)
    other_order_fee = sum(order["other_fee"] for order in serialized)
    stock_products = db.query(models.BusinessProduct).filter(models.BusinessProduct.user_id == current_user.id, models.BusinessProduct.is_active == True).all()
    return {
        "ledger_id": ledger.id,
        "revenue": revenue,
        "capital_cost": capital_cost,
        "shipping_cost": shipping_cost,
        "other_order_fee": other_order_fee,
        "operating_expense": operating_expense,
        "profit": sum(order["profit"] for order in serialized) - operating_expense,
        "order_count": len(serialized),
        "sold_units": sum(order["item_count"] for order in serialized),
        "average_order_value": round(revenue / len(serialized)) if serialized else 0,
        "stock_units": sum(product.stock_quantity or 0 for product in stock_products),
        "stock_value": sum((product.stock_quantity or 0) * (product.unit_cost or 0) for product in stock_products),
        "daily": list(daily.values()),
        "top_products": sorted(product_stats.values(), key=lambda item: item["revenue"], reverse=True)[:10],
        "expenses": expenses,
    }


@app.get("/api/business/summary", response_model=schemas.BusinessSummaryResponse)
def get_business_summary(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ensure_business_tables(db)
    products = db.query(models.BusinessProduct).filter(models.BusinessProduct.user_id == current_user.id).all()
    transactions = (
        db.query(models.BusinessTransaction)
        .filter(models.BusinessTransaction.user_id == current_user.id)
        .order_by(models.BusinessTransaction.transaction_date.desc(), models.BusinessTransaction.created_at.desc())
        .all()
    )
    total_income = sum((t.amount or 0) for t in transactions if t.type == "income")
    total_expense = sum((t.amount or 0) for t in transactions if t.type == "expense")
    total_capital = sum((t.capital_cost or 0) for t in transactions if t.type == "income")
    total_shipping = sum((t.shipping_fee or 0) for t in transactions if t.type == "income")
    total_other_fee = sum((t.other_fee or 0) for t in transactions if t.type == "income")
    product_txs = {}
    for t in transactions:
        if t.product_id:
            product_txs.setdefault(t.product_id, []).append(t)
    ranked_products = sorted(
        [serialize_business_product(p, product_txs.get(p.id, [])) for p in products],
        key=lambda item: item["total_profit"],
        reverse=True
    )
    return {
        "total_income": total_income,
        "total_expense": total_expense,
        "total_capital": total_capital,
        "total_shipping": total_shipping,
        "total_other_fee": total_other_fee,
        "gross_profit": total_income - total_capital,
        "net_profit": total_income - total_expense - total_capital - total_shipping - total_other_fee,
        "active_products": len([p for p in products if p.is_active]),
        "stock_units": sum((p.stock_quantity or 0) for p in products),
        "sold_units": sum((t.quantity or 0) for t in transactions if t.type == "income"),
        "recent_transactions": [serialize_business_transaction(t) for t in transactions[:8]],
        "top_products": ranked_products[:5],
    }


@app.get("/api/business/products", response_model=List[schemas.BusinessProductResponse])
def get_business_products(include_legacy_metrics: bool = False, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ensure_business_tables(db)
    products = (
        db.query(models.BusinessProduct)
        .filter(models.BusinessProduct.user_id == current_user.id)
        .filter(models.BusinessProduct.is_active.isnot(False))
        .order_by(models.BusinessProduct.created_at.desc())
        .all()
    )
    if not include_legacy_metrics:
        return [serialize_business_product(product, []) for product in products]
    txs = db.query(models.BusinessTransaction).filter(models.BusinessTransaction.user_id == current_user.id).all()
    grouped = {}
    for t in txs:
        if t.product_id:
            grouped.setdefault(t.product_id, []).append(t)
    return [serialize_business_product(p, grouped.get(p.id, [])) for p in products]


@app.post("/api/business/products", response_model=schemas.BusinessProductResponse)
def create_business_product(product_in: schemas.BusinessProductCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ensure_business_tables(db)
    product = models.BusinessProduct(user_id=current_user.id, **product_in.dict())
    db.add(product)
    db.commit()
    db.refresh(product)
    return serialize_business_product(product, [])


@app.put("/api/business/products/{product_id}", response_model=schemas.BusinessProductResponse)
def update_business_product(product_id: str, product_in: schemas.BusinessProductUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ensure_business_tables(db)
    product = db.query(models.BusinessProduct).filter(models.BusinessProduct.id == product_id, models.BusinessProduct.user_id == current_user.id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    for key, value in product_in.dict(exclude_unset=True).items():
        setattr(product, key, value)
    db.commit()
    db.refresh(product)
    return serialize_business_product(product)


@app.delete("/api/business/products/{product_id}")
def delete_business_product(product_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ensure_business_tables(db)
    product = db.query(models.BusinessProduct).filter(models.BusinessProduct.id == product_id, models.BusinessProduct.user_id == current_user.id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Không tìm thấy sản phẩm")

    has_receipts = db.query(models.BusinessStockReceiptItem).filter(models.BusinessStockReceiptItem.product_id == product.id).first()
    has_orders = db.query(models.BusinessOrderItem).filter(models.BusinessOrderItem.product_id == product.id).first()

    if has_receipts or has_orders:
        product.is_active = False
        product.stock_quantity = 0
        db.commit()
    else:
        try:
            db.delete(product)
            db.commit()
        except Exception:
            db.rollback()
            product.is_active = False
            product.stock_quantity = 0
            db.commit()
    return {"message": "Đã xóa sản phẩm thành công"}


@app.get("/api/business/transactions", response_model=List[schemas.BusinessTransactionResponse])
def get_business_transactions(
    tx_type: Optional[str] = None,
    product_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    ensure_business_tables(db)
    query = db.query(models.BusinessTransaction).filter(models.BusinessTransaction.user_id == current_user.id)
    if tx_type in ["income", "expense"]:
        query = query.filter(models.BusinessTransaction.type == tx_type)
    if product_id:
        query = query.filter(models.BusinessTransaction.product_id == product_id)
    transactions = query.order_by(models.BusinessTransaction.transaction_date.desc(), models.BusinessTransaction.created_at.desc()).all()
    return [serialize_business_transaction(t) for t in transactions]


@app.post("/api/business/transactions", response_model=schemas.BusinessTransactionResponse)
def create_business_transaction(transaction_in: schemas.BusinessTransactionCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ensure_business_tables(db)
    validate_business_transaction(transaction_in.type, transaction_in.category)
    payload = transaction_in.dict()
    if payload.get("product_id"):
        product = db.query(models.BusinessProduct).filter(models.BusinessProduct.id == payload["product_id"], models.BusinessProduct.user_id == current_user.id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
    if not payload.get("transaction_date"):
        payload["transaction_date"] = datetime.now(timezone.utc)
    transaction = models.BusinessTransaction(user_id=current_user.id, **payload)
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return serialize_business_transaction(transaction)


@app.put("/api/business/transactions/{transaction_id}", response_model=schemas.BusinessTransactionResponse)
def update_business_transaction(transaction_id: str, transaction_in: schemas.BusinessTransactionUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ensure_business_tables(db)
    transaction = db.query(models.BusinessTransaction).filter(models.BusinessTransaction.id == transaction_id, models.BusinessTransaction.user_id == current_user.id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    payload = transaction_in.dict(exclude_unset=True)
    next_type = payload.get("type", transaction.type)
    next_category = payload.get("category", transaction.category)
    validate_business_transaction(next_type, next_category)
    if payload.get("product_id"):
        product = db.query(models.BusinessProduct).filter(models.BusinessProduct.id == payload["product_id"], models.BusinessProduct.user_id == current_user.id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
    for key, value in payload.items():
        setattr(transaction, key, value)
    db.commit()
    db.refresh(transaction)
    return serialize_business_transaction(transaction)


@app.delete("/api/business/transactions/{transaction_id}")
def delete_business_transaction(transaction_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ensure_business_tables(db)
    transaction = db.query(models.BusinessTransaction).filter(models.BusinessTransaction.id == transaction_id, models.BusinessTransaction.user_id == current_user.id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(transaction)
    db.commit()
    return {"message": "Transaction deleted"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
