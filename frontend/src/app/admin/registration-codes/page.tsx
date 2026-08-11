'use client';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import { KeyRound, Plus, Copy, Check, Trash2, ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';

interface RegistrationCode {
  id: string;
  code: string;
  is_used: boolean;
  used_by_username: string | null;
  created_at: string;
  created_by: string | null;
}

export default function AdminRegistrationCodesPage() {
  const { user, token, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();

  const [codes, setCodes] = useState<RegistrationCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const fetchCodes = async () => {
    try {
      setLoading(true);
      const authToken = localStorage.getItem('access_token');
      const res = await axios.get(`${baseUrl}/api/admin/registration-codes`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setCodes(res.data);
    } catch (err: any) {
      console.error(err);
      setError('Không thể tải danh sách mã đăng ký.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCode = async () => {
    try {
      setIsCreating(true);
      setError(null);
      const authToken = localStorage.getItem('access_token');
      await axios.post(`${baseUrl}/api/admin/registration-codes`, {}, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      await fetchCodes();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Lỗi khi tạo mã đăng ký.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteCode = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa mã đăng ký này?')) return;
    try {
      setError(null);
      const authToken = localStorage.getItem('access_token');
      await axios.delete(`${baseUrl}/api/admin/registration-codes/${id}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setCodes(prev => prev.filter(c => c.id !== id));
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Lỗi khi xóa mã.');
    }
  };

  const copyToClipboard = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isAuthLoading || !user || user.role !== 'admin') {
    return <div className="min-h-screen bg-[#f8f7f4] flex items-center justify-center font-bold text-gray-500">Đang tải...</div>;
  }

  return (
    <div className="flex bg-[#f8f7f4] min-h-screen font-sans selection:bg-orange-200 overflow-x-hidden">
      <Sidebar />
      <div className="flex-1 ml-0 md:ml-64 pt-16 md:pt-0 flex flex-col min-h-screen w-full max-w-full">
        
        {/* Header */}
        <header className="sticky top-16 md:top-0 z-30 bg-[#f8f7f4]/80 backdrop-blur-md px-4 py-4 md:px-10 md:py-6 flex justify-between items-center border-b border-gray-200">
          <div className="flex items-center gap-4 text-xl font-bold">
            <KeyRound size={24} className="text-orange-500" />
            <span className="text-black">Quản Lý Mã Đăng Ký</span>
          </div>
          <button 
            onClick={handleCreateCode}
            disabled={isCreating}
            className="!bg-orange-500 hover:!bg-orange-600 !text-white font-bold rounded-full py-3 px-6 shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-70"
          >
            {isCreating ? <Loader2 size={18} className="animate-spin !text-white" /> : <Plus size={18} className="!text-white" />}
            <span className="!text-white">Tạo Mã Mới</span>
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 px-4 md:px-10 pt-8 pb-12">
          {error && (
            <div className="bg-red-50 text-red-500 p-4 rounded-2xl text-sm font-bold mb-6 text-center border border-red-100">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center mt-20">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-orange-500 border-t-transparent"></div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-black">Danh sách mã đăng ký</h2>
                  <p className="text-sm text-gray-500">Mã ngẫu nhiên được Admin cấp cho thành viên để đăng ký tài khoản.</p>
                </div>
                <span className="text-xs font-bold px-3 py-1 bg-gray-100 text-gray-600 rounded-full">
                  Tổng: {codes.length} mã
                </span>
              </div>

              {codes.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl">
                  <KeyRound size={48} className="text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium mb-4">Chưa có mã đăng ký nào.</p>
                  <button 
                    onClick={handleCreateCode}
                    disabled={isCreating}
                    className="!bg-black hover:!bg-gray-800 !text-white font-bold py-2.5 px-6 rounded-xl transition-all inline-flex items-center gap-2 shadow-sm"
                  >
                    <Plus size={16} className="!text-white" />
                    <span className="!text-white">Tạo mã ngay</span>
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                        <th className="pb-4 pl-4">Mã Code</th>
                        <th className="pb-4">Trạng thái</th>
                        <th className="pb-4">Người sử dụng</th>
                        <th className="pb-4">Ngày tạo</th>
                        <th className="pb-4 pr-4 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {codes.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-4 pl-4 font-mono font-bold text-base text-black">
                            {item.code}
                          </td>
                          <td className="py-4">
                            {item.is_used ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold">
                                <ShieldAlert size={14} className="text-gray-500" />
                                Đã sử dụng
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                                <ShieldCheck size={14} className="text-green-600" />
                                Có thể dùng
                              </span>
                            )}
                          </td>
                          <td className="py-4 font-medium text-gray-700">
                            {item.used_by_username ? (
                              <span className="font-bold text-black">@{item.used_by_username}</span>
                            ) : (
                              <span className="text-gray-400 font-normal">—</span>
                            )}
                          </td>
                          <td className="py-4 text-gray-500 text-xs">
                            {new Date(item.created_at).toLocaleString('vi-VN')}
                          </td>
                          <td className="py-4 pr-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                onClick={() => copyToClipboard(item.code, item.id)}
                                className="p-2 rounded-xl text-gray-600 hover:text-black hover:bg-gray-100 transition-colors flex items-center gap-1 text-xs font-bold"
                                title="Sao chép mã"
                              >
                                {copiedId === item.id ? (
                                  <>
                                    <Check size={16} className="text-green-600" />
                                    <span className="text-green-600">Đã chép</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy size={16} />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>

                              {!item.is_used && (
                                <button 
                                  onClick={() => handleDeleteCode(item.id)}
                                  className="p-2 rounded-xl text-red-500 hover:bg-red-50 transition-colors"
                                  title="Xóa mã"
                                >
                                  <Trash2 size={16} />
                                </button>
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
