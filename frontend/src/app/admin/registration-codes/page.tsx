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
    return <div className="min-h-screen bg-[#D8C9BB] flex items-center justify-center font-bold text-[#7A6F68]">Đang tải...</div>;
  }

  return (
    <div className="min-h-screen bg-[#D8C9BB] text-[#2A2320] p-3 sm:p-5 md:p-6 lg:p-7 flex flex-col md:flex-row gap-5 font-sans selection:bg-[#E5DACD]">
      <Sidebar />
      <main className="flex-1 min-w-0 bg-[#FBF8F4] rounded-[36px] p-6 md:p-8 shadow-[0_16px_40px_rgba(120,100,85,0.12)] border border-[#EFE8DE] flex flex-col">
        
        {/* Header */}
        <header className="pb-5 mb-6 flex justify-between items-center border-b border-[#EFE8DE]">
          <div>
            <div className="flex items-center gap-2.5 text-xl font-black text-[#2A2320]">
              <KeyRound size={22} className="text-[#5F65B9]" />
              <span>Quản Lý Mã Đăng Ký</span>
            </div>
            <p className="text-xs text-[#7A6F68] font-medium mt-0.5">Tạo và cấp phát mã kích hoạt tài khoản thành viên</p>
          </div>
          <button 
            onClick={handleCreateCode}
            disabled={isCreating}
            className="btn-gradient text-white rounded-full py-2.5 px-5 shadow-md flex items-center gap-1.5 font-bold text-xs hover:opacity-95 transition-all cursor-pointer border-none"
          >
            {isCreating ? <Loader2 size={16} className="animate-spin text-white" /> : <Plus size={16} className="stroke-[3]" />}
            <span>Tạo Mã Mới</span>
          </button>
        </header>

        {/* Content */}
        <section className="flex-1">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-2xl text-xs font-bold mb-6 text-center">
              {error}
            </div>
          )}

          {successNotice && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-2xl text-xs font-bold mb-6 text-center flex items-center justify-center gap-2">
              <Check size={16} className="text-emerald-700" />
              <span>{successNotice}</span>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center mt-20">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#5F65B9] border-t-transparent"></div>
            </div>
          ) : (
            <div className="bg-[#FAF6F0] rounded-3xl p-6 md:p-8 shadow-sm border border-[#ECE2D5]">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-black text-[#2A2320]">Danh sách mã đăng ký</h2>
                  <p className="text-xs text-[#7A6F68] mt-0.5 font-medium">Mã ngẫu nhiên được Admin cấp cho thành viên để đăng ký tài khoản.</p>
                </div>
                <span className="text-xs font-bold px-3 py-1 bg-white text-[#7A6F68] border border-[#ECE2D5] rounded-full shadow-sm">
                  Tổng: {codes.length} mã
                </span>
              </div>

              {codes.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-[#D8C9BB] rounded-2xl">
                  <KeyRound size={48} className="text-[#A0958C] mx-auto mb-3" />
                  <p className="text-xs text-[#7A6F68] font-bold mb-4">Chưa có mã đăng ký nào.</p>
                  <button 
                    onClick={handleCreateCode}
                    disabled={isCreating}
                    className="btn-gradient text-white rounded-full py-2.5 px-5 font-bold text-xs shadow-md border-none cursor-pointer"
                  >
                    <Plus size={16} />
                    <span>Tạo mã ngay</span>
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#EFE8DE] text-xs font-bold text-[#A0958C] uppercase tracking-wider">
                        <th className="pb-3.5 pl-4">Mã Code</th>
                        <th className="pb-3.5">Trạng thái</th>
                        <th className="pb-3.5">Người sử dụng</th>
                        <th className="pb-3.5">Ngày tạo</th>
                        <th className="pb-3.5 pr-4 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFE8DE] text-xs">
                      {codes.map((item) => (
                        <tr key={item.id} className="hover:bg-white/60 transition-colors">
                          <td className="py-3.5 pl-4 font-mono font-bold text-sm text-[#5F65B9]">
                            {item.code}
                          </td>
                          <td className="py-3.5">
                            {item.is_used ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-gray-100 text-gray-500 border border-gray-200 rounded-full text-[11px] font-bold">
                                <ShieldAlert size={12} className="text-gray-400" />
                                Đã sử dụng
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[11px] font-bold">
                                <ShieldCheck size={12} className="text-emerald-600" />
                                Có thể dùng
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 font-medium text-[#2A2320]">
                            {item.used_by_username ? (
                              <span className="font-bold text-[#2A2320]">@{item.used_by_username}</span>
                            ) : (
                              <span className="text-[#A0958C] font-normal">—</span>
                            )}
                          </td>
                          <td className="py-3.5 text-[#7A6F68]">
                            {new Date(item.created_at).toLocaleString('vi-VN')}
                          </td>
                          <td className="py-3.5 pr-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button 
                                onClick={() => copyToClipboard(item.code, item.id)}
                                className="p-1.5 rounded-full text-[#7A6F68] hover:text-[#2A2320] hover:bg-white transition-colors flex items-center gap-1 text-xs font-bold border border-[#ECE2D5] cursor-pointer"
                                title="Sao chép mã"
                              >
                                {copiedId === item.id ? (
                                  <>
                                    <Check size={14} className="text-emerald-600" />
                                    <span className="text-emerald-600">Đã chép</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy size={14} />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>

                              {!item.is_used && (
                                <>
                                  <button 
                                    onClick={() => handleRegenerateCode(item.id)}
                                    className="p-1.5 rounded-full text-[#5F65B9] hover:bg-white transition-colors border border-[#ECE2D5] cursor-pointer"
                                    title="Tạo lại mã ngẫu nhiên mới"
                                  >
                                    <RefreshCw size={14} />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteCode(item.id)}
                                    className="p-1.5 rounded-full text-red-500 hover:bg-red-50 transition-colors border border-red-200 cursor-pointer"
                                    title="Xóa mã"
                                  >
                                    <Trash2 size={14} />
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
        </section>
      </main>
    </div>
  );
}
