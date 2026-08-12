import os
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

import sqlite3
from backend.main import get_db
from backend.models import Book
from backend.extract_service import extract_epub_info, extract_pdf_info
from backend.drive_service import drive_service

def debug_covers():
    conn = sqlite3.connect('backend/bookshelf.db')
    cur = conn.cursor()
    cur.execute("SELECT id, title, mime_type, drive_file_id FROM books WHERE drive_file_id IS NOT NULL LIMIT 2")
    books = cur.fetchall()
    
    for b_id, title, mime, drive_id in books:
        print(f"Downloading {title} (ID: {drive_id})...")
        try:
            file_bytes = drive_service.download_file_bytes(drive_id)
            if not file_bytes:
                print(" -> Download failed, empty bytes.")
                continue
            
            print(f" -> Downloaded {len(file_bytes)} bytes.")
            if mime == 'application/pdf':
                res = extract_pdf_info(file_bytes)
            else:
                res = extract_epub_info(file_bytes)
                
            cover_b64 = res.get('cover_b64')
            if cover_b64:
                print(f" -> Successfully extracted cover! Length: {len(cover_b64)} chars. Starts with: {cover_b64[:30]}")
            else:
                print(" -> FAILED to extract cover! No cover_b64 returned.")
        except Exception as e:
            print(f" -> Exception: {e}")

if __name__ == "__main__":
    debug_covers()
