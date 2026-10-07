'use client';
import { useState } from 'react';
import axios from 'axios';
import { Store, ArrowLeft, Mail, CheckCircle2, Eye, EyeOff } from 'lucide-react';
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
    <div className="min-h-screen bg-[#FCF7DF] text-[#3E3630] flex flex-col justify-center items-center p-4">
      <Link href="/">
        <div className="flex items-center gap-2 mb-8 cursor-pointer hover:opacity-80">
          <Store size={32} className="text-[#3E3630]" />
          <h1 className="text-4xl font-extrabold text-[#3E3630]">
            Billy<span className="text-[#3E3630]/75">.</span>
          </h1>
        </div>
      </Link>
      
      <div className="bg-white p-8 md:p-10 rounded-[34px] shadow-[0_8px_0_0_#3E3630] border-2 border-[#3E3630] w-full max-w-md relative overflow-hidden">
        {step === 2 && (
          <button 
            onClick={() => setStep(1)} 
            className="absolute top-8 left-8 text-[#3E3630]/75 hover:text-[#3E3630] transition-colors"
            title="Quay lại"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        
        {step === 1 && (
          <>
            <h2 className="text-2xl font-black mb-2 text-center mt-2 text-[#3E3630]">Quên mật khẩu</h2>
            <p className="text-[#3E3630]/75 text-sm text-center mb-6 font-medium">
              Nhập email của bạn để nhận mã khôi phục
            </p>
            
            {error && (
              <div className="bg-[#C7D3DB] border border-red-300 text-[#3E3630] p-3 rounded-xl mb-4 text-sm text-center font-bold">
                {error}
              </div>
            )}

            <form onSubmit={handleSendOTP} className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-1 text-[#3E3630]">Email <span className="text-red-500">*</span></label>
                <input 
                  type="email" 
                  className="w-full bg-white border-2 border-[#3E3630] rounded-xl px-4 py-3 text-sm focus:outline-none focus:shadow-[0_3px_0_0_#3E3630] text-[#3E3630] placeholder-[#3E3630]/40"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="email@gmail.com"
                />
              </div>
              
              <button 
                type="submit" 
                disabled={isLoading}
                className="btn-push-primary flex h-12 w-full items-center justify-center gap-2 rounded-2xl font-black text-white disabled:opacity-50 mt-6"
              >
                {isLoading ? 'Đang kiểm tra...' : 'Nhận mã OTP'} <Mail size={16} />
              </button>
              
              <div className="mt-6 text-center text-sm font-semibold">
                <Link href="/login" className="text-[#3E3630]/75 hover:text-[#3E3630] hover:underline">
                  Quay lại Đăng nhập
                </Link>
              </div>
            </form>
          </>
        )}

        {step === 2 && (
          <form onSubmit={handleResetPassword} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-2xl font-black mb-2 text-center mt-2 text-[#3E3630]">Tạo mật khẩu mới</h2>
            <p className="text-[#3E3630]/75 text-sm text-center mb-6 font-medium">
              Vui lòng kiểm tra email và thiết lập mật khẩu
            </p>

            {error && (
              <div className="bg-[#C7D3DB] border border-red-300 text-[#3E3630] p-3 rounded-xl mb-4 text-sm text-center font-bold">
                {error}
              </div>
            )}
            
            {successMsg && !error && (
              <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-3 rounded-xl mb-4 text-sm text-center font-bold flex items-center justify-center gap-2">
                <CheckCircle2 size={16} /> {successMsg}
              </div>
            )}

            <div>
              <label className="block text-sm font-bold mb-1 text-center text-[#3E3630]">Mã OTP (6 số)</label>
              <input 
                type="text" 
                className="w-full bg-white border-2 border-[#3E3630] rounded-xl px-4 py-4 text-center text-2xl font-black tracking-[0.5em] focus:outline-none focus:shadow-[0_3px_0_0_#3E3630] text-[#3E3630]"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                maxLength={6}
                placeholder="••••••"
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-1 mt-2 text-[#3E3630]">Mật khẩu mới</label>
              <div className="relative">
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  className="w-full bg-white border-2 border-[#3E3630] rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:shadow-[0_3px_0_0_#3E3630] text-[#3E3630] placeholder-[#3E3630]/40"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Tối thiểu 6 ký tự"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3E3630]/75 hover:text-[#3E3630] transition-colors"
                  title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            
            <button 
              type="submit" 
              disabled={isLoading || otpCode.length !== 6 || newPassword.length < 6}
              className="btn-push-primary flex h-12 w-full items-center justify-center gap-2 rounded-2xl font-black text-white disabled:opacity-50 mt-6"
            >
              {isLoading ? 'Đang cập nhật...' : 'Cập nhật Mật khẩu'}
            </button>
          </form>
        )}

        {step === 3 && (
          <div className="text-center animate-in zoom-in duration-300 py-6">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={40} className="text-emerald-700" />
            </div>
            <h2 className="text-2xl font-black mb-4 text-[#3E3630]">Cập nhật thành công!</h2>
            <p className="text-[#3E3630]/75 text-sm mb-8 font-medium">
              Mật khẩu của bạn đã được thay đổi an toàn. Bạn có thể đăng nhập ngay bây giờ.
            </p>
            <Link href="/login" className="btn-push-primary inline-flex h-12 w-full items-center justify-center rounded-2xl font-black text-white">
              Đăng nhập ngay
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
