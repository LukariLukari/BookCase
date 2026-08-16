import requests
from bs4 import BeautifulSoup
import urllib.parse
import time

def search(q: str):
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    mirrors = ["libgen.is", "libgen.rs", "libgen.st"]
    books = []
    
    for mirror in mirrors:
        url = f"https://{mirror}/search.php?req={urllib.parse.quote(q)}&res=25&column=def"
        print(f"Trying {url} ...")
        start = time.time()
        try:
            response = requests.get(url, headers=headers, timeout=5)
            print(f"Status: {response.status_code} in {time.time() - start:.2f}s")
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')
                table = soup.find('table', class_='c')
                if not table: 
                    print("No table found")
                    return []
                print("Table found! Parsing...")
                return ["success"]
        except Exception as e:
            print(f"Error on {mirror}: {e}")
            continue
    return books

search("luật tâm thức")
