'use client';

import { useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { BookOpen, Eye, EyeOff, Loader2, LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    setError('');
    setIsSubmitting(true);

    try {
      const response = await axios.post('/api/auth/login', {
        username: username.trim(),
        password,
      });
      login(response.data.access_token, response.data.user);
    } catch (err: unknown) {
      if (!axios.isAxiosError(err) || !err.response) {
        setError('Không thể kết nối tới máy chủ dữ liệu. Vui lòng thử lại sau.');
      } else if (err.response.status === 401) {
        setError('Tên đăng nhập hoặc mật khẩu không đúng.');
      } else {
        setError(String(err.response.data?.detail || 'Đăng nhập thất bại. Vui lòng thử lại.'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#D8C9BB] px-4 py-10 text-[#1C1917]">
      <div className="pointer-events-none absolute -left-28 top-[-120px] h-80 w-80 rounded-full bg-[#F4EDE4]/70 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-36 right-[-80px] h-96 w-96 rounded-full bg-[#1B2A4A]/10 blur-3xl" />

      <div className="relative w-full max-w-[460px]">
        <Link href="/" className="mx-auto mb-7 flex w-fit items-center gap-3 rounded-2xl px-3 py-2 transition hover:bg-[#FBF8F4]/50 active:scale-[0.98]">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1B2A4A] text-white shadow-[0_8px_18px_rgba(27,42,74,.24)]">
            <BookOpen size={23} strokeWidth={2.4} />
          </span>
          <span className="text-2xl font-black tracking-[-0.04em] text-[#1B2A4A]">BOOKCASE.</span>
        </Link>

        <section className="rounded-[34px] border border-[#EFE8DE] bg-[#FBF8F4] p-6 shadow-[0_22px_55px_rgba(93,72,56,.16)] sm:p-9">
          <div className="mb-7 text-center">
            <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E9E2D9] text-[#1B2A4A]">
              <LogIn size={22} strokeWidth={2.3} />
            </span>
            <h1 className="text-2xl font-black tracking-[-0.03em] sm:text-3xl">Đăng nhập</h1>
            <p className="mt-2 text-sm font-medium text-[#6D625A]">Truy cập đơn hàng, tồn kho và dữ liệu bán hàng của bạn.</p>
          </div>

          {error && (
            <div role="alert" className="mb-5 rounded-2xl border border-[#E9B9B4] bg-[#FFF0EE] px-4 py-3 text-center text-sm font-bold text-[#A53B35]">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-extrabold text-[#3C342F]">Tên đăng nhập</span>
              <input
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                disabled={isSubmitting}
                required
                className="h-13 w-full rounded-2xl border border-[#DED4C8] bg-white px-4 text-base font-semibold outline-none transition placeholder:text-[#A79B91] hover:border-[#BDAE9E] focus:border-[#1B2A4A] focus:ring-4 focus:ring-[#1B2A4A]/10 disabled:opacity-60"
                placeholder="Nhập tên đăng nhập"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-extrabold text-[#3C342F]">Mật khẩu</span>
              <span className="relative block">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isSubmitting}
                  required
                  className="h-13 w-full rounded-2xl border border-[#DED4C8] bg-white px-4 pr-13 text-base font-semibold outline-none transition placeholder:text-[#A79B91] hover:border-[#BDAE9E] focus:border-[#1B2A4A] focus:ring-4 focus:ring-[#1B2A4A]/10 disabled:opacity-60"
                  placeholder="Nhập mật khẩu"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-2.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-[#756A62] transition hover:bg-[#EFE8DE] hover:text-[#1B2A4A] active:scale-90"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </span>
            </label>

            <button
              type="submit"
              disabled={isSubmitting || !username.trim() || !password}
              className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#1B2A4A] px-5 text-sm font-black text-white shadow-[0_8px_18px_rgba(27,42,74,.25)] transition duration-150 hover:-translate-y-0.5 hover:bg-[#131E33] hover:shadow-[0_12px_24px_rgba(27,42,74,.32)] active:translate-y-0 active:scale-[0.98] active:shadow-[0_3px_8px_rgba(27,42,74,.22)] disabled:cursor-not-allowed disabled:translate-y-0 disabled:bg-[#9A948C] disabled:shadow-none"
            >
              {isSubmitting ? <><Loader2 size={18} className="animate-spin" /> Đang đăng nhập...</> : <><LogIn size={18} /> Đăng nhập</>}
            </button>
          </form>

          <div className="mt-6 space-y-3 border-t border-[#E8DED3] pt-6 text-center text-sm font-semibold text-[#6D625A]">
            <p>Chưa có tài khoản? <Link href="/register" className="font-black text-[#1B2A4A] hover:underline">Đăng ký bằng mã admin</Link></p>
            <Link href="/forgot-password" className="inline-block hover:text-[#1B2A4A] hover:underline">Quên mật khẩu?</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
