import React, { useState } from 'react';
import { 
  Copy, 
  Check, 
  Download, 
  FileText, 
  Search, 
  Clock, 
  AlignLeft, 
  Languages, 
  ArrowLeft
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ExtractionResult } from '../types';
import { copyToClipboard, downloadTextFile, generateSrtContent, formatScriptAsText } from '../utils/exportUtils';

interface ResultViewerProps {
  result: ExtractionResult;
  onReset: () => void;
}

export const ResultViewer: React.FC<ResultViewerProps> = ({ result, onReset }) => {
  // View mode: 'timestamps' vs 'fulltext'
  const [viewMode, setViewMode] = useState<'timestamps' | 'fulltext'>('timestamps');
  // For foreign videos: 'bilingual' | 'vietnamese_only' | 'chinese_only'
  const [langTab, setLangTab] = useState<'bilingual' | 'vietnamese_only' | 'chinese_only'>('bilingual');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [copiedType, setCopiedType] = useState<string | null>(null);

  const isVietnamese = result.isVietnamese;

  // Filtered segments based on search
  const filteredSegments = result.segments.filter((seg) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const matchOriginal = seg.originalText.toLowerCase().includes(term);
    const matchTranslated = seg.translatedText?.toLowerCase().includes(term);
    return matchOriginal || matchTranslated;
  });

  const triggerConfetti = () => {
    confetti({
      particleCount: 40,
      spread: 50,
      origin: { y: 0.8 },
      colors: ['#F472B6', '#C084FC', '#818CF8', '#34D399'],
    });
  };

  const handleCopy = async (type: 'vietnamese' | 'chinese' | 'bilingual' | 'timestamps') => {
    const text = formatScriptAsText(result, type);
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedType(type);
      triggerConfetti();
      setTimeout(() => setCopiedType(null), 2000);
    }
  };

  const handleExportTxt = (mode: 'vietnamese' | 'chinese' | 'bilingual' | 'timestamps') => {
    const text = formatScriptAsText(result, mode);
    const safeTitle = (result.videoMetadata.title || 'video')
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase()
      .substring(0, 25);
    downloadTextFile(`kich_ban_${result.videoMetadata.platform}_${safeTitle}.txt`, text);
    triggerConfetti();
  };

  const handleExportSrt = (lang: 'vi' | 'zh') => {
    const srt = generateSrtContent(result, lang);
    const safeTitle = (result.videoMetadata.title || 'video')
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase()
      .substring(0, 25);
    downloadTextFile(`phu_de_${lang}_${safeTitle}.srt`, srt);
    triggerConfetti();
  };

  return (
    <div id="result-viewer-container" className="space-y-6 animate-in fade-in duration-300">
      
      {/* Video Summary Header Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-pink-100/80 pastel-shadow space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-pink-50">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${
                result.videoMetadata.platform === 'douyin'
                  ? 'bg-rose-100 text-rose-700 border-rose-200'
                  : result.videoMetadata.platform === 'tiktok'
                  ? 'bg-cyan-100 text-cyan-800 border-cyan-200'
                  : 'bg-purple-100 text-purple-700 border-purple-200'
              }`}>
                {result.videoMetadata.platform === 'douyin' ? 'Douyin (抖音)' : result.videoMetadata.platform === 'tiktok' ? 'TikTok' : 'Media File'}
              </span>

              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                isVietnamese
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  : 'bg-indigo-100 text-indigo-800 border-indigo-200'
              }`}>
                {isVietnamese ? '🇻🇳 Video Tiếng Việt' : `🇨🇳 ${result.sourceLanguageName} ➔ 🇻🇳 Tiếng Việt`}
              </span>

              {result.videoMetadata.duration && (
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
                  ~{result.videoMetadata.duration}s
                </span>
              )}
            </div>

            <h2 className="text-base sm:text-lg font-bold text-slate-800 leading-snug">
              {result.videoMetadata.title}
            </h2>

            {result.videoMetadata.author && (
              <p className="text-xs text-slate-500">
                Tác giả/Kênh: <span className="font-semibold text-slate-700">{result.videoMetadata.author}</span>
              </p>
            )}
          </div>

          {/* Quick Copy & Export Action Buttons */}
          <div className="flex items-center flex-wrap gap-2 shrink-0">
            {isVietnamese ? (
              /* Vietnamese video actions */
              <>
                <button
                  id="copy-vi-btn"
                  type="button"
                  onClick={() => handleCopy('vietnamese')}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  {copiedType === 'vietnamese' ? (
                    <>
                      <Check className="h-4 w-4 text-white" />
                      <span>Đã Copy Kịch Bản!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Sao Chép Kịch Bản</span>
                    </>
                  )}
                </button>

                <button
                  id="export-txt-btn"
                  type="button"
                  onClick={() => handleExportTxt('vietnamese')}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer"
                  title="Tải file text"
                >
                  <FileText className="h-4 w-4 text-slate-600" />
                  <span>Xuất .TXT</span>
                </button>

                <button
                  id="export-srt-btn"
                  type="button"
                  onClick={() => handleExportSrt('vi')}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-800 font-bold text-xs transition-all cursor-pointer"
                  title="Tải phụ đề .SRT cho CapCut / Premiere"
                >
                  <Download className="h-4 w-4 text-purple-600" />
                  <span>Tải .SRT (Phụ đề)</span>
                </button>
              </>
            ) : (
              /* Chinese/foreign video actions */
              <>
                <button
                  id="copy-translated-vi-btn"
                  type="button"
                  onClick={() => handleCopy('vietnamese')}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  {copiedType === 'vietnamese' ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Đã Copy Tiếng Việt!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Copy Bản Dịch Tiếng Việt</span>
                    </>
                  )}
                </button>

                <button
                  id="copy-chinese-btn"
                  type="button"
                  onClick={() => handleCopy('chinese')}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold text-xs transition-all cursor-pointer"
                >
                  {copiedType === 'chinese' ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Đã Copy Tiếng Trung!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 text-rose-600" />
                      <span>Copy Gốc Tiếng Trung</span>
                    </>
                  )}
                </button>

                <button
                  id="copy-bilingual-btn"
                  type="button"
                  onClick={() => handleCopy('bilingual')}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-800 font-bold text-xs transition-all cursor-pointer"
                >
                  {copiedType === 'bilingual' ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Đã Copy Song Ngữ!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 text-purple-600" />
                      <span>Copy Song Ngữ</span>
                    </>
                  )}
                </button>

                <button
                  id="export-txt-bilingual-btn"
                  type="button"
                  onClick={() => handleExportTxt('bilingual')}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer"
                >
                  <FileText className="h-4 w-4 text-slate-600" />
                  <span>Xuất .TXT</span>
                </button>

                <button
                  id="export-srt-vi-btn"
                  type="button"
                  onClick={() => handleExportSrt('vi')}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-indigo-100 hover:bg-indigo-200 text-indigo-800 font-bold text-xs transition-all cursor-pointer"
                  title="Tải phụ đề tiếng Việt .SRT"
                >
                  <Download className="h-4 w-4 text-indigo-600" />
                  <span>Phụ Đề .SRT</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* View Switcher Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
          {/* If Chinese, choose tab */}
          {!isVietnamese ? (
            <div className="flex items-center p-1 bg-pink-50/80 rounded-2xl border border-pink-200/50 flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setLangTab('bilingual')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  langTab === 'bilingual'
                    ? 'bg-white text-purple-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Song Ngữ 2 Cột (Trung - Việt)
              </button>
              <button
                type="button"
                onClick={() => setLangTab('vietnamese_only')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  langTab === 'vietnamese_only'
                    ? 'bg-white text-emerald-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Chỉ Tiếng Việt
              </button>
              <button
                type="button"
                onClick={() => setLangTab('chinese_only')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  langTab === 'chinese_only'
                    ? 'bg-white text-rose-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Chỉ Tiếng Trung
              </button>
            </div>
          ) : (
            /* Vietnamese View Mode Switcher */
            <div className="flex items-center p-1 bg-pink-50/80 rounded-2xl border border-pink-200/50">
              <button
                type="button"
                onClick={() => setViewMode('timestamps')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'timestamps'
                    ? 'bg-white text-purple-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Clock className="h-3.5 w-3.5 text-purple-600" />
                <span>Theo Mốc Thời Gian (Timestamp)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('fulltext')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'fulltext'
                    ? 'bg-white text-purple-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <AlignLeft className="h-3.5 w-3.5 text-pink-600" />
                <span>Đoạn Văn Liền Mạch</span>
              </button>
            </div>
          )}

          {/* Quick Search */}
          <div className="relative w-full sm:w-56">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm từ khóa trong kịch bản..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-pink-300 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* Main Script Display Card */}
      <div className="bg-white rounded-3xl border border-pink-100/80 pastel-shadow overflow-hidden">
        
        {/* VIEW 1: Vietnamese Video */}
        {isVietnamese ? (
          viewMode === 'fulltext' ? (
            /* Vietnamese Fulltext View */
            <div className="p-6 sm:p-8 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-pink-50">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Toàn bộ kịch bản lời thoại:
                </span>
                <span className="text-xs text-slate-400">
                  {result.fullOriginalScript.split(/\s+/).length} từ
                </span>
              </div>
              <p className="text-sm sm:text-base text-slate-800 leading-relaxed whitespace-pre-wrap font-normal">
                {result.fullOriginalScript}
              </p>
            </div>
          ) : (
            /* Vietnamese Timestamps View */
            <div className="divide-y divide-pink-50">
              <div className="grid grid-cols-12 bg-[#FFF9FB] p-3.5 px-6 text-xs font-bold text-slate-500 border-b border-pink-100">
                <div className="col-span-3 sm:col-span-2">Mốc Thời Gian</div>
                <div className="col-span-9 sm:col-span-10">Lời Thoại Video</div>
              </div>

              {filteredSegments.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Không tìm thấy câu thoại nào chứa từ khóa tìm kiếm.
                </div>
              ) : (
                filteredSegments.map((seg, idx) => (
                  <div
                    key={seg.id || idx}
                    className="grid grid-cols-12 p-4 sm:px-6 gap-3 items-start hover:bg-[#FFF9FB] transition-colors"
                  >
                    <div className="col-span-3 sm:col-span-2">
                      <span className="font-mono text-xs font-bold text-purple-800 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-100 inline-block">
                        {seg.timestamp}
                      </span>
                    </div>
                    <div className="col-span-9 sm:col-span-10">
                      <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">
                        {seg.originalText}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )
        ) : (
          /* VIEW 2: Chinese (or Foreign) Video */
          <div className="divide-y divide-pink-50">
            {/* Header row */}
            <div className="grid grid-cols-12 bg-gradient-to-r from-pink-50/90 via-purple-50/70 to-indigo-50/70 p-4 px-6 text-xs font-bold text-slate-700 border-b border-pink-100">
              <div className="col-span-12 sm:col-span-2 flex items-center gap-1 text-purple-900">
                <Clock className="h-3.5 w-3.5 text-purple-600" />
                <span>Thời Gian</span>
              </div>
              
              {langTab !== 'vietnamese_only' && (
                <div className={`col-span-12 ${langTab === 'bilingual' ? 'sm:col-span-5' : 'sm:col-span-10'} text-rose-900 flex items-center gap-1`}>
                  <span>🇨🇳 Kịch Bản Gốc Tiếng Trung (Douyin)</span>
                </div>
              )}

              {langTab !== 'chinese_only' && (
                <div className={`col-span-12 ${langTab === 'bilingual' ? 'sm:col-span-5' : 'sm:col-span-10'} text-indigo-900 flex items-center gap-1`}>
                  <span>🇻🇳 Bản Dịch Tiếng Việt</span>
                </div>
              )}
            </div>

            {filteredSegments.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Không tìm thấy câu thoại nào chứa từ khóa tìm kiếm.
              </div>
            ) : (
              filteredSegments.map((seg, idx) => (
                <div
                  key={seg.id || idx}
                  className="grid grid-cols-12 p-4 sm:px-6 gap-3 items-start hover:bg-[#FFF9FB] transition-colors"
                >
                  {/* Timestamp */}
                  <div className="col-span-12 sm:col-span-2">
                    <span className="font-mono text-xs font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-100 inline-block">
                      {seg.timestamp}
                    </span>
                  </div>

                  {/* Chinese Original */}
                  {langTab !== 'vietnamese_only' && (
                    <div className={`col-span-12 ${langTab === 'bilingual' ? 'sm:col-span-5' : 'sm:col-span-10'} space-y-1`}>
                      <span className="sm:hidden text-[10px] font-bold text-rose-600 block uppercase">
                        Gốc Tiếng Trung:
                      </span>
                      <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-normal">
                        {seg.originalText}
                      </p>
                    </div>
                  )}

                  {/* Vietnamese Translation */}
                  {langTab !== 'chinese_only' && (
                    <div className={`col-span-12 ${langTab === 'bilingual' ? 'sm:col-span-5' : 'sm:col-span-10'} space-y-1 sm:border-l sm:border-pink-50 sm:pl-3`}>
                      <span className="sm:hidden text-[10px] font-bold text-indigo-600 block uppercase">
                        Bản Dịch Tiếng Việt:
                      </span>
                      <p className="text-xs sm:text-sm font-medium text-slate-900 leading-relaxed bg-pink-50/40 p-2 rounded-xl border border-pink-100/50">
                        {seg.translatedText || seg.originalText}
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Footer info bar */}
        <div className="p-3.5 px-6 bg-[#FFF9FB] border-t border-pink-100 flex items-center justify-between text-xs text-slate-500 flex-wrap gap-2">
          <span>
            Tổng cộng: <strong className="text-slate-800">{result.segments.length}</strong> câu thoại
          </span>
          <span className="text-slate-400">
            Trích xuất bởi Gemini AI • Sẵn sàng xuất phụ đề CapCut/Premiere
          </span>
        </div>
      </div>

      {/* Process Another Video Button */}
      <div className="pt-2 text-center">
        <button
          id="new-video-btn"
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white hover:bg-pink-50 text-pink-700 font-bold text-xs sm:text-sm border border-pink-200 shadow-sm transition-all hover:scale-105 active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Bóc Tách Video Khác</span>
        </button>
      </div>
    </div>
  );
};
