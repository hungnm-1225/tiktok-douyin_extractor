import React, { useState, useRef } from 'react';
import { 
  Link2, 
  Sparkles, 
  UploadCloud, 
  X, 
  Clipboard, 
  Check, 
  Languages,
  Loader2
} from 'lucide-react';
import { extractAudioFromVideoInBrowser } from '../utils/exportUtils';

export function isValidMediaUrl(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  const trimmed = input.trim();
  const hasHttp = /^https?:\/\//i.test(trimmed) || /https?:\/\/[^\s]+/i.test(trimmed);
  const isSupported = /tiktok\.com|douyin\.com|iesdouyin\.com/i.test(trimmed);
  return Boolean(hasHttp && isSupported);
}

interface InputSectionProps {
  url: string;
  setUrl: (url: string) => void;
  onSubmitUrl: () => void;
  onUploadFile: (file: File) => void;
  isLoading: boolean;
  onOpenSampleModal?: () => void;
  onlyVietnamese: boolean;
  setOnlyVietnamese: (val: boolean) => void;
}

export const InputSection: React.FC<InputSectionProps> = ({
  url,
  setUrl,
  onSubmitUrl,
  onUploadFile,
  isLoading,
  onOpenSampleModal,
  onlyVietnamese,
  setOnlyVietnamese,
}) => {
  const [isUploadMode, setIsUploadMode] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [isOptimizingAudio, setIsOptimizingAudio] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDouyin = url.toLowerCase().includes('douyin.com') || url.toLowerCase().includes('iesdouyin.com');
  const isTikTok = url.toLowerCase().includes('tiktok.com');

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const urlMatch = text.match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
          setUrl(urlMatch[0]);
        } else {
          setUrl(text.trim());
        }
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 1800);
      }
    } catch {
      // Fallback
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processSelectedFile = async (rawFile: File) => {
    if (!rawFile) return;
    try {
      if (rawFile.type.startsWith('video/') && rawFile.size > 20 * 1024 * 1024) {
        setIsOptimizingAudio(true);
        const audioFile = await extractAudioFromVideoInBrowser(rawFile);
        setIsOptimizingAudio(false);
        onUploadFile(audioFile);
      } else {
        onUploadFile(rawFile);
      }
    } catch {
      setIsOptimizingAudio(false);
      onUploadFile(rawFile);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processSelectedFile(e.target.files[0]);
    }
  };

  return (
    <div id="input-section-container" className="space-y-6">
      {/* Main Input Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-pink-100/80 pastel-shadow transition-all">
        
        {/* Toggle Mode: Link URL vs File Upload */}
        <div className="flex items-center justify-between pb-4 border-b border-pink-50 mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-pink-400"></span>
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              {isUploadMode ? 'Tải lên File Video / Audio' : 'Dán Link Video TikTok hoặc Douyin'}
            </h2>
          </div>

          <div className="flex items-center p-1 bg-pink-50/80 rounded-2xl border border-pink-200/50">
            <button
              id="mode-link-btn"
              type="button"
              onClick={() => setIsUploadMode(false)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                !isUploadMode
                  ? 'bg-white text-purple-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Dán Link Video
            </button>
            <button
              id="mode-upload-btn"
              type="button"
              onClick={() => setIsUploadMode(true)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                isUploadMode
                  ? 'bg-white text-purple-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Tải file MP4/MP3
            </button>
          </div>
        </div>

        {/* Mode 1: URL Input Box */}
        {!isUploadMode ? (
          <div className="space-y-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-pink-400">
                <Link2 className="h-5 w-5" />
              </div>

              <input
                id="video-url-input"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isLoading && isValidMediaUrl(url) && onSubmitUrl()}
                placeholder="Dán link video TikTok (tiktok.com/...) hoặc Douyin (v.douyin.com/...)"
                className={`w-full pl-11 pr-28 py-3.5 sm:py-4 rounded-2xl bg-[#FFF9FB] border-2 text-slate-800 placeholder-slate-400 text-sm sm:text-base outline-none transition-all shadow-inner ${
                  url.trim().length > 0 && !isValidMediaUrl(url)
                    ? 'border-rose-400 focus:border-rose-500 bg-rose-50/30'
                    : 'border-pink-200/70 focus:border-pink-400 focus:bg-white'
                }`}
              />

              <div className="absolute inset-y-0 right-2 flex items-center gap-1.5">
                {url ? (
                  <button
                    id="clear-url-btn"
                    type="button"
                    onClick={() => setUrl('')}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-pink-100/50 transition-colors"
                    title="Xóa link"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    id="paste-url-btn"
                    type="button"
                    onClick={handlePaste}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-pink-100 hover:bg-pink-200 text-pink-700 text-xs font-semibold transition-all shadow-sm cursor-pointer"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Đã dán</span>
                      </>
                    ) : (
                      <>
                        <Clipboard className="h-3.5 w-3.5" />
                        <span>Dán nhanh</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Validation warning if user enters text/keywords instead of a valid link */}
            {url.trim().length > 0 && !isValidMediaUrl(url) && (
              <div className="px-1 text-xs text-rose-600 font-semibold flex items-center gap-1.5 animate-in fade-in">
                <span>⚠️ Vui lòng nhập đúng đường link video từ TikTok hoặc Douyin (bắt đầu bằng https://...). Hệ thống không tìm kiếm theo từ khóa.</span>
              </div>
            )}

            {/* Platform & Language Badge Indicator */}
            <div className="flex items-center justify-between text-xs text-slate-500 px-1 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-600">Nền tảng:</span>
                {isDouyin ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold border border-rose-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                    Douyin Video (抖音 Tiếng Trung ➔ Xuất Song Ngữ)
                  </span>
                ) : isTikTok ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-100 text-cyan-800 font-bold border border-cyan-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
                    TikTok Video (Tự động nhận diện Tiếng Việt / Ngoại ngữ)
                  </span>
                ) : (
                  <span className="text-slate-400 italic">Hỗ trợ link Chia sẻ, Short link hoặc Web link</span>
                )}
              </div>

              {onOpenSampleModal && (
                <button
                  type="button"
                  onClick={onOpenSampleModal}
                  className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-800 font-bold text-xs hover:underline cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5 text-pink-500" />
                  <span>Xem kịch bản mẫu có sẵn</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Mode 2: Direct File Upload */
          <div
            id="file-dropzone"
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              dragActive
                ? 'border-purple-400 bg-purple-50/60 scale-[1.01]'
                : 'border-pink-200 hover:border-pink-300 bg-[#FFF9FB]/80'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,audio/mp3,audio/mpeg,audio/m4a,audio/wav"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="max-w-md mx-auto space-y-2.5">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-pink-200 to-purple-200 text-purple-700 mx-auto flex items-center justify-center shadow-sm">
                {isOptimizingAudio ? (
                  <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                ) : (
                  <UploadCloud className="h-6 w-6" />
                )}
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-700">
                {isOptimizingAudio
                  ? 'Đang tự động tách âm thanh từ video lớn (giảm 95% dung lượng)...'
                  : 'Kéo thả hoặc nhấp để chọn file video/audio'}
              </h3>
              <p className="text-xs text-slate-500">
                Hỗ trợ MP4, MOV, MP3, M4A, WAV (video lớn sẽ tự động trích xuất âm thanh siêu nhẹ gửi AI từ A-Z).
              </p>
            </div>
          </div>
        )}

        {/* Checkbox Option: Only Vietnamese */}
        <div className="mt-4 pt-3 border-t border-pink-50 flex items-center justify-between flex-wrap gap-3">
          <label
            id="only-vietnamese-checkbox-label"
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer select-none transition-all border ${
              onlyVietnamese
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 shadow-xs'
                : 'bg-pink-50/50 text-slate-600 border-pink-100 hover:bg-pink-50'
            }`}
          >
            <input
              id="only-vietnamese-checkbox"
              type="checkbox"
              checked={onlyVietnamese}
              onChange={(e) => setOnlyVietnamese(e.target.checked)}
              className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-400 accent-emerald-600 cursor-pointer"
            />
            <span>🇻🇳 Chỉ lấy bản dịch Tiếng Việt (Bỏ qua tiếng gốc đối với video Douyin / Ngoại ngữ)</span>
          </label>
        </div>

        {/* Submit Button */}
        <div className="mt-4">
          <button
            id="start-extract-btn"
            type="button"
            disabled={isLoading || (!isUploadMode && !isValidMediaUrl(url))}
            onClick={onSubmitUrl}
            className={`w-full py-4 px-6 rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all duration-300 shadow-md ${
              isLoading || (!isUploadMode && !isValidMediaUrl(url))
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-pink-300 via-purple-300 to-indigo-300 hover:from-pink-400 hover:via-purple-400 hover:to-indigo-400 text-purple-950 hover:shadow-lg hover:shadow-pink-200/60 active:scale-[0.99] cursor-pointer'
            }`}
          >
            <Sparkles className={`h-5 w-5 ${isLoading ? 'animate-spin' : 'animate-bounce'}`} />
            <span>
              {isLoading
                ? 'Đang lắng nghe và bóc tách kịch bản...'
                : 'Bóc Tách Kịch Bản Ngay'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
