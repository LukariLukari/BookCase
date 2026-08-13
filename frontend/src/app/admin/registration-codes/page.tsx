'use client';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import { KeyRound, Plus, Copy, Check, Trash2, ShieldCheck, ShieldAlert, Loader2, RefreshCw } from 'lucide-react';

interface RegistrationCode {
  id: string;
  code: string;
  is_used: boolean;
  used_by_username: string | null;
  created_at: string;
  created_by: string | null;
}

export default function AdminRegistrationCodesPage() {
  const { user, token, logout, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();

  const [codes, setCodes] = useState<RegistrationCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;

  useEffect(() => {
    if (!isAuthLoading && (!user || user.role !== 'admin')) {
      router.push('/');
    }
  }, [user, isAuthLoading, router]);

  useEffect(() => {
    if (!isAuthLoading && user?.role === 'admin') {
      fetchCodes();
    }
  }, [isAuthLoading, user]);

  const getHeaders = () => {
    const authToken = token || localStorage.getItem('access_token') || localStorage.getItem('token');
    return { Authorization: `Bearer ${authToken}` };
  };

  const fetchCodes = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${baseUrl}/api/admin/registration-codes`, {
        headers: getHeaders()
      });
      setCodes(res.data);
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 401) {
        logout();
      } else {
        setError(err.response?.data?.detail || 'Không thể tải danh sách mã đăng ký.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCode = async () => {
    try {
      setIsCreating(true);
      setError(null);
      const res = await axios.post(`${baseUrl}/api/admin/registration-codes`, {}, {
        headers: getHeaders()
      });
      const newCode = res.data.code;
      navigator.clipboard.writeText(newCode);
      setSuccessNotice(`Đã tạo thành công và tự động sao chép mã: ${newCode}`);
      setTimeout(() => setSuccessNotice(null), 5000);
      await fetchCodes();
    } catch (err: any) {
      if (err.response?.status === 401) {
        logout();
      } else {
        setError(err.response?.data?.detail || 'Lỗi khi tạo mã đăng ký.');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleRegenerateCode = async (id: string) => {
    try {
      setError(null);
      const res = await axios.put(`${baseUrl}/api/admin/registration-codes/${id}/regenerate`, {}, {
        headers: getHeaders()
      });
      const newCode = res.data.code;
      navigator.clipboard.writeText(newCode);
      setSuccessNotice(`Đã tạo lại thành công & tự động sao chép mã mới: ${newCode}`);
      setTimeout(() => setSuccessNotice(null), 5000);
      setCodes(prev => prev.map(c => c.id === id ? res.data : c));
    } catch (err: any) {
      if (err.response?.status === 401) {
        logout();
      } else {
        setError(err.response?.data?.detail || 'Lỗi khi đổi mã mới.');
      }
    }
  };

  const handleDeleteCode = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa mã đăng ký này?')) return;
    try {
      setError(null);
      await axios.delete(`${baseUrl}/api/admin/registration-codes/${id}`, {
        headers: getHeaders()
      });
      setCodes(prev => prev.filter(c => c.id !== id));
    } catch (err: any) {
      if (err.response?.status === 401) {
        logout();
      } else {
        setError(err.response?.data?.detail || 'Lỗi khi xóa mã.');
      }
    }
  };

  const copyToClipboard = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isAuthLoading || !user || user.role !== 'admin') {
    return <div className="min-h-screen bg-[#1F1D20] flex items-center justify-center font-bold text-[#D7C9B2]">Đang tải...</div>;
  }

  return (
    <div className="flex bg-[#1F1D20] text-[#F5ECDC] min-h-screen font-sans selection:bg-orange-950/60 overflow-x-hidden">
      <Sidebar />
      <div className="flex-1 ml-0 md:ml-64 pt-16 md:pt-0 flex flex-col min-h-screen w-full max-w-full">
        
        {/* Header */}
        <header className="sticky top-16 md:top-0 z-30 bg-[#1F1D20]/90 backdrop-blur-md px-4 py-4 md:px-10 md:py-6 flex justify-between items-center border-b border-[#4D4845]/40">
          <div className="flex items-center gap-3 text-xl font-bold">
            <KeyRound size={24} className="text-orange-500" />
            <span className="text-[#F5ECDC]">Quản Lý Mã Đăng Ký</span>
          </div>
          <button 
            onClick={handleCreateCode}
            disabled={isCreating}
            className="btn-primary !rounded-full !py-2.5 md:!py-3 !px-5 md:!px-6 shadow-md flex items-center gap-2"
          >
            {isCreating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            <span>Tạo Mã Mới</span>
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 px-4 md:px-10 pt-8 pb-12">
          {error && (
            <div className="bg-red-950/40 border border-red-500/40 text-red-400 p-4 rounded-2xl text-sm font-bold mb-6 text-center">
              {error}
            </div>
          )}

          {successNotice && (
            <div className="bg-green-950/40 border border-green-500/40 text-green-400 p-4 rounded-2xl text-sm font-bold mb-6 text-center flex items-center justify-center gap-2">
              <Check size={18} className="text-green-400" />
              <span>{successNotice}</span>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center mt-20">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-orange-500 border-t-transparent"></div>
            </div>
          ) : (
            <div className="bg-[#2A272A] rounded-3xl p-6 md:p-8 shadow-md border border-[#4D4845]/50">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-[#F5ECDC]">Danh sách mã đăng ký</h2>
                  <p className="text-sm text-[#D7C9B2]">Mã ngẫu nhiên được Admin cấp cho thành viên để đăng ký tài khoản.</p>
                </div>
                <span className="text-xs font-bold px-3 py-1 bg-[#1F1D20] text-[#D7C9B2] border border-[#4D4845]/40 rounded-full">
                  Tổng: {codes.length} mã
                </span>
              </div>

              {codes.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-[#4D4845]/60 rounded-2xl">
                  <KeyRound size={48} className="text-[#7B7369] mx-auto mb-3" />
                  <p className="text-[#D7C9B2] font-medium mb-4">Chưa có mã đăng ký nào.</p>
                  <button 
                    onClick={handleCreateCode}
                    disabled={isCreating}
                    className="btn-primary"
                  >
                    <Plus size={16} />
                    <span>Tạo mã ngay</span>
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#4D4845]/50 text-xs font-bold text-[#7B7369] uppercase tracking-wider">
                        <th className="pb-4 pl-4">Mã Code</th>
                        <th className="pb-4">Trạng thái</th>
                        <th className="pb-4">Người sử dụng</th>
                        <th className="pb-4">Ngày tạo</th>
                        <th className="pb-4 pr-4 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#4D4845]/30 text-sm">
                      {codes.map((item) => (
                        <tr key={item.id} className="hover:bg-[#1F1D20]/50 transition-colors">
                          <td className="py-4 pl-4 font-mono font-bold text-base text-orange-400">
                            {item.code}
                          </td>
                          <td className="py-4">
                            {item.is_used ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#1F1D20] text-[#7B7369] border border-[#4D4845]/40 rounded-full text-xs font-bold">
                                <ShieldAlert size={14} className="text-[#7B7369]" />
                                Đã sử dụng
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-950/40 text-green-400 border border-green-500/30 rounded-full text-xs font-bold">
                                <ShieldCheck size={14} className="text-green-400" />
                                Có thể dùng
                              </span>
                            )}
                          </td>
                          <td className="py-4 font-medium text-[#F5ECDC]">
                            {item.used_by_username ? (
                              <span className="font-bold text-[#F5ECDC]">@{item.used_by_username}</span>
                            ) : (
                              <span className="text-[#7B7369] font-normal">—</span>
                            )}
                          </td>
                          <td className="py-4 text-[#D7C9B2] text-xs">
                            {new Date(item.created_at).toLocaleString('vi-VN')}
                          </td>
                          <td className="py-4 pr-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                onClick={() => copyToClipboard(item.code, item.id)}
                                className="p-2 rounded-xl text-[#D7C9B2] hover:text-[#F5ECDC] hover:bg-[#1F1D20] transition-colors flex items-center gap-1 text-xs font-bold border border-[#4D4845]/30"
                                title="Sao chép mã"
                              >
                                {copiedId === item.id ? (
                                  <>
                                    <Check size={16} className="text-green-400" />
                                    <span className="text-green-400">Đã chép</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy size={16} />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>

                              {!item.is_used && (
                                <>
                                  <button 
                                    onClick={() => handleRegenerateCode(item.id)}
                                    className="p-2 rounded-xl text-orange-400 hover:bg-[#1F1D20] transition-colors border border-[#4D4845]/30"
                                    title="Tạo lại mã ngẫu nhiên mới"
                                  >
                                    <RefreshCw size={16} />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteCode(item.id)}
                                    className="p-2 rounded-xl text-red-400 hover:bg-[#1F1D20] transition-colors border border-[#4D4845]/30"
                                    title="Xóa mã"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
