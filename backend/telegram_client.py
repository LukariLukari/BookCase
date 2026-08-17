from telethon import TelegramClient, events
from telethon.tl.types import ReplyInlineMarkup
import asyncio
import os

from telethon.sessions import StringSession

api_id = 31840703
api_hash = 'e72130f8cbf7d43f7ece893c526019e8'
BOT_USERNAME = '@LukariEbook_bot'

# Connect to the existing session
string_session = os.getenv('TELEGRAM_STRING_SESSION')
if string_session:
    client = TelegramClient(StringSession(string_session), api_id, api_hash)
else:
    client = TelegramClient('user_session', api_id, api_hash)

async def connect_client():
    if not client.is_connected():
        await client.connect()

CLOUDILY_BOT = '@cloudilybot'

async def search_zlib_bot(query: str):
    try:
        await client.send_message(BOT_USERNAME, query)
        future_reply = asyncio.Future()
        
        @client.on(events.NewMessage(chats=BOT_USERNAME))
        async def handler(event):
            if not future_reply.done():
                future_reply.set_result(event.message)
                
        message = await asyncio.wait_for(future_reply, timeout=12.0)
        client.remove_event_handler(handler)
        
        text = message.text or ""
        lines = text.split('\n')
        import re
        
        books = []
        current_book = {}
        for i, line in enumerate(lines):
            line = line.strip()
            if not line: continue
            
            if line.startswith('📚'):
                current_book = {
                    'title': line.replace('📚', '').strip(), 
                    'author': 'Z-Library Bot', 
                    'language': '', 
                    'extension': '', 
                    'size': '', 
                    'id': ''
                }
            elif line.startswith('🌐'):
                if 'language' in current_book:
                    current_book['language'] = line.replace('🌐', '').strip()
            elif line.startswith('/book_'):
                match = re.search(r'(/book_[^\s]+)\s*\(([^,]+),\s*([^)]+)\)', line)
                if match:
                    current_book['id'] = match.group(1)
                    current_book['extension'] = match.group(2).strip()
                    current_book['size'] = match.group(3).strip()
                else:
                    current_book['id'] = line.split(' ')[0]
                
                for j in range(i-1, -1, -1):
                    prev = lines[j].strip()
                    if prev.startswith('📚'): break
                    if not prev.startswith('🌐') and len(prev) > 0:
                        current_book['author'] = prev
                        break
                        
                if current_book.get('id'):
                    books.append(current_book)
                    current_book = {}
        return books
    except Exception as e:
        print(f"Z-Lib Bot Error: {e}")
        return []

import unicodedata

def remove_accents(input_str: str) -> str:
    if not input_str:
        return ""
    nfkd_form = unicodedata.normalize('NFKD', input_str)
    return "".join([c for c in nfkd_form if not unicodedata.combining(c)]).lower()

def calculate_book_relevance(book: dict, query: str) -> int:
    norm_query = remove_accents(query).strip()
    norm_title = remove_accents(book.get('title', '')).strip()
    
    score = 0
    query_words = [w for w in norm_query.split() if len(w) > 0]
    
    # 1. Khớp chuỗi chính xác (Sequence match)
    if norm_query in norm_title:
        score += 1000
    else:
        # Khớp theo số lượng từ xuất hiện trong tiêu đề
        matched_words = sum(1 for w in query_words if w in norm_title)
        if matched_words == len(query_words) and len(query_words) > 0:
            score += 600
        elif matched_words > 1:
            score += matched_words * 150
        elif matched_words == 1:
            score += 20
            
    # 2. Ưu tiên định dạng sách (.epub là số 1)
    ext = (book.get('extension') or '').lower()
    if ext == 'epub':
        score += 350
    elif ext == 'pdf':
        score += 250
    elif ext in ['azw3', 'azw', 'mobi']:
        score += 200
    elif ext in ['prc', 'txt']:
        score += 100

    return score

