import fitz  # PyMuPDF
import io
import os
import re
import posixpath
import urllib.parse
import zipfile
import xml.etree.ElementTree as ET
import base64
from bs4 import BeautifulSoup
from PIL import Image

def compress_cover_image(img_bytes: bytes, max_width: int = 250, quality: int = 60) -> str:
    """Tối ưu và nén ảnh bìa thành chuỗi Data URI base64 cực nhẹ (~10KB-20KB) để lưu trực tiếp DB, tối ưu hóa tốc độ tải."""
    if not img_bytes:
        return None
    try:
        img = Image.open(io.BytesIO(img_bytes))
        if img.mode != "RGB":
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
        try:
            b64_str = base64.b64encode(img_bytes).decode('utf-8')
            return f"data:image/jpeg;base64,{b64_str}"
        except Exception:
            return None

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
            try:
                page = doc.load_page(0)
                pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5))
                img_data = pix.tobytes("png")
                result['cover_b64'] = compress_cover_image(img_data)
            except Exception as e:
                print(f"Lỗi khi render cover PDF: {e}")
            
            # Lấy Metadata
            try:
                meta = doc.metadata
                if meta:
                    if meta.get('title'): 
                        t = str(meta.get('title')).strip()
                        if len(t) > 1 and not t.lower().startswith('untitled'):
                            result['title'] = t
                    if meta.get('author'): 
                        a = str(meta.get('author')).strip()
                        if len(a) > 1:
                            result['author'] = a
            except Exception as e:
                print(f"Lỗi khi đọc metadata PDF: {e}")
            
            # Lấy Tóm tắt
            try:
                text = ""
                for i in range(min(3, len(doc))):
                    text += doc[i].get_text("text") + " "
                clean_text = " ".join(text.split())
                if clean_text:
                    result['summary'] = clean_text[:300] + "..." if len(clean_text) > 300 else clean_text
            except Exception as e:
                print(f"Lỗi khi đọc text tóm tắt PDF: {e}")
    except Exception as e:
        print(f"Lỗi khi extract PDF info: {e}")
    return result

def _clean_str(val):
    if val is None:
        return None
    s = str(val).strip()
    return s if len(s) > 0 else None

