import sqlite3
import base64
import os
import re

def process_covers():
    conn = sqlite3.connect('bookshelf.db')
    c = conn.cursor()
    c.execute("SELECT id, cover_url FROM books WHERE cover_url LIKE 'data:image%'")
    rows = c.fetchall()
    
    os.makedirs('uploads/covers', exist_ok=True)
    
    for row in rows:
        book_id = row[0]
        cover_url = row[1]
        
        # e.g., data:image/jpeg;base64,/9j/4AAQ...
        match = re.match(r'data:image/(?P<ext>[a-zA-Z0-9]+);base64,(?P<data>.*)', cover_url)
        if match:
            ext = match.group('ext')
            # normalize ext
            if ext == 'jpeg': ext = 'jpg'
            
            b64_data = match.group('data')
            try:
                img_data = base64.b64decode(b64_data)
                filepath = f'uploads/covers/{book_id}.{ext}'
                with open(filepath, 'wb') as f:
                    f.write(img_data)
                
                new_url = f'/uploads/covers/{book_id}.{ext}'
                c.execute("UPDATE books SET cover_url = ? WHERE id = ?", (new_url, book_id))
                print(f"Extracted cover for book {book_id}")
            except Exception as e:
                print(f"Failed to process {book_id}: {e}")
    
    conn.commit()
    conn.close()

if __name__ == "__main__":
    process_covers()
