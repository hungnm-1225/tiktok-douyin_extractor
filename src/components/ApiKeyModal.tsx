import React, { useState } from 'react';
import { X, Key, Check, ExternalLink, ShieldCheck, Trash2 } from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSaveApiKey: (key: string) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  onSaveApiKey,
}) => {
  const [inputVal, setInputVal] = useState<string>(apiKey || '');
  const [isSaved, setIsSaved] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveApiKey(inputVal.trim());
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 800);
  };

  const handleRemove = () => {
    setInputVal('');
    onSaveApiKey('');
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 800);
  };

  return (
    <div
      id="apikey-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      <div
        id="apikey-modal-card"
        className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 border border-pink-100 shadow-2xl shadow-pink-200/50 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-pink-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-pink-200 to-purple-200 text-purple-800 shadow-xs">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-800">
                Cài Đặt Gemini API Key
              </h3>
              <p className="text-xs text-slate-500">
                (Tùy chọn: Tăng hạn mức bóc tách không giới hạn)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-pink-50 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Description & Security Info */}
        <div className="space-y-2 text-xs text-slate-600 leading-relaxed bg-[#FFF9FB] p-3.5 rounded-2xl border border-pink-100">
          <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>Bảo mật an toàn & lưu cục bộ trên trình duyệt</span>
          </div>
          <p>
            Mặc định hệ thống đã có sẵn Gemini AI. Nếu bạn muốn sử dụng tài khoản Google AI Studio riêng để không bao giờ bị giới hạn lượt gọi (Rate Limit), hãy dán API Key của bạn vào đây.
          </p>
        </div>

        {/* Input */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">
            Khóa Google Gemini API Key:
          </label>
          <input
            type="password"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-pink-200 focus:bg-white focus:border-pink-400 outline-none text-xs sm:text-sm font-mono text-slate-800 transition-all"
          />
        </div>

        {/* Link to get key */}
        <div className="flex items-center justify-between text-xs pt-1">
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-purple-700 hover:text-purple-900 font-semibold hover:underline"
          >
            <span>Lấy API Key miễn phí tại Google AI Studio</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          {apiKey && (
            <button
              type="button"
              onClick={handleRemove}
              className="px-3.5 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Xóa Key</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-pink-300 via-purple-300 to-indigo-300 hover:from-pink-400 hover:via-purple-400 hover:to-indigo-400 text-purple-950 text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {isSaved ? (
              <>
                <Check className="h-4 w-4 text-emerald-700" />
                <span className="text-emerald-900">Đã lưu thành công!</span>
              </>
            ) : (
              <span>Lưu Cài Đặt</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
