from telethon.sync import TelegramClient
import os

api_id = 31840703
api_hash = 'e72130f8cbf7d43f7ece893c526019e8'

# This will create a file named 'user_session.session'
client = TelegramClient('user_session', api_id, api_hash)

async def main():
    print("Connecting to Telegram...")
    await client.start()
    
    print("\n✅ Đăng nhập thành công! File 'user_session.session' đã được tạo.")
    print("Bây giờ bạn có thể chạy lại lệnh 'npm run dev' để Backend sử dụng session này.")
    
    # Send a ping to the bot to test
    bot_username = '@LukariEbook_bot'
    print(f"\nTesting connection to {bot_username}...")
    try:
        await client.send_message(bot_username, '/start')
        print(f"✅ Đã gửi lệnh /start tới {bot_username} thành công.")
    except Exception as e:
        print(f"Lỗi khi gửi tin nhắn tới bot: {e}")

with client:
    client.loop.run_until_complete(main())
