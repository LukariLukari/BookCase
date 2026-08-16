import os
from telethon.sync import TelegramClient
from telethon.sessions import StringSession

api_id = 31840703
api_hash = 'e72130f8cbf7d43f7ece893c526019e8'

with TelegramClient('user_session', api_id, api_hash) as client:
    # Export SQLite Session to String
    string_session_obj = StringSession()
    string_session_obj.set_dc(
        client.session.dc_id,
        client.session.server_address,
        client.session.port
    )
    string_session_obj.auth_key = client.session.auth_key
    print(string_session_obj.save())
