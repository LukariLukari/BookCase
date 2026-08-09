import fitz  # PyMuPDF
import ebooklib
from ebooklib import epub
import io
import base64
from bs4 import BeautifulSoup

def extract_pdf_info(pdf_bytes: bytes):
    """Trích xuất ảnh bìa, title, author, và text tóm tắt từ PDF"""
    result = {
        'cover_b64': None,
        'title': None,
        'author': None,
        'summary': None
    }
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        if len(doc) > 0:
            # Lấy Cover
            page = doc.load_page(0)
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
            img_data = pix.tobytes("png")
            result['cover_b64'] = f"data:image/png;base64,{base64.b64encode(img_data).decode('utf-8')}"
            
            # Lấy Metadata
            meta = doc.metadata
            if meta:
                if meta.get('title'): result['title'] = meta.get('title')
                if meta.get('author'): result['author'] = meta.get('author')
            
            # Lấy Tóm tắt (300 ký tự đầu tiên từ trang 1 hoặc 2)
            text = ""
            for i in range(min(3, len(doc))):
                text += doc[i].get_text("text") + " "
            
            # Làm sạch text
            clean_text = " ".join(text.split())
            if clean_text:
                result['summary'] = clean_text[:300] + "..." if len(clean_text) > 300 else clean_text
    except Exception as e:
        print(f"Lỗi khi extract PDF info: {e}")
    return result

def extract_epub_info(epub_bytes: bytes):
    """Trích xuất ảnh bìa, title, author, và text từ EPUB"""
    result = {
        'cover_b64': None,
        'title': None,
        'author': None,
        'summary': None
    }
    try:
        import tempfile
        import os
        with tempfile.NamedTemporaryFile(delete=False, suffix=".epub") as tmp:
            tmp.write(epub_bytes)
            tmp_path = tmp.name
        
        book = epub.read_epub(tmp_path)
        os.remove(tmp_path)
        
        # Metadata
        title_list = book.get_metadata('DC', 'title')
        if title_list: result['title'] = title_list[0][0]
        
        author_list = book.get_metadata('DC', 'creator')
        if author_list: result['author'] = author_list[0][0]
        
        # Cover
        # Cover - Enhanced Heuristics
        cover_item = None
        
        # 1. Tìm qua ITEM_COVER
        for item in book.get_items():
            if item.get_type() == ebooklib.ITEM_COVER:
                cover_item = item
                break
                
        # 2. Tìm qua tên file có chứa chữ 'cover'
        if not cover_item:
            for item in book.get_items_of_type(ebooklib.ITEM_IMAGE):
                if 'cover' in item.get_name().lower() or 'cover' in item.id.lower():
                    cover_item = item
                    break
                    
        # 3. Fallback: Lấy ảnh lớn nhất (khả năng cao là ảnh bìa) hoặc ảnh đầu tiên
        if not cover_item:
            images = list(book.get_items_of_type(ebooklib.ITEM_IMAGE))
            if images:
                # Sắp xếp theo kích thước file (ảnh bìa thường nặng nhất)
                images.sort(key=lambda x: len(x.get_content()), reverse=True)
                cover_item = images[0]

        if cover_item:
            b64 = base64.b64encode(cover_item.get_content()).decode('utf-8')
            mime = "image/jpeg"
            if cover_item.get_name().lower().endswith(".png"):
                mime = "image/png"
            result['cover_b64'] = f"data:{mime};base64,{b64}"
                
        # Summary (Lấy text từ document đầu tiên)
        for item in book.get_items():
            if item.get_type() == ebooklib.ITEM_DOCUMENT:
                soup = BeautifulSoup(item.get_content(), 'html.parser')
                text = soup.get_text(separator=' ')
                clean_text = " ".join(text.split())
                if len(clean_text) > 50: # Bỏ qua các trang blank
                    result['summary'] = clean_text[:300] + "..." if len(clean_text) > 300 else clean_text
                    break

    except Exception as e:
        print(f"Lỗi khi extract EPUB info: {e}")
    return result
