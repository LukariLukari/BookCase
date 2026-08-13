import BooksClient from './BooksClient';

export const revalidate = 0; // Dynamic fetch on every request

export default async function Home() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  let books = [];
  
  try {
    const res = await fetch(`${API_URL}/api/books`, { 
      cache: 'no-store' 
    });
    
    if (res.ok) {
      books = await res.json();
    }
  } catch (error) {
    console.error('Lỗi khi fetch sách tại Server Component:', error);
  }

  return <BooksClient initialBooks={books} />;
}
