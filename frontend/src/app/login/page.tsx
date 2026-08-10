'use client';
import { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      // Login to get token
      const res = await axios.post(`${API_URL}/api/auth/login`, formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      const token = res.data.access_token;
      
      // Fetch user profile
      const userRes = await axios.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      login(token, userRes.data);
    } catch (err: any) {
      if (!err.response) {
        setError(`Không thể kết nối tới Backend API (${API_URL}). Vui lòng kiểm tra địa chỉ Backend API hoặc kiểm tra server đã được khởi động chưa!`);
      } else {
        setError(err.response?.data?.detail || 'Đăng nhập thất bại. Vui lòng kiểm tra lại tài khoản & mật khẩu.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f7f4] flex flex-col justify-center items-center p-4">
      <Link href="/">
        <div className="flex items-center gap-2 mb-8 cursor-pointer hover:opacity-80">
          <BookOpen size={32} className="text-orange-500" />
          <h1 className="text-4xl font-extrabold text-black">
            BookCase<span className="text-orange-500">.</span>
          </h1>
        </div>
      </Link>
      
      <div className="bg-white p-8 md:p-10 rounded-3xl shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center">Welcome Back</h2>
        
        {error && (
          <div className="bg-red-50 text-red-500 p-3 rounded-xl mb-4 text-sm text-center">
            {error}
          </div>
        )}
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Username</label>
            <input 
              type="text" 
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input 
              type="password" 
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          <button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition-colors mt-4 shadow-md">
            Login
          </button>
        </form>

        <div className="mt-6 text-center space-y-2 text-sm">
          <p className="text-gray-500">
            Chưa có tài khoản?{' '}
            <Link href="/register" className="text-orange-500 font-bold hover:underline">
              Đăng ký ngay
            </Link>
          </p>
          <p>
            <Link href="/forgot-password" className="text-gray-400 font-medium hover:text-orange-500 hover:underline">
              Quên mật khẩu?
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