async def search_cloudily_bot(query: str, max_pages: int = 7):
    try:
        await client.send_message(CLOUDILY_BOT, f"/search {query}")
        
        future_reply = asyncio.Future()
        
        @client.on(events.NewMessage(chats=CLOUDILY_BOT))
        async def handler(event):
            if not future_reply.done():
                text = event.message.text or ""
                if "Đừng vội" in text or "Vui lòng chờ" in text:
                    import re
                    match = re.search(r'chờ\s*\**(\d+)\s*giây', text)
                    wait_sec = int(match.group(1)) + 2 if match else 16
                    print(f"[Cloudily Bot] Rate-limited. Sleeping for {wait_sec} seconds...")
                    await asyncio.sleep(wait_sec)
                    await client.send_message(CLOUDILY_BOT, f"/search {query}")
                elif event.message.reply_markup:
                    future_reply.set_result(event.message)
                
        curr_msg = await asyncio.wait_for(future_reply, timeout=25.0)
        client.remove_event_handler(handler)
        
        all_books = []
        import re

        for page in range(1, max_pages + 1):
            lines = (curr_msg.text or "").split("\n")
            item_lines = []
            for line in lines:
                line_str = line.strip()
                m = re.search(r'(?:📄\s*)?(?:(\d+)\.\s*)?(.*?)\s*\(([^)]+)\)', line_str)
                if m and m.group(2).strip():
                    title_ext = m.group(2).strip('`').strip()
                    size_str = m.group(3).strip('`').strip()
                    raw_ext = title_ext.split(".")[-1].strip('`').strip() if "." in title_ext else ""
                    clean_ext = re.sub(r'[^a-zA-Z0-9]', '', raw_ext).lower()
                    item_lines.append({
                        "title": title_ext,
                        "extension": clean_ext,
                        "size": size_str
                    })

            next_button_idx = None
            book_buttons = []
            curr_btn_idx = 0

            if curr_msg.reply_markup:
                for row in curr_msg.reply_markup.rows:
                    for button in row.buttons:
                        txt = (button.text or "").strip()
                        if "Trước" in txt or "Trang" in txt:
                            curr_btn_idx += 1
                            continue
                        if "Tiếp" in txt:
                            next_button_idx = curr_btn_idx
                            curr_btn_idx += 1
                            continue

                        book_buttons.append((button, curr_btn_idx))
                        curr_btn_idx += 1

            for idx, (button, btn_pos) in enumerate(book_buttons):
                parsed = item_lines[idx] if idx < len(item_lines) else {}
                txt = (button.text or "").strip().lstrip('📥').lstrip('🧙‍♂️').lstrip('📩').strip()
                txt = txt.strip('`').strip()

                full_title = parsed.get("title") or txt
                full_title = full_title.strip('`').strip()
                m_num = re.match(r'^\d+\.\s*', full_title)
                if m_num:
                    full_title = full_title[m_num.end():].strip()

                ext = parsed.get("extension") or ""
                if not ext and "." in full_title:
                    raw_ext = full_title.split(".")[-1].strip('`').strip()
                    ext = re.sub(r'[^a-zA-Z0-9]', '', raw_ext).lower()

                size = parsed.get("size") or ""

                cb_data = getattr(button, 'data', None)
                data_str = cb_data.decode('utf-8') if isinstance(cb_data, bytes) else str(cb_data or "")

                if data_str and data_str.startswith("dl:"):
                    id_str = f"cloudily|data:{data_str}|{query}|{btn_pos}"
                else:
                    id_str = f"cloudily|idx:{btn_pos}|{query}|{btn_pos}"

                book_item = {
                    'title': full_title,
                    'author': 'Cloudily Bot',
                    'language': 'Vietnamese/English',
                    'extension': ext,
                    'size': size,
                    'id': id_str
                }
                
                # Tính điểm độ khớp và chỉ lưu sách có độ tương quan
                score = calculate_book_relevance(book_item, query)
                book_item['_score'] = score
                all_books.append(book_item)

            # Kiểm tra nếu đã tìm đủ sách chuẩn khớp exact match với định dạng epub thì có thể dừng sớm
            exact_epub_matches = [b for b in all_books if b['_score'] >= 1300]
            if len(exact_epub_matches) >= 3 and page >= 4:
                print(f"[Cloudily Bot] Early stopping at page {page} with {len(exact_epub_matches)} exact EPUB matches.")
                break

            if next_button_idx is not None and page < max_pages:
                edit_future = asyncio.Future()

                @client.on(events.MessageEdited(chats=CLOUDILY_BOT))
                async def edit_handler(event):
                    if not edit_future.done():
                        edit_future.set_result(event.message)

                await curr_msg.click(next_button_idx)
                try:
                    curr_msg = await asyncio.wait_for(edit_future, timeout=8.0)
                except Exception as e:
                    print(f"[Cloudily Bot] No more pages or edit timeout: {e}")
                    break
                finally:
                    client.remove_event_handler(edit_handler)
            else:
                break

        # Loại bỏ trùng lặp tiêu đề + định dạng
        unique_books = []
        seen = set()
        for b in sorted(all_books, key=lambda x: x['_score'], reverse=True):
            key = f"{remove_accents(b['title'])}_{b['extension']}"
            if key not in seen:
                seen.add(key)
                unique_books.append(b)

        return unique_books
    except Exception as e:
        print(f"Cloudily Bot Error: {e}")
        return []

