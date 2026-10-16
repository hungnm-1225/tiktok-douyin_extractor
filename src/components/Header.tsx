import React from 'react';
import { Sparkles, History, Film } from 'lucide-react';

interface HeaderProps {
  historyCount: number;
  onOpenHistory: () => void;
  onOpenSampleModal: () => void;
  onHomeClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  historyCount,
  onOpenHistory,
  onOpenSampleModal,
  onHomeClick,
}) => {
  return (
    <header id="app-header" className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-pink-100 shadow-xs">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
        {/* Brand Logo - Click to return home */}
        <div
          id="brand-home-btn"
          role="button"
          tabIndex={0}
          onClick={onHomeClick}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onHomeClick && onHomeClick()}
          className="flex items-center gap-3 cursor-pointer group select-none transition-transform hover:opacity-95"
          title="Quay về trang chủ bóc tách"
        >
          <div className="relative">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-pink-300 via-purple-300 to-indigo-200 flex items-center justify-center shadow-md shadow-pink-200/60 group-hover:rotate-6 group-hover:scale-105 transition-all">
              <Sparkles className="h-5 w-5 text-white drop-shadow-xs" />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base sm:text-lg text-slate-800 tracking-tight flex items-center gap-1.5 group-hover:text-purple-900 transition-colors">
                <span>Script AI</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 font-bold border border-pink-200">
                  TikTok & Douyin
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-500 font-medium hidden sm:block">
              Lấy script video - Hoàng Hồng Hạnh
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Sample Videos Trigger */}
          <button
            id="open-sample-btn"
            type="button"
            onClick={onOpenSampleModal}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-pink-50 hover:bg-pink-100 text-pink-700 text-xs font-semibold border border-pink-200/80 transition-all hover:scale-105 active:scale-95 shadow-xs cursor-pointer"
            title="Xem kịch bản mẫu có sẵn"
          >
            <Film className="h-3.5 w-3.5 text-pink-500" />
            <span className="hidden sm:inline">Video Mẫu</span>
          </button>

          {/* History Drawer Trigger */}
          <button
            id="open-history-btn"
            type="button"
            onClick={onOpenHistory}
            className="relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold border border-purple-200/80 transition-all hover:scale-105 active:scale-95 shadow-xs cursor-pointer"
          >
            <History className="h-3.5 w-3.5 text-purple-500" />
            <span>Lịch sử</span>
            {historyCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-purple-600 text-white text-[10px] font-bold">
                {historyCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
