import asyncio
import os
import re
import requests
from typing import List, Optional, Tuple
import schemas
import telegram_client

def normalize_query(q: str) -> str:
    import unicodedata
    if not q:
        return ""
    nfkd_form = unicodedata.normalize('NFKD', q)
    return "".join([c for c in nfkd_form if not unicodedata.combining(c)]).lower().strip()

def search_openlibrary(query: str, limit: int = 15) -> List[schemas.ExternalSearchItem]:
    """
    Tìm kiếm sách miễn phí từ Open Library & Internet Archive.
    Hoạt động độc lập, không cần đăng nhập Telegram, độ tin cậy 100%.
    """
    clean_q = query.strip()
    if not clean_q:
        return []

    url = f"https://openlibrary.org/search.json?q={requests.utils.quote(clean_q)}&limit={limit}"
    results: List[schemas.ExternalSearchItem] = []

    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 BookCaseApp/2.0'
        }
        res = requests.get(url, headers=headers, timeout=10)
        if res.status_code == 200:
            data = res.json()
            for doc in data.get('docs', []):
                title = doc.get('title') or "Sách chưa đặt tên"
                authors = ', '.join(doc.get('author_name', [])) if doc.get('author_name') else "Tác giả chưa rõ"
                ia_ids = doc.get('ia', [])
                has_fulltext = doc.get('has_fulltext', False)
                key = doc.get('key', '')

                # Ưu tiên các sách có id Internet Archive để tải EPUB trực tiếp
                first_ia = ia_ids[0] if (ia_ids and len(ia_ids) > 0) else ""
                ext = 'epub' if (has_fulltext or first_ia) else 'pdf'
                
                item_id = f"openlibrary|{first_ia}|{key}" if first_ia else f"openlibrary|noia|{key}"
                
                lang_list = doc.get('language', [])
                lang_str = ', '.join(lang_list[:2]) if lang_list else 'Đa ngôn ngữ'

                results.append(schemas.ExternalSearchItem(
                    id=item_id,
                    title=f"[Open Library] {title}",
                    author=authors,
                    extension=ext,
                    size="Toàn cầu / Miễn phí",
                    language=lang_str
                ))
    except Exception as e:
        print(f"[OpenLibrary Search Error]: {e}")

    return results

def download_openlibrary_book(book_id: str) -> Tuple[bytes, str]:
    """
    Tải file EPUB/PDF trực tiếp từ Internet Archive / Open Library.
    Nếu sách bản quyền yêu cầu mượn trực tiếp, trả về link MANUAL_DOWNLOAD để mở trên trình duyệt.
    """
    parts = book_id.split('|')
    ia_id = parts[1] if len(parts) > 1 else ""
    key = parts[2] if len(parts) > 2 else ""

    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    }

    if ia_id and ia_id != "noia":
        try:
            meta_url = f"https://archive.org/metadata/{ia_id}"
            r = requests.get(meta_url, headers=headers, timeout=12)
            if r.status_code == 200:
                files = r.json().get('files', [])
                candidate_url = None
                candidate_name = None

                # 1. Tìm file .epub chuẩn
                for f in files:
                    fn = f.get('name', '')
                    if fn.endswith('.epub') and not fn.endswith('_lcp.epub'):
                        candidate_url = f"https://archive.org/download/{ia_id}/{fn}"
                        candidate_name = fn
                        break

                # 2. Tìm file .pdf nếu không có .epub
                if not candidate_url:
                    for f in files:
                        fn = f.get('name', '')
                        if fn.endswith('.pdf') and not fn.endswith('_text.pdf'):
                            candidate_url = f"https://archive.org/download/{ia_id}/{fn}"
                            candidate_name = fn
                            break

                if candidate_url:
                    print(f"[OpenLibrary] Downloading direct file from: {candidate_url}")
                    dl_res = requests.get(candidate_url, headers=headers, stream=True, timeout=60)
                    if dl_res.status_code == 200 and len(dl_res.content) > 1000:
                        return dl_res.content, candidate_name or f"{ia_id}.epub"
                    elif dl_res.status_code in [401, 403]:
                        # Cần mượn trực tiếp từ Open Library / Archive
                        open_url = f"https://archive.org/details/{ia_id}"
                        raise Exception(f"MANUAL_DOWNLOAD|{open_url}")
        except Exception as e:
            err_str = str(e)
            if "MANUAL_DOWNLOAD|" in err_str:
                raise e
            print(f"[OpenLibrary Download Error]: {e}")

    # Fallback mở trang OpenLibrary để user đọc hoặc mượn sách trực tiếp
    ol_url = f"https://openlibrary.org{key}" if key else f"https://archive.org/details/{ia_id}"
    raise Exception(f"MANUAL_DOWNLOAD|{ol_url}")

async def search_all_sources(query: str, source: Optional[str] = None) -> List[schemas.ExternalSearchItem]:
    """
    Bộ định tuyến tìm kiếm đa nguồn:
    - 'cloudily': Tìm qua Bot Cloudily (Kho sách tiếng Việt phong phú)
    - 'zlib': Tìm qua Bot Z-Library
    - 'openlibrary': Tìm qua Open Library / Internet Archive (Không phụ thuộc bot, 100% uptime)
    - 'all' hoặc None: Tìm song song cả Telegram Bot lẫn Open Library và gộp kết quả tối ưu nhất.
    """
    clean_query = query.strip()
    if not clean_query:
        return []

    source_norm = (source or 'all').lower().strip()

    # 1. Chỉ tìm Open Library
    if source_norm == 'openlibrary':
        return search_openlibrary(clean_query)

    # 2. Chỉ tìm Cloudily
    if source_norm == 'cloudily':
        return await telegram_client.search_books_via_telegram(clean_query, source='cloudily')

    # 3. Chỉ tìm Z-Library
    if source_norm == 'zlib':
        return await telegram_client.search_books_via_telegram(clean_query, source='zlib')

    # 4. Tìm song song TẤT CẢ các nguồn (Mặc định)
    # Giúp giải quyết dứt điểm trường hợp Bot Telegram gặp sự cố phiên đăng nhập
    telegram_task = telegram_client.search_books_via_telegram(clean_query, source='all')
    ol_task = asyncio.to_thread(search_openlibrary, clean_query)

    res_tg, res_ol = await asyncio.gather(telegram_task, ol_task, return_exceptions=True)

    books_tg = res_tg if isinstance(res_tg, list) else []
    books_ol = res_ol if isinstance(res_ol, list) else []

    # Gán nhãn cho sách từ Cloudily hoặc Z-Library nếu chưa có
    formatted_tg: List[schemas.ExternalSearchItem] = []
    for item in books_tg:
        if isinstance(item, dict):
            t = item.get('title', '')
            a = item.get('author', '')
            ext = item.get('extension', '')
            sz = item.get('size', '')
            bid = item.get('id', '')
            lang = item.get('language', 'Tiếng Việt')
            formatted_tg.append(schemas.ExternalSearchItem(
                id=bid,
                title=t,
                author=a,
                extension=ext,
                size=sz,
                language=lang
            ))
        elif hasattr(item, 'title'):
            formatted_tg.append(item)

    # Ưu tiên sách Tiếng Việt / Telegram lên đầu, tiếp sau là Open Library
    combined = formatted_tg + books_ol

    # Loại bỏ trùng lặp tiêu đề
    seen = set()
    final_results = []
    for b in combined:
        norm_key = f"{normalize_query(b.title)}_{b.extension}"
        if norm_key not in seen:
            seen.add(norm_key)
            final_results.append(b)

    return final_results
