import fitz  # PyMuPDF
import ebooklib
from ebooklib import epub
import io
import base64
from bs4 import BeautifulSoup

from PIL import Image

def compress_cover_image(img_bytes: bytes, max_width: int = 250, quality: int = 60) -> str:
    """Tối ưu và nén ảnh bìa thành chuỗi Data URI base64 cực nhẹ (~10KB-20KB) để lưu trực tiếp DB, tối ưu hóa tốc độ tải."""
    try:
        img = Image.open(io.BytesIO(img_bytes))
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        
        if img.width > max_width:
            ratio = max_width / float(img.width)
            new_height = int(float(img.height) * ratio)
            img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
            
        output = io.BytesIO()
        img.save(output, format="JPEG", quality=quality, optimize=True)
        b64_str = base64.b64encode(output.getvalue()).decode('utf-8')
        return f"data:image/jpeg;base64,{b64_str}"
    except Exception as e:
        print(f"Lỗi khi nén ảnh bìa: {e}")
        b64_str = base64.b64encode(img_bytes).decode('utf-8')
        return f"data:image/jpeg;base64,{b64_str}"

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
            # Lấy Cover trang đầu
            page = doc.load_page(0)
            pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5))
            img_data = pix.tobytes("png")
            result['cover_b64'] = compress_cover_image(img_data)
            
            # Lấy Metadata
            meta = doc.metadata
            if meta:
                if meta.get('title'): result['title'] = meta.get('title')
                if meta.get('author'): result['author'] = meta.get('author')
            
            # Lấy Tóm tắt
            text = ""
            for i in range(min(3, len(doc))):
                text += doc[i].get_text("text") + " "
            
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
        
        # Cover - Enhanced Heuristics
        cover_bytes = None
        
        # 1. Tìm theo tên file/ID có chứa chữ 'cover', 'bia', 'bìa', 'title'
        for item in book.get_items_of_type(ebooklib.ITEM_IMAGE):
            name_lower = item.get_name().lower()
            id_lower = item.id.lower() if item.id else ""
            if any(k in name_lower or k in id_lower for k in ['cover', 'bia', 'bìa', 'title', 'folder', 'front']):
                cover_bytes = item.get_content()
                break

        # 2. Tìm qua ITEM_COVER trong ebooklib
        if not cover_bytes:
            for item in book.get_items():
                if item.get_type() == ebooklib.ITEM_COVER:
                    cover_bytes = item.get_content()
                    break
                    
        # 3. Fallback: Lấy ảnh dung lượng lớn nhất (> 3KB) trong sách
        if not cover_bytes:
            images = list(book.get_items_of_type(ebooklib.ITEM_IMAGE))
            if images:
                valid_images = [img for img in images if len(img.get_content()) > 3000]
                if valid_images:
                    valid_images.sort(key=lambda x: len(x.get_content()), reverse=True)
                    cover_bytes = valid_images[0].get_content()

        if cover_bytes:
            result['cover_b64'] = compress_cover_image(cover_bytes)
                
        # Summary (Lấy text từ document đầu tiên)
        for item in book.get_items():
            if item.get_type() == ebooklib.ITEM_DOCUMENT:
                soup = BeautifulSoup(item.get_content(), 'html.parser')
                text = soup.get_text(separator=' ')
                clean_text = " ".join(text.split())
                if len(clean_text) > 50:
                    result['summary'] = clean_text[:300] + "..." if len(clean_text) > 300 else clean_text
                    break

    except Exception as e:
        print(f"Lỗi khi extract EPUB info: {e}")
    return result
