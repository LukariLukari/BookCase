import asyncio
import os
import requests
from telethon import TelegramClient, events
from telethon.sessions import StringSession

api_id = 31840703
api_hash = 'e72130f8cbf7d43f7ece893c526019e8'
BOT_USERNAME = '@cloudilybot'

async def test_search():
    client = TelegramClient('user_session', api_id, api_hash)
    await client.connect()
    
    query = "bố con cá gai"
    print(f"Sending search: /search {query}")
    await client.send_message(BOT_USERNAME, f"/search {query}")
    
    future_reply = asyncio.Future()
    
    @client.on(events.NewMessage(chats=BOT_USERNAME))
    async def handler(event):
        if not future_reply.done():
            if event.message.reply_markup:
                future_reply.set_result(event.message)
                
    message = await asyncio.wait_for(future_reply, timeout=15.0)
    client.remove_event_handler(handler)
    
    print("Received reply markup!")
    book_buttons = []
    for r, row in enumerate(message.reply_markup.rows):
        for c, button in enumerate(row.buttons):
            txt = button.text or ""
            if "Trước" in txt or "Tiếp" in txt or "Trang" in txt:
                continue
            book_buttons.append((r, c, txt))
            print(f"Book Button [{r},{c}]: {txt}")
            
    if book_buttons:
        target_r, target_c, target_txt = book_buttons[0]
        print(f"\nClicking button [{target_r},{target_c}]: {target_txt}...")
        
        reply_future = asyncio.Future()
        
        @client.on(events.NewMessage(chats=BOT_USERNAME))
        async def reply_handler(event):
            if not reply_future.done():
                reply_future.set_result(event.message)
                
        # Click the button by index
        await message.click(0)
        
        detail_msg = await asyncio.wait_for(reply_future, timeout=15.0)
        client.remove_event_handler(reply_handler)
        
        print("\nDetail Message Received:")
        print("Text:", detail_msg.text)
        
        url = None
        if detail_msg.entities:
            for ent, text_chunk in detail_msg.get_entities_text():
                if hasattr(ent, 'url') and ent.url:
                    url = ent.url
                    print(f"Found URL entity: {url} (text: {text_chunk})")
                    
        if not url and detail_msg.reply_markup:
            for row in detail_msg.reply_markup.rows:
                for b in row.buttons:
                    if hasattr(b, 'url') and b.url:
                        url = b.url
                        print(f"Found Button URL: {url}")
                        
        if url:
            print(f"\nDownloading from URL: {url}")
            res = requests.get(url, stream=True, timeout=30)
            print(f"Status Code: {res.status_code}")
            print(f"Headers: {res.headers.get('content-type')}, {res.headers.get('content-disposition')}")

asyncio.run(test_search())
