import os
from telethon.sync import TelegramClient
from telethon.sessions import StringSession

api_id = 31840703
api_hash = 'e72130f8cbf7d43f7ece893c526019e8'

print("--- ĐANG LẤY MÃ TELEGRAM STRING SESSION ---")

# Dùng luôn phiên đăng nhập cũ đã có sẵn (user_session.session)
with TelegramClient('user_session', api_id, api_hash) as client:
    # Lấy đối tượng StringSession từ client hiện tại
    string_session = StringSession(client.session.save())
    
    print("\n✅ Đã lấy mã thành công!")
    print("\n=========================================================================================")
    print("MÃ STRING SESSION CỦA BẠN (COPY TOÀN BỘ ĐOẠN MÃ DÀI DƯỚI ĐÂY):")
    print("=========================================================================================")
    print(string_session.save())
    print("=========================================================================================")
    print("Hãy lưu đoạn mã này lại để lát nữa dán vào biến môi trường TELEGRAM_STRING_SESSION trên Render.")
