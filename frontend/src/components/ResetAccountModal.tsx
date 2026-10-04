'use client';

import React, { useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Check, Loader2, RefreshCw, ShieldAlert, ShieldCheck, X } from 'lucide-react';

interface ResetAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUsername: string;
  targetUserId?: string;
  token?: string | null;
  onSuccess?: (message: string) => void;
}

export default function ResetAccountModal({
  isOpen,
  onClose,
  targetUsername,
  targetUserId,
  token,
  onSuccess,
}: ResetAccountModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const [createSafetyBackup, setCreateSafetyBackup] = useState(true);
  const [deleteBackups, setDeleteBackups] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const expectedConfirm = 'XÓA TOÀN BỘ';
  const isMatch =
    confirmText.trim().toUpperCase() === expectedConfirm ||
    confirmText.trim().toLowerCase() === targetUsername.trim().toLowerCase();

  const handleReset = async () => {
    if (!isMatch) return;
    setBusy(true);
    setError('');

    const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('token') || localStorage.getItem('access_token') : null);
    const headers = { Authorization: `Bearer ${authToken || ''}` };

    try {
      // Gọi API reset - thử cả route proxy /api/backend và route trực tiếp /api/business/reset
      const payload = {
        target_user_id: targetUserId,
        create_safety_backup: createSafetyBackup,
        delete_backups: deleteBackups,
      };

      let responseMessage = '';
      try {
        const res = await axios.post('/api/backend/api/business/reset', payload, { headers });
        responseMessage = res.data?.message;
      } catch (err: unknown) {
        // Fallback sang /api/business/reset trực tiếp
        const res = await axios.post('/api/business/reset', payload, { headers });
        responseMessage = res.data?.message;
      }

      // Xóa sạch bộ nhớ đệm cache trên trình duyệt của tài khoản này
      if (typeof window !== 'undefined' && targetUserId) {
        const prefix = `bookcase:business:${targetUserId}`;
        try {
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && (key.startsWith(prefix) || key === 'business_ledger_id')) {
              localStorage.removeItem(key);
            }
          }
          for (let i = sessionStorage.length - 1; i >= 0; i--) {
            const key = sessionStorage.key(i);
            if (key && (key.startsWith(prefix) || key === 'business_ledger_id')) {
              sessionStorage.removeItem(key);
            }
          }
        } catch {
          // ignore cache clearing failure
        }
      }

      const msg = responseMessage || `Đã xóa sạch toàn bộ hệ thống của tài khoản @${targetUsername}.`;
      if (onSuccess) {
        onSuccess(msg);
      }
      onClose();
    } catch (err: unknown) {
      console.error('Reset system error:', err);
      let detail = 'Không thể xóa hệ thống. Vui lòng kiểm tra lại quyền Admin.';
      if (axios.isAxiosError(err) && err.response?.data?.detail) {
        detail = String(err.response.data.detail);
      }
      setError(detail);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[250] flex items-end justify-center bg-black/50 backdrop-blur-sm p-0 md:items-center md:p-4"
        onMouseDown={() => !busy && onClose()}
      >
        <motion.div
          initial={{ y: '100%', opacity: 0.8 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          className="card-push flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] md:rounded-[24px]"
          onMouseDown={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-[#203354]/15 px-5 py-4 bg-white/70">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600">
                <ShieldAlert size={22} />
              </div>
              <div>
                <h2 className="text-base font-black text-red-950 md:text-lg">Đổi mô hình kinh doanh</h2>
                <p className="text-xs font-semibold text-red-800">Clear toàn bộ hệ thống tài khoản</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="btn-push flex h-9 w-9 items-center justify-center rounded-xl"
            >
              <X size={17} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Account Target Banner */}
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
                <div className="text-xs leading-relaxed text-red-900">
                  <p className="font-black text-sm">
                    Tài khoản được xóa: <span className="font-mono text-red-700 bg-red-100/80 px-2 py-0.5 rounded-lg font-black">@{targetUsername}</span>
                  </p>
                  <p className="mt-1 font-medium">
                    Hành động này phục vụ cho chủ doanh nghiệp khi muốn chuyển đổi mô hình kinh doanh (ví dụ: chuyển từ bán sách sang bán đồ uống, quần áo hoặc mô hình mới).
                  </p>
                </div>
              </div>
            </div>

            {/* Strict Isolation Notice */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-700 mt-0.5" />
                <div className="text-xs text-emerald-900 font-semibold">
                  <b className="block text-emerald-950">Cam kết an toàn tuyệt đối:</b>
                  Hệ thống chỉ xóa dữ liệu thuộc về tài khoản <span className="font-mono underline">@{targetUsername}</span>. Toàn bộ tài khoản và cửa hàng của người khác hoàn toàn không bị ảnh hưởng.
                </div>
              </div>
            </div>

            {/* What will be cleared */}
            <div className="rounded-xl border border-[#E3D7CB] bg-white p-4">
              <p className="text-xs font-black uppercase tracking-wider text-[#796D64]">Dữ liệu sẽ được làm sạch:</p>
              <ul className="mt-2 space-y-1.5 text-xs font-semibold text-[#524840]">
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Toàn bộ sản phẩm, danh mục và hình ảnh hàng hóa</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Toàn bộ kho hàng, lô hàng và các phiếu nhập kho</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Toàn bộ đơn hàng, trạng thái và lịch sử thanh toán</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Danh sách khách hàng và lịch sử mua sắm</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Toàn bộ sổ bán hàng, thu chi và báo cáo doanh thu</li>
              </ul>
              <p className="mt-3 text-[11px] font-bold text-emerald-800 bg-emerald-50 rounded-lg p-2">
                ✓ Hệ thống sẽ tự động tạo sẵn "Lô hàng 1" trống để chủ cửa hàng có thể thêm ngay các sản phẩm của mô hình mới.
              </p>
            </div>

            {/* Options */}
            <div className="space-y-2 rounded-xl border border-[#E3D7CB] bg-white p-3.5 text-xs font-bold text-[#443C36]">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createSafetyBackup}
                  onChange={e => setCreateSafetyBackup(e.target.checked)}
                  className="h-4 w-4 rounded text-[#203354] focus:ring-0"
                />
                <span>Tự động tạo bản sao lưu an toàn trước khi xóa (khuyến nghị, có thể phục hồi nếu cần)</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-[#8C3E37]">
                <input
                  type="checkbox"
                  checked={deleteBackups}
                  onChange={e => setDeleteBackups(e.target.checked)}
                  className="h-4 w-4 rounded text-red-600 focus:ring-0"
                />
                <span>Xóa luôn các bản sao lưu cũ trong quá khứ của tài khoản này</span>
              </label>
            </div>

            {/* Error banner */}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-100/90 p-3 text-xs font-bold text-red-800">
                {error}
              </div>
            )}

            {/* Safety Confirmation Input */}
            <div className="rounded-xl border border-red-200 bg-white p-4">
              <label className="block text-xs font-black text-red-950 mb-1.5">
                Nhập <span className="font-mono text-red-700 bg-red-50 px-1.5 py-0.5 rounded">XÓA TOÀN BỘ</span> hoặc <span className="font-mono text-red-700 bg-red-50 px-1.5 py-0.5 rounded">{targetUsername}</span> để xác nhận:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder="Nhập vào đây để mở khóa nút xóa"
                disabled={busy}
                className="w-full rounded-xl border border-[#D5C7B8] bg-[#FAF7F2] px-3.5 py-2.5 text-sm font-black text-red-950 placeholder:text-gray-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="border-t-2 border-[#203354]/15 bg-white/70 p-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="btn-push flex-1 h-12 rounded-full text-sm font-black text-[#203354] disabled:opacity-40"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={!isMatch || busy}
              className="btn-push-danger flex-1 h-12 rounded-full px-4 text-sm font-black disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  <span>Đang làm sạch hệ thống...</span>
                </>
              ) : (
                <>
                  <RefreshCw size={17} />
                  <span>Xác nhận xóa & Đổi mô hình</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