async def search_books_via_telegram(query: str, source: str = None):
    try:
        await connect_client()
        
        if not await client.is_user_authorized():
            print("[Telegram] Client chưa được xác thực.")
            return []
            
        if source == 'zlib':
            return await search_zlib_bot(query)
        elif source == 'cloudily':
            return await search_cloudily_bot(query)
        else:
            res_zlib, res_cloud = await asyncio.gather(
                search_zlib_bot(query),
                search_cloudily_bot(query),
                return_exceptions=True
            )
            books_zlib = res_zlib if isinstance(res_zlib, list) else []
            books_cloud = res_cloud if isinstance(res_cloud, list) else []
            return books_zlib + books_cloud
    except Exception as e:
        print(f"search_books_via_telegram error: {e}")
        return []

async def download_cloudily_bot(book_id: str):
    parts = book_id.split('|')
    
    cb_data_str = None
    query = ""
    button_idx = 0
    
    if len(parts) >= 4 and parts[1].startswith("data:"):
        cb_data_str = parts[1][5:]
        query = parts[2]
        button_idx = int(parts[3])
    elif len(parts) >= 3:
        query = parts[1]
        button_idx = int(parts[2])
    else:
        raise Exception("ID sách Cloudily không hợp lệ.")
        
    msgs = await client.get_messages(CLOUDILY_BOT, limit=10)
    target_msg = None
    target_button_idx = button_idx
    import re
    
    for m in msgs:
        if m.reply_markup and m.text and ("kết quả" in m.text or (query and query.lower() in m.text.lower())):
            if cb_data_str:
                curr_idx = 0
                for r in m.reply_markup.rows:
                    for b in r.buttons:
                        b_data = getattr(b, 'data', None)
                        b_data_str = b_data.decode('utf-8') if isinstance(b_data, bytes) else str(b_data or "")
                        if b_data_str == cb_data_str:
                            target_msg = m
                            target_button_idx = curr_idx
                            break
                        curr_idx += 1
                    if target_msg: break
            if not target_msg:
                target_msg = m
            break
            
    if not target_msg:
        await client.send_message(CLOUDILY_BOT, f"/search {query}")
        
        future_reply = asyncio.Future()
        @client.on(events.NewMessage(chats=CLOUDILY_BOT))
        async def handler(event):
            if not future_reply.done():
                text = event.message.text or ""
                if "Đừng vội" in text or "Vui lòng chờ" in text:
                    match = re.search(r'chờ\s*\**(\d+)\s*giây', text)
                    wait_sec = int(match.group(1)) + 2 if match else 16
                    print(f"[Cloudily Bot] Rate limited during download. Sleeping {wait_sec}s...")
                    await asyncio.sleep(wait_sec)
                    await client.send_message(CLOUDILY_BOT, f"/search {query}")
                elif event.message.reply_markup:
                    future_reply.set_result(event.message)
                    
        target_msg = await asyncio.wait_for(future_reply, timeout=25.0)
        client.remove_event_handler(handler)
        
        if cb_data_str and target_msg.reply_markup:
            curr_idx = 0
            for r in target_msg.reply_markup.rows:
                for b in r.buttons:
                    b_data = getattr(b, 'data', None)
                    b_data_str = b_data.decode('utf-8') if isinstance(b_data, bytes) else str(b_data or "")
                    if b_data_str == cb_data_str:
                        target_button_idx = curr_idx
                        break
                    curr_idx += 1

    reply_future = asyncio.Future()
    
    @client.on(events.NewMessage(chats=CLOUDILY_BOT))
    async def reply_handler(event):
        if not reply_future.done():
            text = event.message.text or ""
            if event.message.document or "Nhấn vào đây để Tải Xuống" in text or "http" in text:
                reply_future.set_result(event.message)
                
    @client.on(events.MessageEdited(chats=CLOUDILY_BOT))
    async def edit_handler(event):
        if not reply_future.done():
            text = event.message.text or ""
            if event.message.document or "Nhấn vào đây để Tải Xuống" in text or "http" in text:
                reply_future.set_result(event.message)

    await target_msg.click(target_button_idx)
    
    try:
        detail_msg = await asyncio.wait_for(reply_future, timeout=20.0)
    finally:
        client.remove_event_handler(reply_handler)
        client.remove_event_handler(edit_handler)
    
    if detail_msg.document:
        print("[Cloudily Bot] Sent Telegram document directly...")
        file_bytes = await client.download_media(detail_msg.document, bytes)
        filename = "cloudily_book"
        for attr in detail_msg.document.attributes:
            if hasattr(attr, 'file_name'):
                filename = attr.file_name
        return file_bytes, filename
        
    url = None
    if detail_msg.entities:
        for ent, text_chunk in detail_msg.get_entities_text():
            if hasattr(ent, 'url') and ent.url:
                url = ent.url
                break
                
    if not url and detail_msg.text:
        match_url = re.search(r'\[.*?\]\((https?://[^\)]+)\)', detail_msg.text)
        if match_url:
            url = match_url.group(1)
        else:
            match_raw = re.search(r'(https?://[^\s]+)', detail_msg.text)
            if match_raw:
                url = match_raw.group(1)
                
    if not url and detail_msg.reply_markup:
        for row in detail_msg.reply_markup.rows:
            for b in row.buttons:
                if hasattr(b, 'url') and b.url:
                    url = b.url
                    break
                    
    if not url:
        raise Exception("Cloudily Bot không trả về link hoặc file hợp lệ.")
        
    import requests
    import urllib.parse
    
    parsed_url = urllib.parse.urlparse(url)
    encoded_path = urllib.parse.quote(parsed_url.path, safe='/')
    clean_url = urllib.parse.urlunparse((
        parsed_url.scheme,
        parsed_url.netloc,
        encoded_path,
        parsed_url.params,
        parsed_url.query,
        parsed_url.fragment
    ))
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://cloudily.org/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
    }
    
    res = requests.get(clean_url, headers=headers, timeout=120)
    if res.status_code != 200:
        res = requests.get(url, headers=headers, timeout=120)
        
    if res.status_code != 200:
        raise Exception(f"Không thể tải file từ Cloudily. Status: {res.status_code}")
        
    file_bytes = res.content
    if not file_bytes or len(file_bytes) == 0:
        raise Exception("File nhận từ Cloudily bị rỗng (0 bytes).")

    filename = "cloudily_book"
    if 'content-disposition' in res.headers:
        d = res.headers['content-disposition']
        fname = re.findall(r'filename\*?=(?:UTF-8\'\')?"?([^\";]+)"?', d)
        if fname: filename = fname[0]
    elif 'filename=' in url:
        filename = urllib.parse.unquote(url.split('/')[-1].split('?')[0])
        
    return file_bytes, filename

