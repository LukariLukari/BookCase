'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Sparkles, Crown, Zap, ShieldCheck, PhoneCall, Copy, CheckCircle2 } from 'lucide-react';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SubscriptionModal({ isOpen, onClose }: SubscriptionModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'semi_annual' | 'annual'>('semi_annual');
  const [showPayment, setShowPayment] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const plans = [
    {
      id: 'monthly',
      name: 'Gói Tháng',
      price: '49.000đ',
      period: '/ tháng',
      badge: null,
      description: 'Phù hợp đọc sách linh hoạt',
      features: [
        'Kho sách có sẵn trên web',
        'Tải tối đa 12 sách / tháng (1 tuần 3 cuốn)',
        'Được Yêu cầu sách 4 cuốn / tháng',
        'Tải tốc độ cao',
        'File đọc trực tiếp trên điện thoại hoặc gửi qua máy đọc sách',
        'Không quảng cáo'
      ]
    },
    {
      id: 'semi_annual',
      name: 'Gói 6 Tháng',
      price: '199.000đ',
      period: '/ 6 tháng',
      badge: 'PHỔ BIẾN NHẤT',
      description: 'Tiết kiệm & không giới hạn tải theo tuần',
      features: [
        'Kho sách có sẵn trên web',
        'Tải tối đa 20 sách / tháng (không giới hạn theo tuần)',
        'Được yêu cầu 10 cuốn / tháng',
        'Tải tốc độ cao hơn',
        'File đọc trực tiếp trên điện thoại hoặc gửi qua máy đọc sách',
        'Không quảng cáo'
      ]
    },
    {
      id: 'annual',
      name: 'Gói 1 Năm',
      price: '349.000đ',
      period: '/ 1 năm',
      badge: 'ƯU ĐÃI NHẤT',
      description: 'Tải không giới hạn trọn vẹn cả năm',
      features: [
        'Kho sách có sẵn trên web',
        'Tải KHÔNG GIỚI HẠN',
        'Được yêu cầu 15 cuốn / tháng',
        'Tải tốc độ cao hơn',
        'File đọc trực tiếp trên điện thoại hoặc gửi qua máy đọc sách',
        'Không quảng cáo'
      ]
    }
  ];

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/85 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.96 }}
          className="relative bg-[#1F1D20] rounded-3xl max-w-4xl w-full border border-[#4D4845]/60 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-[#F5ECDC]"
        >
          {/* Header */}
          <div className="p-6 md:p-8 border-b border-[#4D4845]/50 flex justify-between items-center bg-[#2A272A]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-[#F5ECDC] text-[#000000] text-xs font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Crown size={13} style={{ color: '#000000' }} /> BookCase VIP Member
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-[#F5ECDC] tracking-tight">
                Bảng Giá Đăng Ký Thành Viên
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2.5 bg-[#1F1D20] hover:bg-[#F5ECDC] hover:text-black text-[#F5ECDC] rounded-full transition-colors cursor-pointer border border-[#4D4845]/50"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
            {!showPayment ? (
              <>
                {/* Intro Subtitle */}
                <div className="text-center max-w-xl mx-auto space-y-2">
                  <p className="text-[#D7C9B2] text-sm md:text-base font-medium">
                    Mở khóa quyền tải sách không giới hạn từ kho Z-Library & Cloudily Bot với tốc độ cao.
                  </p>
                </div>

                {/* Plan Tiers Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {plans.map((plan) => {
                    const isSelected = selectedPlan === plan.id;
                    const isPopular = plan.id === 'semi_annual';

                    return (
                      <div
                        key={plan.id}
                        onClick={() => setSelectedPlan(plan.id as any)}
                        className={`relative bg-[#2A272A] rounded-2xl p-6 border transition-all duration-200 flex flex-col justify-between cursor-pointer ${
                          isSelected
                            ? 'border-[#F5ECDC] shadow-xl ring-2 ring-[#F5ECDC]/30 scale-[1.02]'
                            : 'border-[#4D4845]/50 hover:border-[#F5ECDC]/50'
                        }`}
                      >
                        {plan.badge && (
                          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                            <span className="bg-[#F5ECDC] text-[#000000] font-black text-[10px] uppercase px-3 py-1 rounded-full shadow-md whitespace-nowrap">
                              {plan.badge}
                            </span>
                          </div>
                        )}

                        <div>
                          <div className="text-center pb-4 border-b border-[#4D4845]/40 mb-4">
                            <h3 className="font-bold text-lg text-[#F5ECDC] mb-1">{plan.name}</h3>
                            <p className="text-[#8A817C] text-xs mb-3">{plan.description}</p>
                            <div className="flex items-baseline justify-center gap-1">
                              <span className="text-3xl font-black text-[#F5ECDC] tracking-tight">{plan.price}</span>
                              <span className="text-[#8A817C] text-xs font-semibold">{plan.period}</span>
                            </div>
                          </div>

                          <ul className="space-y-2.5 text-xs text-[#D7C9B2] mb-6">
                            {plan.features.map((feat, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <Check size={15} className="text-[#F5ECDC] shrink-0 mt-0.5" />
                                <span className={feat.includes('KHÔNG GIỚI HẠN') ? 'font-black text-[#F5ECDC]' : ''}>
                                  {feat}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPlan(plan.id as any);
                            setShowPayment(true);
                          }}
                          className="w-full py-3 px-4 rounded-xl font-black text-sm transition-all shadow-md cursor-pointer border border-[#4D4845]/50 flex items-center justify-center gap-2"
                          style={{
                            backgroundColor: isSelected ? '#F5ECDC' : '#1F1D20',
                            color: isSelected ? '#000000' : '#F5ECDC'
                          }}
                        >
                          <Sparkles size={16} style={{ color: isSelected ? '#000000' : '#F5ECDC' }} />
                          <span style={{ color: isSelected ? '#000000' : '#F5ECDC' }}>
                            Đăng Ký {plan.name}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Trust Footer */}
                <div className="flex flex-wrap items-center justify-center gap-6 pt-4 border-t border-[#4D4845]/40 text-xs text-[#8A817C]">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck size={16} className="text-[#F5ECDC]" /> Kích hoạt tự động sau 1-3 phút
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Zap size={16} className="text-[#F5ECDC]" /> Tải không giới hạn dung lượng
                  </span>
                  <span className="flex items-center gap-1.5">
                    <PhoneCall size={16} className="text-[#F5ECDC]" /> Hỗ trợ 24/7 qua Zalo & Telegram
                  </span>
                </div>
              </>
            ) : (
              /* Payment Details View */
              <div className="max-w-xl mx-auto bg-[#2A272A] border border-[#4D4845]/60 rounded-2xl p-6 md:p-8 space-y-6">
                <div className="text-center space-y-2">
                  <span className="inline-block bg-[#F5ECDC] text-[#000000] font-black text-xs px-3 py-1 rounded-full uppercase">
                    Hướng dẫn thanh toán
                  </span>
                  <h3 className="text-xl font-bold text-[#F5ECDC]">
                    {plans.find((p) => p.id === selectedPlan)?.name} - {plans.find((p) => p.id === selectedPlan)?.price}
                  </h3>
                  <p className="text-xs text-[#D7C9B2]">
                    Chuyển khoản theo thông tin bên dưới để hoàn tất kích hoạt tài khoản VIP.
                  </p>
                </div>

                {/* Bank / QR Transfer Details */}
                <div className="bg-[#1F1D20] p-5 rounded-xl border border-[#4D4845]/50 space-y-3 text-sm">
                  <div className="flex justify-between items-center pb-2 border-b border-[#4D4845]/40">
                    <span className="text-[#8A817C]">Ngân hàng:</span>
                    <span className="font-extrabold text-[#F5ECDC]">MB BANK (Ngân hàng Quân Đội)</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-[#4D4845]/40">
                    <span className="text-[#8A817C]">Số tài khoản:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-[#F5ECDC] text-base">BOOKCASEVIP</span>
                      <button
                        onClick={() => handleCopy('BOOKCASEVIP')}
                        className="p-1 hover:bg-[#3A373A] rounded transition-colors text-[#F5ECDC] cursor-pointer"
                        title="Copy"
                      >
                        {copied ? <CheckCircle2 size={16} className="text-green-400" /> : <Copy size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-[#4D4845]/40">
                    <span className="text-[#8A817C]">Chủ tài khoản:</span>
                    <span className="font-bold text-[#F5ECDC]">BOOKCASE SYSTEM</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#8A817C]">Nội dung chuyển khoản:</span>
                    <span className="font-black text-[#F5ECDC]">VIP {selectedPlan.toUpperCase()}</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowPayment(false)}
                    className="flex-1 py-3 px-4 rounded-xl text-sm font-bold bg-[#1F1D20] text-[#F5ECDC] border border-[#4D4845] hover:bg-[#3A373A] cursor-pointer transition-colors"
                  >
                    Quay lại
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-3 px-4 rounded-xl text-sm font-black bg-[#F5ECDC] text-[#000000] hover:bg-white cursor-pointer shadow-md transition-colors"
                  >
                    Tôi đã chuyển khoản
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
