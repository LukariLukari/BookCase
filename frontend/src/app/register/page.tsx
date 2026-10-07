'use client';
import { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Store, Eye, EyeOff } from 'lucide-react';
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      const res = await axios.post('/api/auth/register', {
        username,
        email,
        password,
        registration_code: registrationCode,
        role: 'user'
      });
      
      const token = res.data.access_token;
      const user = res.data.user;
      login(token, user);
      
    } catch (err: unknown) {
      if (!axios.isAxiosError(err) || !err.response) {
        setError('Không thể kết nối tới server. Vui lòng kiểm tra mạng!');
      } else if (typeof err.response.data?.detail === 'string') {
        setError(err.response.data.detail);
      } else if (Array.isArray(err.response.data?.detail)) {
        setError(err.response.data.detail.map((d: { msg?: string }) => d.msg || 'Dữ liệu không hợp lệ').join(', '));
      } else {
        setError('Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#B7AC9B] text-[#1C1C1B] flex flex-col justify-center items-center p-4">
      <Link href="/">
        <div className="flex items-center gap-2 mb-8 cursor-pointer hover:opacity-80">
          <Store size={32} className="text-[#1C1C1B]" />
          <h1 className="text-4xl font-extrabold text-[#1C1C1B]">
            Billy<span className="text-[#6A5D52]">.</span>
          </h1>
        </div>
      </Link>
      
      <div className="bg-[#E2E2DE] p-8 md:p-10 rounded-[34px] shadow-[0_8px_0_0_#1C1C1B] border-2 border-[#1C1C1B] w-full max-w-md relative overflow-hidden">
        <h2 className="text-2xl font-black mb-2 text-center text-[#1C1C1B] mt-2">Đăng ký tài khoản</h2>
        <p className="text-[#6A5D52] text-sm text-center mb-6 font-medium">
          Tạo tài khoản để quản lý đơn hàng và bán hàng
        </p>
        
        {error && (
          <div className="bg-[#FFF0EE] border border-red-300 text-[#9B3B30] p-3 rounded-xl mb-4 text-sm text-center font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-bold mb-1 text-[#1C1C1B]">Mã đăng ký <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              className="w-full bg-white border-2 border-[#1C1C1B] rounded-xl px-4 py-3 text-sm text-[#1C1C1B] uppercase font-mono tracking-wider focus:outline-none focus:shadow-[0_3px_0_0_#1C1C1B] placeholder-[#979086]"
              value={registrationCode}
              onChange={(e) => setRegistrationCode(e.target.value.toUpperCase())}
              required
              placeholder="NHẬP MÃ ĐĂNG KÝ DO ADMIN CẤP"
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-1 text-[#1C1C1B]">Username</label>
            <input 
              type="text" 
              className="w-full bg-white border-2 border-[#1C1C1B] rounded-xl px-4 py-3 text-sm text-[#1C1C1B] focus:outline-none focus:shadow-[0_3px_0_0_#1C1C1B] placeholder-[#979086]"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              placeholder="Nhập tên đăng nhập"
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-1 text-[#1C1C1B]">Email <span className="text-red-500">*</span></label>
            <input 
              type="email" 
              className="w-full bg-white border-2 border-[#1C1C1B] rounded-xl px-4 py-3 text-sm text-[#1C1C1B] focus:outline-none focus:shadow-[0_3px_0_0_#1C1C1B] placeholder-[#979086]"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="email@gmail.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold mb-1 text-[#1C1C1B]">Mật khẩu</label>
            <div className="relative">
              <input 
                type={showPassword ? 'text' : 'password'} 
                className="w-full bg-white border-2 border-[#1C1C1B] rounded-xl px-4 py-3 pr-10 text-sm text-[#1C1C1B] focus:outline-none focus:shadow-[0_3px_0_0_#1C1C1B] placeholder-[#979086]"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Tối thiểu 6 ký tự"
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6A5D52] hover:text-[#1C1C1B] transition-colors"
                title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          
          <button 
            type="submit" 
            disabled={isLoading}
            className="btn-push-primary flex h-12 w-full items-center justify-center gap-2 rounded-2xl font-black text-white disabled:opacity-50 mt-6"
          >
            {isLoading ? 'Đang xử lý...' : 'Đăng ký'}
          </button>
          
          <div className="mt-6 text-center text-sm font-semibold">
            <p className="text-[#6A5D52]">
              Đã có tài khoản?{' '}
              <Link href="/login" className="text-[#1C1C1B] font-black hover:underline">
                Đăng nhập
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
