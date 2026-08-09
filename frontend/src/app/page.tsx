import BooksClient from './BooksClient';

export const revalidate = 60; // Tự động làm mới cache (bộ nhớ đệm) 60 giây một lần

export default async function Home() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  let books = [];
  
  try {
    // Vercel sẽ "nhớ" kết quả này lại thay vì gọi xuống API mỗi khi có khách truy cập
    const res = await fetch(`${API_URL}/api/books`, { 
      next: { revalidate: 60 } 
    });
    
    if (res.ok) {
      books = await res.json();
    }
  } catch (error) {
    console.error('Lỗi khi fetch sách tại Server Component:', error);
  }

  return <BooksClient initialBooks={books} />;
}
