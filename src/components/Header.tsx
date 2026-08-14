import React from 'react';
import { Sparkles, History } from 'lucide-react';

interface HeaderProps {
  historyCount: number;
  onOpenHistory: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  historyCount,
  onOpenHistory,
}) => {
  return (
    <header id="app-header" className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-pink-100 shadow-xs">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-pink-300 via-purple-300 to-indigo-200 flex items-center justify-center shadow-md shadow-pink-200/60 transform hover:rotate-6 transition-transform">
              <Sparkles className="h-5 w-5 text-white drop-shadow-xs" />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base sm:text-lg text-slate-800 tracking-tight flex items-center gap-1.5">
                <span>Script AI</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 font-bold border border-pink-200">
                  TikTok & Douyin
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-500 font-medium hidden sm:block">
              Bóc tách kịch bản Tiếng Việt & Song ngữ Tiếng Trung
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-2.5">
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
