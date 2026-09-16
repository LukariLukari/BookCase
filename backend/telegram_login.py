from telethon.sync import TelegramClient
from telethon.sessions import StringSession
import os

api_id = 31840703
api_hash = 'e72130f8cbf7d43f7ece893c526019e8'

# Nếu session cũ bị lỗi AuthKeyDuplicatedError hoặc bị Telegram thu hồi, xóa để đăng nhập mới
if os.path.exists('user_session.session'):
    try:
        test_client = TelegramClient('user_session', api_id, api_hash)
        test_client.connect()
        if not test_client.is_user_authorized():
            test_client.disconnect()
            os.remove('user_session.session')
    except Exception:
        if os.path.exists('user_session.session'):
            os.remove('user_session.session')

client = TelegramClient('user_session', api_id, api_hash)

async def main():
    print("Connecting to Telegram...")
    await client.start()
    
    print("\n✅ Đăng nhập thành công! File 'user_session.session' đã được tạo.")
    
    s = StringSession()
    s._dc_id = client.session.dc_id
    s._server_address = client.session.server_address
    s._port = client.session.port
    s._auth_key = client.session.auth_key
    saved_str = s.save()
    print("\n=========================================================================================")
    print("MÃ STRING SESSION (Dán vào biến TELEGRAM_STRING_SESSION trên Render nếu cần):")
    print("=========================================================================================")
    print(saved_str)
    print("=========================================================================================\n")
    
    # Test ping bot
    for bot in ['@cloudilybot', '@LukariEbook_bot']:
        try:
            print(f"Kiểm tra kết nối đến bot {bot}...")
            await client.send_message(bot, '/start')
            print(f"✅ Gửi lệnh /start tới {bot} thành công.")
        except Exception as e:
            print(f"⚠️ Lưu ý với {bot}: {e}")

with client:
    client.loop.run_until_complete(main())
