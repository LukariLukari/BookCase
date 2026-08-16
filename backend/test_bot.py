import asyncio
from telegram_client import download_book_via_telegram

async def main():
    try:
        res = await download_book_via_telegram('/book_agjrd3bK0Oe')
        if res is None:
            print("IT RETURNED NONE!")
        else:
            print("IT RETURNED:", type(res), type(res[0]) if isinstance(res, tuple) else "")
    except Exception as e:
        print("EXCEPTION:", repr(e))

asyncio.run(main())
