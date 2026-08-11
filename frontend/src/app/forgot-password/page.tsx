'use client';
import { useState } from 'react';
import axios from 'axios';
import { BookOpen, ArrowLeft, Mail, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      const res = await axios.post(`${baseUrl}/api/auth/send-otp`, {
        email: email,
        purpose: 'reset_password'
      });
      setSuccessMsg(res.data.message || 'Mã OTP đã được gửi đến email của bạn.');
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Không tìm thấy tài khoản với email này.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      await axios.post(`${baseUrl}/api/auth/reset-password`, {
        email,
        otp_code: otpCode,
        new_password: newPassword
      });
      
      setStep(3); // Success Screen
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
        
        {step === 1 && (
          <>
            <h2 className="text-2xl font-bold mb-2 text-center mt-2">Quên mật khẩu</h2>
            <p className="text-gray-500 text-sm text-center mb-6">
              Nhập email của bạn để nhận mã khôi phục
            </p>
            
            {error && (
              <div className="bg-red-50 text-red-500 p-3 rounded-xl mb-4 text-sm text-center font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSendOTP} className="space-y-4">
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
              
              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition-colors mt-6 shadow-md flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {isLoading ? 'Đang kiểm tra...' : 'Nhận mã OTP'} <Mail size={16} />
              </button>
              
              <div className="mt-6 text-center text-sm">
                <Link href="/login" className="text-gray-400 font-medium hover:text-black hover:underline">
                  Quay lại Đăng nhập
                </Link>
              </div>
            </form>
          </>
        )}

        {step === 2 && (
          <form onSubmit={handleResetPassword} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-2xl font-bold mb-2 text-center mt-2">Tạo mật khẩu mới</h2>
            <p className="text-gray-500 text-sm text-center mb-6">
              Vui lòng kiểm tra email và thiết lập mật khẩu
            </p>

            {error && (
              <div className="bg-red-50 text-red-500 p-3 rounded-xl mb-4 text-sm text-center font-medium">
                {error}
              </div>
            )}
            
            {successMsg && !error && (
              <div className="bg-green-50 text-green-600 p-3 rounded-xl mb-4 text-sm text-center font-medium flex items-center justify-center gap-2">
                <CheckCircle2 size={16} /> {successMsg}
              </div>
            )}

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

            <div>
              <label className="block text-sm font-medium mb-1 mt-2">Mật khẩu mới</label>
              <div className="relative">
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Tối thiểu 6 ký tự"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black transition-colors"
                  title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            
            <button 
              type="submit" 
              disabled={isLoading || otpCode.length !== 6 || newPassword.length < 6}
              className="w-full bg-black hover:bg-gray-800 text-white font-bold py-3 rounded-xl transition-colors mt-6 shadow-md disabled:opacity-50"
            >
              {isLoading ? 'Đang cập nhật...' : 'Cập nhật Mật khẩu'}
            </button>
          </form>
        )}

        {step === 3 && (
          <div className="text-center animate-in zoom-in duration-300 py-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={40} className="text-green-500" />
            </div>
            <h2 className="text-2xl font-bold mb-4">Cập nhật thành công!</h2>
            <p className="text-gray-500 text-sm mb-8">
              Mật khẩu của bạn đã được thay đổi an toàn. Bạn có thể đăng nhập ngay bây giờ.
            </p>
            <Link href="/login" className="inline-block w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition-colors shadow-md">
              Đăng nhập ngay
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
