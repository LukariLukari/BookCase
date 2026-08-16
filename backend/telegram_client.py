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

async def search_books_via_telegram(query: str):
    await connect_client()
    
    if not await client.is_user_authorized():
        raise Exception("Telegram client chưa được xác thực. Vui lòng chạy telegram_login.py trước.")
        
    # Send search query
    await client.send_message(BOT_USERNAME, query)
    
    # Wait for reply (we wait up to 10 seconds for the bot to reply with results)
    books = []
    
    try:
        # Use a temporary event handler to catch the reply
        future_reply = asyncio.Future()
        
        @client.on(events.NewMessage(chats=BOT_USERNAME))
        async def handler(event):
            if not future_reply.done():
                future_reply.set_result(event.message)
                
        # Wait for the first message
        message = await asyncio.wait_for(future_reply, timeout=15.0)
        client.remove_event_handler(handler)
        
        # Z-Library Bot Parser
        text = message.text or ""
        lines = text.split('\n')
        import re
        
        current_book = {}
        for i, line in enumerate(lines):
            line = line.strip()
            if not line: continue
            
            if line.startswith('📚'):
                current_book = {
                    'title': line.replace('📚', '').strip(), 
                    'author': 'Unknown', 
                    'language': '', 
                    'extension': '', 
                    'size': '', 
                    'id': ''
                }
            elif line.startswith('🌐'):
                if 'language' in current_book:
                    current_book['language'] = line.replace('🌐', '').strip()
            elif line.startswith('/book_'):
                # Format: /book_a5jJ5lJP0Rp (pdf, 53.43 MB)
                match = re.search(r'(/book_[^\s]+)\s*\(([^,]+),\s*([^)]+)\)', line)
                if match:
                    current_book['id'] = match.group(1)
                    current_book['extension'] = match.group(2).strip()
                    current_book['size'] = match.group(3).strip()
                else:
                    current_book['id'] = line.split(' ')[0]
                
                # Find author (usually the line before 🌐 or /book_)
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
    except asyncio.TimeoutError:
        client.remove_event_handler(handler)
        raise Exception("Bot Telegram không phản hồi.")
    except Exception as e:
        raise e

async def download_book_via_telegram(book_id: str):
    await connect_client()
    
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