async def download_book_via_telegram(book_id: str):
    await connect_client()
    
    if book_id.startswith('cloudily|'):
        return await download_cloudily_bot(book_id)
        
    # Send the command or click the button
    await client.send_message(BOT_USERNAME, book_id)
        
    try:
        future_reply = asyncio.Future()
        
        @client.on(events.NewMessage(chats=BOT_USERNAME))
        async def handler(event):
            if not future_reply.done():
                if event.message.document:
                    future_reply.set_result(event.message)
                elif event.message.reply_markup:
                    # Chống nhiễu: Bot gửi nút "Click to read full description" cùng với file
                    # Chỉ lấy tin nhắn có nút bấm NẾU nó là thông báo file > 50MB
                    text = event.message.text or ""
                    if "exceeds" in text or "To download the book" in text:
                        future_reply.set_result(event.message)
                
        message = await asyncio.wait_for(future_reply, timeout=30.0)
        client.remove_event_handler(handler)
        
        if message.document:
            print("Downloading file directly from Telegram...")
            file_bytes = await client.download_media(message.document, bytes)
            filename = "downloaded_book"
            for attr in message.document.attributes:
                if hasattr(attr, 'file_name'):
                    filename = attr.file_name
            return file_bytes, filename
        
        elif message.reply_markup:
            # It replied with an inline button link (e.g. file > 50MB)
            import requests
            from bs4 import BeautifulSoup
            import urllib.parse
            
            for row in message.reply_markup.rows:
                for button in row.buttons:
                    if hasattr(button, 'url') and button.url:
                        url = button.url
                        print(f"Downloading from external URL: {url}")
                        
                        # Dùng session để giữ lại cookie đăng nhập (remix_userid, remix_userkey)
                        session = requests.Session()
                        res = session.get(url, timeout=30)
                        
                        if res.status_code == 200:
                            content_type = res.headers.get('content-type', '')
                            
                            # Nếu nó là trang web (HTML), ta cần cào HTML để tìm nút Tải xuống thật sự
                            if 'text/html' in content_type:
                                print("URL is a webpage. Extracting direct download link...")
                                soup = BeautifulSoup(res.text, 'html.parser')
                                
                                # Tìm nút download thật (thường có class addDownloadedBook hoặc href chứa /dl/)
                                dl_button = soup.find('a', class_='addDownloadedBook')
                                if not dl_button:
                                    import re
                                    dl_button = soup.find('a', href=re.compile(r'/dl/'))
                                    
                                if dl_button and dl_button.get('href'):
                                    dl_url = dl_button['href']
                                    if dl_url.startswith('/'):
                                        parsed = urllib.parse.urlparse(url)
                                        dl_url = f"{parsed.scheme}://{parsed.netloc}{dl_url}"
                                        
                                    print(f"Found direct download link: {dl_url}")
                                    # Tải file thật sự bằng session (để giữ cookie)
                                    file_res = session.get(dl_url, stream=True, timeout=120)
                                    if file_res.status_code == 200:
                                        filename = "downloaded_book_large"
                                        if 'content-disposition' in file_res.headers:
                                            import re
                                            d = file_res.headers['content-disposition']
                                            fname = re.findall("filename=\"?([^\"]+)\"?", d)
                                            if fname: filename = fname[0]
                                        return file_res.content, filename
                                    else:
                                        raise Exception(f"Không thể tải file trực tiếp. Status: {file_res.status_code}")
                                else:
                                    raise Exception("Không tìm thấy nút Tải Xuống trên trang web Z-Library.")
                            else:
                                # Nếu url trả về thẳng file luôn
                                filename = "downloaded_book_large"
                                if 'content-disposition' in res.headers:
                                    import re
                                    d = res.headers['content-disposition']
                                    fname = re.findall("filename=\"?([^\"]+)\"?", d)
                                    if fname: filename = fname[0]
                                return res.content, filename
                        else:
                            raise Exception(f"Không thể truy cập link web. Status: {res.status_code}")
            
        raise Exception("Bot không trả về file hoặc link hợp lệ.")
        
    except asyncio.TimeoutError:
        client.remove_event_handler(handler)
        raise Exception("Quá thời gian chờ Bot gửi file.")
    except Exception as e:
        raise e
