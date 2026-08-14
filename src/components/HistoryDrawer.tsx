import React from 'react';
import { History, X, Trash2, ArrowRight, Clock, Video, Film, Sparkles } from 'lucide-react';
import { ExtractionResult } from '../types';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: ExtractionResult[];
  onSelectHistoryItem: (item: ExtractionResult) => void;
  onClearHistory: () => void;
  onDeleteItem: (id: string) => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  history,
  onSelectHistoryItem,
  onClearHistory,
  onDeleteItem,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="history-drawer-backdrop"
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      <div
        id="history-drawer-panel"
        className="w-full max-w-md bg-white h-full shadow-2xl p-6 flex flex-col justify-between border-l border-pink-100 overflow-hidden animate-in slide-in-from-right duration-250"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-pink-100">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
                <History className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-800">Lịch Sử Bóc Tách Kịch Bản</h3>
                <p className="text-xs text-slate-400">Tối đa 5 video gần nhất trên máy của bạn</p>
              </div>
            </div>

            <button
              id="close-history-drawer-btn"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* List of items */}
          <div className="mt-4 space-y-3 overflow-y-auto max-h-[calc(100vh-200px)] pr-1">
            {history.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <Film className="h-10 w-10 text-pink-200 mx-auto" />
                <p className="text-sm font-medium">Chưa có lịch sử bóc tách nào.</p>
                <p className="text-xs text-slate-400">Các video bạn đã bóc tách sẽ tự động lưu tại đây.</p>
              </div>
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  id={`history-item-${item.id}`}
                  className="p-4 rounded-2xl bg-[#FFF9FB] hover:bg-pink-50/70 border border-pink-100 transition-all group relative cursor-pointer"
                  onClick={() => {
                    onSelectHistoryItem(item);
                    onClose();
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1.5 flex-1 pr-6">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full border ${
                          item.videoMetadata.platform === 'douyin'
                            ? 'bg-rose-100 text-rose-700 border-rose-200'
                            : item.videoMetadata.platform === 'tiktok'
                            ? 'bg-cyan-100 text-cyan-800 border-cyan-200'
                            : 'bg-purple-100 text-purple-700 border-purple-200'
                        }`}>
                          {item.videoMetadata.platform.toUpperCase()}
                        </span>

                        <span className="text-[10px] text-slate-400">
                          {new Date(item.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} • {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                        </span>
                      </div>

                      <h4 className="text-xs sm:text-sm font-bold text-slate-800 line-clamp-2 leading-snug group-hover:text-purple-700 transition-colors">
                        {item.videoMetadata.title}
                      </h4>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500">
                        <span>{item.segments?.length || 0} đoạn thoại</span>
                        <span>•</span>
                        <span>{item.sourceLanguage}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteItem(item.id);
                      }}
                      className="text-slate-300 hover:text-rose-500 p-1 rounded-lg transition-colors absolute top-3 right-3"
                      title="Xóa mục này"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-pink-100/60 flex items-center justify-between text-[11px] font-bold text-purple-700">
                    <span>Xem lại kết quả</span>
                    <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer actions */}
        {history.length > 0 && (
          <div className="pt-4 border-t border-pink-100">
            <button
              id="clear-all-history-btn"
              type="button"
              onClick={onClearHistory}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              <span>Xóa toàn bộ 5 lịch sử</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
