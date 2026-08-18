import asyncio
from telegram_client import download_cloudily_bot

async def main():
    # Provide a hardcoded book_id that we know exists
    # We will search first to get a valid book_id
    from telegram_client import search_books_via_telegram
    books = await search_books_via_telegram("mù lòa", source="cloudily")
    for b in books:
        if "Bản sao" in b["title"] or "Jose" in b["title"]:
            print("Found book:", b)
            print("Attempting to download...")
            try:
                content, fname = await download_cloudily_bot(b["id"])
                print("Download success! File size:", len(content), "Filename:", fname)
            except Exception as e:
                print("Download failed:", e)
            break

if __name__ == "__main__":
    asyncio.run(main())
