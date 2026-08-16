import requests
from bs4 import BeautifulSoup
import urllib.parse

def search_libgen(query: str):
    headers = {'User-Agent': 'Mozilla/5.0'}
    url = f"https://libgen.is/search.php?req={urllib.parse.quote(query)}&res=25&column=def"
    print(f"Fetching {url}")
    response = requests.get(url, headers=headers, timeout=10)
    soup = BeautifulSoup(response.text, 'html.parser')
    
    table = soup.find('table', class_='c')
    if not table: return []
    
    books = []
    rows = table.find_all('tr')[1:]
    for row in rows:
        cols = row.find_all('td')
        if len(cols) < 9: continue
        
        author = cols[1].get_text(strip=True)
        title_td = cols[2]
        title_links = title_td.find_all('a')
        
        title = ""
        for a in title_links:
            if a.get('id'):
                title = a.get_text(strip=True)
                break
        if not title and title_links:
            title = title_links[0].get_text(strip=True)
            
        md5_link = None
        for a in title_links:
            href = a.get('href', '')
            if href.startswith('book/index.php?md5='):
                md5_link = href.split('md5=')[1]
                break
                
        if not md5_link and len(cols) > 9:
            mirrors = cols[9].find_all('a')
            if mirrors:
                href = mirrors[0].get('href', '')
                if 'md5=' in href:
                    md5_link = href.split('md5=')[1]
                elif 'library.lol' in href:
                    md5_link = href.split('/')[-1]
                    
        ext = cols[8].get_text(strip=True).lower()
        if ext not in ['pdf', 'epub']: continue
        
        books.append({
            "md5": md5_link,
            "title": title,
            "author": author,
            "extension": ext
        })
    return books

if __name__ == "__main__":
    books = search_libgen("Bố con cá gai")
    for b in books:
        print(b)
