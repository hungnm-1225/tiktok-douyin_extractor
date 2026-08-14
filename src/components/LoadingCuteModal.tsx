import React, { useEffect, useState } from 'react';
import { Sparkles, Heart, PencilLine, Search, Clapperboard, AudioLines, Trash2 } from 'lucide-react';

interface LoadingCuteModalProps {
  isOpen: boolean;
  option?: string;
}

const LOADING_MESSAGES = [
  { text: 'Đang kết nối tới máy chủ và kiểm tra đường link... ', icon: Search },
  { text: 'Đang trích xuất video ... ', icon: Clapperboard },
  { text: 'Gemini AI đang lắng nghe và bóc tách từng câu thoại... ', icon: AudioLines },
  { text: 'Đang đánh dấu timestamp và đối chiếu dịch thuật tiếng Việt... ', icon: PencilLine },
  { text: 'Đang hoàn tất kịch bản và dọn dẹp bộ nhớ tạm... ', icon: Trash2 },
];

export const LoadingCuteModal: React.FC<LoadingCuteModalProps> = ({ isOpen }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  useEffect(() => {
    if (!isOpen) {
      setCurrentStepIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setCurrentStepIndex((prev) => (prev < LOADING_MESSAGES.length - 1 ? prev + 1 : prev));
    }, 2800);

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const currentMsg = LOADING_MESSAGES[currentStepIndex];
  const IconComponent = currentMsg.icon;

  return (
    <div
      id="loading-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs transition-opacity"
    >
      <div
        id="loading-modal-card"
        className="w-full max-w-md bg-white rounded-3xl p-8 border border-pink-100 shadow-2xl shadow-pink-200/50 text-center relative overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Background pastel blobs */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-pink-100/70 rounded-full blur-2xl pointer-events-none"></div>
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-purple-100/70 rounded-full blur-2xl pointer-events-none"></div>

        {/* Animated flower center */}
        <div className="relative mx-auto w-24 h-24 mb-6 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-pink-200 via-purple-200 to-indigo-100 animate-ping opacity-40"></div>
          <div className="absolute inset-1 rounded-full bg-gradient-to-tr from-pink-100 to-purple-100 animate-pulse"></div>

          <div className="absolute inset-0 flex items-center justify-center animate-flower-spin text-pink-300">
            <Flower2 className="h-16 w-16" />
          </div>

          <div className="relative z-10 animate-heartbeat text-pink-500 bg-white p-3 rounded-full shadow-md shadow-pink-200">
            <Heart className="h-7 w-7 fill-pink-400 text-pink-500" />
          </div>
        </div>

        {/* Title */}
        <h3 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight mb-2">
          Đang bóc tách kịch bản...
        </h3>

        {/* Status text */}
        <div className="min-h-[56px] flex items-center justify-center px-4 py-2.5 rounded-2xl bg-[#FFF9FB] border border-pink-100 my-4 shadow-inner">
          <p className="text-xs sm:text-sm font-semibold text-purple-900 leading-relaxed flex items-center justify-center gap-2">
            <IconComponent className="h-4 w-4 text-pink-500 shrink-0 animate-bounce" />
            <span>{currentMsg.text}</span>
          </p>
        </div>

        {/* Progress indicators */}
        <div className="flex items-center justify-center gap-1.5 mt-5">
          {LOADING_MESSAGES.map((_, idx) => (
            <span
              key={idx}
              className={`h-2 rounded-full transition-all duration-300 ${
                idx === currentStepIndex
                  ? 'w-7 bg-pink-400'
                  : idx < currentStepIndex
                  ? 'w-2 bg-purple-300'
                  : 'w-2 bg-slate-200'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
