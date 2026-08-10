'use client';
import { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, ArrowLeft, Mail, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function RegisterPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  const { login } = useAuth();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      const res = await axios.post(`${baseUrl}/api/auth/send-otp`, {
        email: email,
        purpose: 'register'
      });
      setSuccessMsg(res.data.message || 'Mã OTP đã được gửi đến email của bạn.');
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Có lỗi xảy ra khi gửi OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      const res = await axios.post(`${baseUrl}/api/auth/register`, {
        username,
        email,
        password,
        otp_code: otpCode,
        role: 'user'
      });
      
      // Auto-login after successful registration
      const token = res.data.access_token;
      const user = res.data.user;
      login(token, user);
      
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Xác thực OTP thất bại. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
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
      
      <div className="bg-white p-8 md:p-10 rounded-3xl shadow-xl w-full max-w-md relative overflow-hidden">
        {step === 2 && (
          <button 
            onClick={() => setStep(1)} 
            className="absolute top-8 left-8 text-gray-400 hover:text-black transition-colors"
            title="Quay lại"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        
        <h2 className="text-2xl font-bold mb-2 text-center mt-2">Đăng ký tài khoản</h2>
        <p className="text-gray-500 text-sm text-center mb-6">
          {step === 1 ? 'Khám phá thế giới sách không giới hạn' : 'Vui lòng kiểm tra email của bạn'}
        </p>
        
        {error && (
          <div className="bg-red-50 text-red-500 p-3 rounded-xl mb-4 text-sm text-center font-medium">
            {error}
          </div>
        )}
        
        {successMsg && step === 2 && !error && (
          <div className="bg-green-50 text-green-600 p-3 rounded-xl mb-4 text-sm text-center font-medium flex items-center justify-center gap-2">
            <CheckCircle2 size={16} /> {successMsg}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSendOTP} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Username</label>
              <input 
                type="text" 
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                placeholder="Ví dụ: lukari"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Email <span className="text-red-500">*</span></label>
              <input 
                type="email" 
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="email@gmail.com"
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
                minLength={6}
                placeholder="Tối thiểu 6 ký tự"
              />
            </div>
            
            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition-colors mt-6 shadow-md flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isLoading ? 'Đang gửi...' : 'Gửi mã OTP'} <Mail size={16} />
            </button>
            
            <div className="mt-6 text-center text-sm">
              <p className="text-gray-500">
                Đã có tài khoản?{' '}
                <Link href="/login" className="text-orange-500 font-bold hover:underline">
                  Đăng nhập
                </Link>
              </p>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <label className="block text-sm font-medium mb-1 text-center">Mã OTP (6 số)</label>
              <input 
                type="text" 
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-center text-2xl font-bold tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                maxLength={6}
                placeholder="••••••"
              />
            </div>
            
            <button 
              type="submit" 
              disabled={isLoading || otpCode.length !== 6}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition-colors mt-6 shadow-md disabled:opacity-50"
            >
              {isLoading ? 'Đang xác thực...' : 'Xác nhận Đăng ký'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