def extract_epub_info(epub_bytes: bytes):
    """Trích xuất ảnh bìa chính xác, title, author và summary từ file EPUB"""
    result = {
        'cover_b64': None,
        'title': None,
        'author': None,
        'summary': None
    }
    
    try:
        with zipfile.ZipFile(io.BytesIO(epub_bytes)) as zf:
            namelist = zf.namelist()
            
            # 1. Tìm đường dẫn OPF từ META-INF/container.xml
            opf_path = None
            if "META-INF/container.xml" in namelist:
                try:
                    container_xml = zf.read("META-INF/container.xml")
                    root = ET.fromstring(container_xml)
                    for elem in root.iter():
                        if elem.tag.endswith('rootfile'):
                            opf_path = elem.attrib.get('full-path')
                            if opf_path:
                                break
                except Exception as e:
                    print(f"Lỗi đọc container.xml: {e}")
            
            # Fallback nếu không có container.xml: tìm file đuôi .opf
            if not opf_path:
                for name in namelist:
                    if name.lower().endswith('.opf'):
                        opf_path = name
                        break
            
            opf_dir = posixpath.dirname(opf_path) if opf_path else ""
            manifest_items = {} # id -> {href, media_type, properties, full_path}
            declared_cover_href = None
            guide_cover_href = None
            
            if opf_path and opf_path in namelist:
                try:
                    opf_content = zf.read(opf_path)
                    soup = BeautifulSoup(opf_content, 'html.parser')
                    
                    # Metadata: Title
                    title_elem = soup.find(re.compile(r'^(dc:)?title$', re.I))
                    if title_elem and title_elem.text:
                        result['title'] = _clean_str(title_elem.text)
                    
                    # Metadata: Creator / Author
                    creator_elem = soup.find(re.compile(r'^(dc:)?creator$', re.I))
                    if creator_elem and creator_elem.text:
                        result['author'] = _clean_str(creator_elem.text)
                    
                    # Metadata: Description / Summary
                    desc_elem = soup.find(re.compile(r'^(dc:)?description$', re.I))
                    if desc_elem and desc_elem.text:
                        desc_text = BeautifulSoup(desc_elem.text, 'html.parser').get_text(separator=' ')
                        clean_desc = " ".join(desc_text.split())
                        if clean_desc:
                            result['summary'] = clean_desc[:300] + "..." if len(clean_desc) > 300 else clean_desc

                    # Manifest Items
                    for item in soup.find_all('item'):
                        item_id = item.get('id', '')
                        href = urllib.parse.unquote(item.get('href', ''))
                        media_type = item.get('media-type', '')
                        props = item.get('properties', '')
                        
                        full_path = posixpath.normpath(posixpath.join(opf_dir, href)) if opf_dir else href
                        if full_path not in namelist:
                            for n in namelist:
                                if n.lower() == full_path.lower():
                                    full_path = n
                                    break
                        
                        manifest_items[item_id] = {
                            'id': item_id,
                            'href': href,
                            'full_path': full_path,
                            'media_type': media_type,
                            'properties': props
                        }
                        
                        # Check EPUB 3 cover: properties="cover-image"
                        if 'cover-image' in props:
                            declared_cover_href = full_path

                    # Check EPUB 2 meta cover: <meta name="cover" content="item_id"/>
                    if not declared_cover_href:
                        meta_cover = soup.find('meta', attrs={'name': 'cover'})
                        if meta_cover and meta_cover.get('content'):
                            c_id = meta_cover.get('content')
                            if c_id in manifest_items:
                                declared_cover_href = manifest_items[c_id]['full_path']

                    # Check Guide: <reference type="cover" href="..."/>
                    guide_ref = soup.find('reference', attrs={'type': 'cover'})
                    if guide_ref and guide_ref.get('href'):
                        g_href = urllib.parse.unquote(guide_ref.get('href', ''))
                        g_full = posixpath.normpath(posixpath.join(opf_dir, g_href)) if opf_dir else g_href
                        guide_cover_href = g_full

                except Exception as e:
                    print(f"Lỗi parse OPF file: {e}")

            # 2. Thu thập và Chấm điểm tất cả ứng viên ảnh (Candidate Cover Images)
            best_cover_bytes = None
            best_score = -99999
            
            # Nếu guide_cover_href là file HTML (e.g. cover.xhtml, titlepage.xhtml), tìm ảnh bên trong
            if guide_cover_href and (guide_cover_href.endswith('.xhtml') or guide_cover_href.endswith('.html')):
                html_path = guide_cover_href.split('#')[0]
                if html_path in namelist:
                    try:
                        c_soup = BeautifulSoup(zf.read(html_path), 'html.parser')
                        img_tag = c_soup.find(['img', 'image'])
                        if img_tag:
                            src = img_tag.get('src') or img_tag.get('xlink:href') or img_tag.get('href')
                            if src:
                                src_unquote = urllib.parse.unquote(src)
                                html_dir = posixpath.dirname(html_path)
                                img_full = posixpath.normpath(posixpath.join(html_dir, src_unquote))
                                if img_full in namelist:
                                    declared_cover_href = img_full
                    except Exception as e:
                        print(f"Lỗi parse cover html page: {e}")

            # Danh sách tất cả file ảnh trong zip
            image_extensions = ('.jpg', '.jpeg', '.png', '.webp')
            image_files = [n for n in namelist if any(n.lower().endswith(ext) for ext in image_extensions)]
            
            for img_path in image_files:
                try:
                    img_data = zf.read(img_path)
                    if len(img_data) < 2000: # Bỏ qua ảnh quá nhỏ (<2KB)
                        continue
                    
                    score = 0
                    path_lower = img_path.lower()
                    file_name = posixpath.basename(path_lower)
                    
                    # Điểm cộng cực lớn nếu được định danh chính thức trong EPUB manifest/metadata
                    if declared_cover_href and (img_path == declared_cover_href or path_lower == declared_cover_href.lower()):
                        score += 5000
                    
                    # Điểm cộng tên file/đường dẫn chứa từ khóa BÌA
                    if 'cover' in file_name:
                        score += 1500
                    elif 'cover' in path_lower:
                        score += 800
                        
                    if any(k in file_name for k in ['bia', 'bìa', 'jacket', 'front']):
                        score += 1000
                    
                    # Điểm trừ cực mạnh cho các trang tiêu đề lót, logo, mặt sau
                    bad_keywords = ['title', 'titlepage', 'title_page', 'halftitle', 'inner', 'copyright', 'publisher', 'logo', 'back', 'rear', 'barcode', 'author']
                    if any(bad in file_name for bad in bad_keywords):
                        score -= 2000
                    
                    # Đọc thông tin kích thước và tỷ lệ ảnh
                    try:
                        with Image.open(io.BytesIO(img_data)) as pil_img:
                            w, h = pil_img.size
                            if w > 0 and h > 0:
                                ratio = h / float(w)
                                # Tỷ lệ chuẩn của bìa sách là khổ dọc (portrait) từ 1.2 đến 1.85
                                if 1.2 <= ratio <= 1.85:
                                    score += 600
                                elif ratio < 1.0: # Ảnh ngang (landscape) -> thường là banner / minh họa
                                    score -= 800
                                
                                # Ưu tiên ảnh độ phân giải cao
                                pixels = w * h
                                if pixels >= 300000: # >= ~500x600
                                    score += 400
                                elif pixels < 40000: # < 200x200
                                    score -= 500
                    except Exception:
                        pass
                    
                    # Ưu tiên dung lượng file lớn hơn (ảnh bìa chất lượng cao)
                    if len(img_data) > 50000:
                        score += 300
                    
                    if score > best_score:
                        best_score = score
                        best_cover_bytes = img_data
                        
                except Exception as e:
                    print(f"Lỗi kiểm tra ảnh {img_path}: {e}")

            if best_cover_bytes:
                result['cover_b64'] = compress_cover_image(best_cover_bytes)

            # 3. Fallback lấy tóm tắt từ nội dung tài liệu nếu chưa có description
            if not result['summary']:
                for name in namelist:
                    if name.lower().endswith(('.xhtml', '.html', '.htm')) and not any(skip in name.lower() for skip in ['cover', 'title', 'toc', 'nav']):
                        try:
                            doc_soup = BeautifulSoup(zf.read(name), 'html.parser')
                            text = doc_soup.get_text(separator=' ')
                            clean_text = " ".join(text.split())
                            if len(clean_text) > 100:
                                result['summary'] = clean_text[:300] + "..." if len(clean_text) > 300 else clean_text
                                break
                        except Exception:
                            pass

    except Exception as e:
        print(f"Lỗi trích xuất EPUB tổng thể: {e}")
        import traceback
        traceback.print_exc()

    return result
