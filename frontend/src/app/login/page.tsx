'use client';
import { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      // Login to get token
      const res = await axios.post(`${baseUrl}/api/auth/login`, formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      const token = res.data.access_token;
      
      // Fetch user profile
      const userRes = await axios.get(`${baseUrl}/api/auth/me`, {
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
    <div className="min-h-screen bg-[#1F1D20] text-[#F5ECDC] flex flex-col justify-center items-center p-4">
      <Link href="/">
        <div className="flex items-center gap-2 mb-8 cursor-pointer hover:opacity-80">
          <BookOpen size={32} className="text-orange-500" />
          <h1 className="text-4xl font-extrabold text-[#F5ECDC]">
            BookCase<span className="text-orange-500">.</span>
          </h1>
        </div>
      </Link>
      
      <div className="bg-[#2A272A] p-8 md:p-10 rounded-3xl shadow-2xl border border-[#4D4845]/50 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-[#F5ECDC]">Welcome Back</h2>
        
        {error && (
          <div className="bg-red-950/40 border border-red-500/40 text-red-400 p-3 rounded-xl mb-4 text-sm text-center">
            {error}
          </div>
        )}
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-[#D7C9B2]">Username</label>
            <input 
              type="text" 
              className="w-full bg-[#1F1D20] border border-[#4D4845] rounded-xl px-4 py-3 text-sm text-[#F5ECDC] focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1 text-[#D7C9B2]">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? 'text' : 'password'} 
                className="w-full bg-[#1F1D20] border border-[#4D4845] rounded-xl px-4 py-3 pr-10 text-sm text-[#F5ECDC] focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7B7369] hover:text-[#F5ECDC] transition-colors"
                title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          
          <button type="submit" className="w-full btn-primary mt-4">
            Login
          </button>
        </form>

        <div className="mt-6 text-center space-y-2 text-sm">
          <p className="text-[#D7C9B2]">
            Chưa có tài khoản?{' '}
            <Link href="/register" className="text-orange-500 font-bold hover:underline">
              Đăng ký ngay
            </Link>
          </p>
          <p>
            <Link href="/forgot-password" className="text-[#7B7369] font-medium hover:text-orange-500 hover:underline">
              Quên mật khẩu?
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
