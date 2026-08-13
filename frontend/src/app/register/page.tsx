'use client';
import { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, ArrowLeft, Mail, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [registrationCode, setRegistrationCode] = useState('');
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      const res = await axios.post(`${baseUrl}/api/auth/register`, {
        username,
        email,
        password,
        registration_code: registrationCode,
        role: 'user'
      });
      
      // Auto-login after successful registration
      const token = res.data.access_token;
      const user = res.data.user;
      login(token, user);
      
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setIsLoading(false);
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
      
      <div className="bg-[#2A272A] p-8 md:p-10 rounded-3xl shadow-2xl border border-[#4D4845]/50 w-full max-w-md relative overflow-hidden">
        <h2 className="text-2xl font-bold mb-2 text-center text-[#F5ECDC] mt-2">Đăng ký tài khoản</h2>
        <p className="text-[#D7C9B2] text-sm text-center mb-6">
          Khám phá thế giới sách không giới hạn
        </p>
        
        {error && (
          <div className="bg-red-950/40 border border-red-500/40 text-red-400 p-3 rounded-xl mb-4 text-sm text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-[#D7C9B2]">Mã đăng ký <span className="text-red-400">*</span></label>
            <input 
              type="text" 
              className="w-full bg-[#1F1D20] border border-[#4D4845] rounded-xl px-4 py-3 text-sm text-[#F5ECDC] uppercase font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-orange-500/50 placeholder-[#7B7369]"
              value={registrationCode}
              onChange={(e) => setRegistrationCode(e.target.value.toUpperCase())}
              required
              placeholder="NHẬP MÃ ĐĂNG KÝ DO ADMIN CẤP"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-[#D7C9B2]">Username</label>
            <input 
              type="text" 
              className="w-full bg-[#1F1D20] border border-[#4D4845] rounded-xl px-4 py-3 text-sm text-[#F5ECDC] focus:outline-none focus:ring-2 focus:ring-orange-500/50 placeholder-[#7B7369]"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              placeholder="Nhập tên đăng nhập"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-[#D7C9B2]">Email <span className="text-red-400">*</span></label>
            <input 
              type="email" 
              className="w-full bg-[#1F1D20] border border-[#4D4845] rounded-xl px-4 py-3 text-sm text-[#F5ECDC] focus:outline-none focus:ring-2 focus:ring-orange-500/50 placeholder-[#7B7369]"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="email@gmail.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1 text-[#D7C9B2]">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? 'text' : 'password'} 
                className="w-full bg-[#1F1D20] border border-[#4D4845] rounded-xl px-4 py-3 pr-10 text-sm text-[#F5ECDC] focus:outline-none focus:ring-2 focus:ring-orange-500/50 placeholder-[#7B7369]"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Tối thiểu 6 ký tự"
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
          
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full btn-primary mt-6"
          >
            {isLoading ? 'Đang xử lý...' : 'Đăng ký'}
          </button>
          
          <div className="mt-6 text-center text-sm">
            <p className="text-[#D7C9B2]">
              Đã có tài khoản?{' '}
              <Link href="/login" className="text-orange-500 font-bold hover:underline">
                Đăng nhập
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
