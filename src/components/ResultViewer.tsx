import React, { useState, useRef, useEffect } from 'react';
import { 
  Copy, 
  Check, 
  Download, 
  FileText, 
  Search, 
  Clock, 
  AlignLeft, 
  ArrowLeft,
  FileDown,
  Sparkles,
  User,
  Video,
  ChevronDown,
  MessageSquareQuote,
  Flame,
  Volume2,
  Play,
  Eye,
  EyeOff
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ExtractionResult, ScriptSegment } from '../types';
import { 
  copyToClipboard, 
  downloadTextFile, 
  generateSrtContent, 
  formatScriptAsText, 
  exportDocxFile 
} from '../utils/exportUtils';
import { CustomMediaPlayer, CustomMediaPlayerRef } from './CustomMediaPlayer';

interface ResultViewerProps {
  result: ExtractionResult;
  onReset: () => void;
}

interface DialogueTurn {
  speaker: string;
  startSec: number;
  endSec: number;
  timestamp: string;
  originalText: string;
  translatedText?: string;
  count: number;
}

/**
 * Groups consecutive segments by the same speaker into cohesive dialogue blocks
 */
function groupSegmentsBySpeaker(segments: ScriptSegment[], isVietnamese: boolean): DialogueTurn[] {
  if (!segments || segments.length === 0) return [];

  const turns: DialogueTurn[] = [];
  let currentTurn: DialogueTurn | null = null;

  segments.forEach((seg, idx) => {
    const speaker = seg.speaker?.trim() || (isVietnamese ? 'Lời thoại' : 'Người nói');
    const trans = seg.translatedText || seg.vietnameseTranslation || (isVietnamese ? seg.originalText : undefined);

    if (currentTurn && currentTurn.speaker === speaker) {
      // Append to current speaker's turn
      currentTurn.originalText += ' ' + seg.originalText.trim();
      if (trans && currentTurn.translatedText !== undefined) {
        currentTurn.translatedText += ' ' + trans.trim();
      }
      currentTurn.endSec = seg.endSec;
      currentTurn.count += 1;
    } else {
      // Push previous turn and start a new turn
      if (currentTurn) {
        turns.push(currentTurn);
      }
      currentTurn = {
        speaker,
        startSec: seg.startSec,
        endSec: seg.endSec,
        timestamp: seg.timestamp,
        originalText: seg.originalText.trim(),
        translatedText: trans ? trans.trim() : undefined,
        count: 1,
      };
    }
  });

  if (currentTurn) {
    turns.push(currentTurn);
  }

  return turns;
}

export const ResultViewer: React.FC<ResultViewerProps> = ({ result, onReset }) => {
  // View mode: 'timestamps' vs 'fulltext'
  const [viewMode, setViewMode] = useState<'timestamps' | 'fulltext'>('timestamps');
  // For foreign videos: if onlyVietnamese requested, default to 'vietnamese_only'
  const [langTab, setLangTab] = useState<'bilingual' | 'vietnamese_only' | 'chinese_only'>(
    result.onlyVietnamese ? 'vietnamese_only' : 'bilingual'
  );
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [isExportingDocx, setIsExportingDocx] = useState<boolean>(false);
  const [isDownloadDropdownOpen, setIsDownloadDropdownOpen] = useState<boolean>(false);
  const [isPlayerVisible, setIsPlayerVisible] = useState<boolean>(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<CustomMediaPlayerRef>(null);

  const mediaSrc = result.videoMetadata.streamUrl || result.videoMetadata.downloadUrl;
  const isVietnamese = result.isVietnamese;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDownloadDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered segments based on search
  const filteredSegments = result.segments.filter((seg) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const matchOriginal = seg.originalText?.toLowerCase().includes(term);
    const trans = seg.translatedText || seg.vietnameseTranslation || '';
    const matchTranslated = trans.toLowerCase().includes(term);
    const matchSpeaker = seg.speaker?.toLowerCase().includes(term);
    return matchOriginal || matchTranslated || matchSpeaker;
  });

  // Grouped dialogue turns for fulltext view
  const dialogueTurns = groupSegmentsBySpeaker(filteredSegments, isVietnamese);
  const distinctSpeakers = Array.from(
    new Set(filteredSegments.map((s) => s.speaker?.trim()).filter(Boolean))
  );
  const isDialogue = distinctSpeakers.length > 1;

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
    setIsDownloadDropdownOpen(false);
    triggerConfetti();
  };

  const handleExportSrt = (lang: 'vi' | 'zh') => {
    const srt = generateSrtContent(result, lang);
    const safeTitle = (result.videoMetadata.title || 'video')
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase()
      .substring(0, 25);
    downloadTextFile(`phu_de_${lang}_${safeTitle}.srt`, srt);
    setIsDownloadDropdownOpen(false);
    triggerConfetti();
  };

  const handleExportDocx = async (mode: 'vietnamese' | 'chinese' | 'bilingual') => {
    try {
      setIsExportingDocx(true);
      await exportDocxFile(result, mode);
      setIsDownloadDropdownOpen(false);
      triggerConfetti();
    } catch (err) {
      console.error('Lỗi xuất file docx:', err);
    } finally {
      setIsExportingDocx(false);
    }
  };

  return (
    <div id="result-viewer-container" className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top Navigation Bar: Back Button prominently at top */}
      <div className="flex items-center justify-between gap-3 pb-1">
        <button
          id="top-back-btn"
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white hover:bg-pink-50 text-pink-700 font-bold text-xs sm:text-sm border border-pink-200 shadow-xs transition-all hover:scale-105 active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Bóc Tách Video Khác</span>
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border shadow-2xs ${
            result.videoMetadata.platform === 'douyin'
              ? 'bg-rose-100 text-rose-700 border-rose-200'
              : result.videoMetadata.platform === 'tiktok'
              ? 'bg-cyan-100 text-cyan-800 border-cyan-200'
              : result.videoMetadata.mediaType === 'audio' || result.videoMetadata.mimeType?.startsWith('audio/')
              ? 'bg-purple-100 text-purple-700 border-purple-200'
              : 'bg-indigo-100 text-indigo-700 border-indigo-200'
          }`}>
            {result.videoMetadata.platform === 'douyin' 
              ? 'Douyin (抖音)' 
              : result.videoMetadata.platform === 'tiktok' 
              ? 'TikTok' 
              : result.videoMetadata.mediaType === 'audio' || result.videoMetadata.mimeType?.startsWith('audio/')
              ? '🎵 Bản Ghi Âm Thanh'
              : 'Video File'}
          </span>

          <span className={`px-3 py-1 rounded-full text-xs font-bold border shadow-2xs ${
            isVietnamese
              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
              : 'bg-indigo-100 text-indigo-800 border-indigo-200'
          }`}>
            {isVietnamese ? '🇻🇳 Tiếng Việt' : `🇨🇳 ${result.sourceLanguageName} ➔ 🇻🇳 Tiếng Việt`}
          </span>
        </div>
      </div>

      {/* CARD 1: Video Metadata & Summary Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-pink-100/80 pastel-shadow space-y-5">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <h2 className="text-base sm:text-xl font-extrabold text-slate-800 leading-snug">
                {result.videoMetadata.title}
              </h2>
              <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                {result.videoMetadata.author && (
                  <p>
                    Kênh/Tác giả: <strong className="text-slate-700 font-semibold">{result.videoMetadata.author}</strong>
                  </p>
                )}
                {result.videoMetadata.duration && (
                  <>
                    <span>•</span>
                    <span>Thời lượng: ~{result.videoMetadata.duration}s</span>
                  </>
                )}
                {result.modelUsed && (
                  <>
                    <span>•</span>
                    <span className="text-purple-600 font-semibold">AI: {result.modelUsed}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Video Summary Card */}
          {result.summary && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-pink-50/70 via-purple-50/60 to-indigo-50/60 border border-pink-100/80 space-y-2 mt-1">
              <div className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                <span className="font-bold text-purple-900">💡 Tóm tắt nội dung: </span>
                <span className="italic">{result.summary}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CARD 1.5: Custom Pastel Media Player for Video/Audio Verification */}
      {mediaSrc && (
        <div id="media-player-section" className="space-y-2.5">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Video className="h-4 w-4 text-pink-500" />
              <span>Khung Media Đối Chiếu</span>
            </div>

            <button
              type="button"
              onClick={() => setIsPlayerVisible(!isPlayerVisible)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 hover:text-purple-900 px-2.5 py-1 rounded-lg hover:bg-pink-50 transition-colors cursor-pointer"
            >
              {isPlayerVisible ? <EyeOff className="h-3.5 w-3.5 text-pink-500" /> : <Eye className="h-3.5 w-3.5 text-pink-500" />}
              <span>{isPlayerVisible ? 'Thu gọn media' : 'Mở rộng media'}</span>
            </button>
          </div>

          {isPlayerVisible && (
            <CustomMediaPlayer
              ref={playerRef}
              src={mediaSrc}
              title={result.videoMetadata.title}
              platform={result.videoMetadata.platform}
              duration={result.videoMetadata.duration}
              coverImage={result.videoMetadata.coverImage}
              mimeType={result.videoMetadata.mimeType}
              mediaType={result.videoMetadata.mediaType}
            />
          )}
        </div>
      )}

      {/* CARD 2: UNIFIED SCRIPT CONTAINER (Toolbar & Script Data in ONE coherent card) */}
      <div className="bg-white rounded-3xl border border-pink-100/90 pastel-shadow overflow-hidden">
        
        {/* Integrated Header: Action Buttons on top, then View Tabs & Search below */}
        <div className="bg-[#FFF9FB] p-3.5 sm:p-5 border-b border-pink-100/80 space-y-3 sm:space-y-3.5">
          
          {/* Row 1: Action Toolbar directly connected to Script */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-3 border-b border-pink-100/70">
            <div className="flex items-center flex-wrap gap-2">
              {/* 1. Main Copy Button */}
              {isVietnamese ? (
                <button
                  id="copy-vi-btn"
                  type="button"
                  onClick={() => handleCopy('vietnamese')}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs sm:text-sm transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  {copiedType === 'vietnamese' ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Đã sao chép!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Sao Chép</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  id="copy-translated-vi-btn"
                  type="button"
                  onClick={() => handleCopy('vietnamese')}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs sm:text-sm transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  {copiedType === 'vietnamese' ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Đã sao chép!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Sao Chép</span>
                    </>
                  )}
                </button>
              )}

              {/* Quick Copy for Foreign video: Copy Chinese or Bilingual */}
              {!isVietnamese && (
                <>
                  <button
                    id="copy-chinese-btn"
                    type="button"
                    onClick={() => handleCopy('chinese')}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 font-semibold text-xs transition-all border border-rose-200 cursor-pointer"
                  >
                    {copiedType === 'chinese' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5 text-rose-600" />}
                    <span>Tiếng Trung Gốc</span>
                  </button>
                  <button
                    id="copy-bilingual-btn"
                    type="button"
                    onClick={() => handleCopy('bilingual')}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 font-semibold text-xs transition-all border border-purple-200 cursor-pointer"
                  >
                    {copiedType === 'bilingual' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5 text-purple-600" />}
                    <span>Song Ngữ</span>
                  </button>
                </>
              )}
            </div>

            {/* 2. Compact Download Dropdown Button */}
            <div className="relative w-full sm:w-auto" ref={dropdownRef}>
              <button
                id="download-dropdown-btn"
                type="button"
                onClick={() => setIsDownloadDropdownOpen((prev) => !prev)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-100 via-purple-100 to-indigo-100 hover:from-pink-200 hover:via-purple-200 hover:to-indigo-200 text-purple-950 font-bold text-xs sm:text-sm border border-purple-200/80 shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <Download className="h-4 w-4 text-purple-700" />
                <span>Xuất File / Tải Xuống</span>
                <ChevronDown className={`h-4 w-4 text-purple-700 transition-transform duration-200 ${isDownloadDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu Popup (Responsive width & position) */}
              {isDownloadDropdownOpen && (
                <div
                  id="download-dropdown-menu"
                  className="absolute right-0 mt-2 w-full sm:w-72 max-w-[calc(100vw-2rem)] bg-white rounded-2xl p-2 border border-pink-100 shadow-xl shadow-purple-900/10 z-30 space-y-1 animate-in fade-in zoom-in-95 duration-150"
                >
                  {/* Option 1: Word .DOCX */}
                  <button
                    type="button"
                    disabled={isExportingDocx}
                    onClick={() => handleExportDocx(isVietnamese ? 'vietnamese' : langTab === 'chinese_only' ? 'chinese' : langTab === 'vietnamese_only' ? 'vietnamese' : 'bilingual')}
                    className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-purple-50 text-left transition-colors cursor-pointer group"
                  >
                    <div className="p-2 rounded-lg bg-blue-100 text-blue-700 group-hover:bg-blue-200">
                      <FileDown className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">
                        {isExportingDocx ? 'Đang tạo .DOCX...' : 'Xuất File Word (.DOCX)'}
                      </div>
                      <div className="text-[11px] text-slate-400">Bảng timestamp & phân tích kịch bản</div>
                    </div>
                  </button>

                  {/* Option 2: Plain Text .TXT */}
                  <button
                    type="button"
                    onClick={() => handleExportTxt(isVietnamese ? 'vietnamese' : langTab === 'chinese_only' ? 'chinese' : langTab === 'vietnamese_only' ? 'vietnamese' : 'bilingual')}
                    className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-purple-50 text-left transition-colors cursor-pointer group"
                  >
                    <div className="p-2 rounded-lg bg-slate-100 text-slate-700 group-hover:bg-slate-200">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">Xuất File Văn Bản (.TXT)</div>
                      <div className="text-[11px] text-slate-400">File text gọn nhẹ, dễ copy lưu trữ</div>
                    </div>
                  </button>

                  {/* Option 3: Subtitle .SRT */}
                  <button
                    type="button"
                    onClick={() => handleExportSrt(isVietnamese ? 'vi' : langTab === 'chinese_only' ? 'zh' : 'vi')}
                    className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-purple-50 text-left transition-colors cursor-pointer group"
                  >
                    <div className="p-2 rounded-lg bg-purple-100 text-purple-700 group-hover:bg-purple-200">
                      <Download className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">Tải Phụ Đề (.SRT)</div>
                      <div className="text-[11px] text-slate-400">Dành cho CapCut, Premiere, DaVinci</div>
                    </div>
                  </button>

                  {/* Option 4: Direct MP4 Video Download (if available) */}
                  {result.videoMetadata.downloadUrl && (
                    <a
                      href={result.videoMetadata.downloadUrl}
                      download
                      onClick={() => setIsDownloadDropdownOpen(false)}
                      className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-pink-50 text-left transition-colors cursor-pointer group border-t border-pink-50"
                    >
                      <div className="p-2 rounded-lg bg-pink-100 text-pink-700 group-hover:bg-pink-200">
                        <Video className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-pink-700">Tải Video Gốc (MP4)</div>
                        <div className="text-[11px] text-slate-400">Video chất lượng cao gốc</div>
                      </div>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Tabs Switcher (Clean, concise) & Search */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-0.5">
            
            {/* View Mode Switcher: Mốc Thời Gian vs Đoạn Văn Liền Mạch */}
            <div className="flex items-center p-1 bg-white rounded-2xl border border-pink-200/60 shadow-xs w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setViewMode('timestamps')}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'timestamps'
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>Mốc Thời Gian</span>
              </button>
              
              <button
                type="button"
                onClick={() => setViewMode('fulltext')}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'fulltext'
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <AlignLeft className="h-3.5 w-3.5" />
                <span>Đoạn Văn Liền Mạch</span>
              </button>
            </div>

            {/* Quick Search inside script */}
            <div className="relative w-full md:w-64">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm từ khóa trong kịch bản..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white border border-pink-200/80 focus:border-pink-400 outline-none transition-all shadow-inner"
              />
            </div>
          </div>

          {/* Foreign Video: Bilingual Column Mode Selector */}
          {!isVietnamese && (
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <span className="text-xs font-semibold text-slate-500">Ngôn ngữ hiển thị:</span>
              <div className="inline-flex items-center p-1 bg-white rounded-xl border border-pink-200/60 shadow-xs gap-1">
                <button
                  type="button"
                  onClick={() => setLangTab('bilingual')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    langTab === 'bilingual'
                      ? 'bg-purple-100 text-purple-900'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Song Ngữ (Trung - Việt)
                </button>
                <button
                  type="button"
                  onClick={() => setLangTab('vietnamese_only')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    langTab === 'vietnamese_only'
                      ? 'bg-emerald-100 text-emerald-900'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  🇻🇳 Chỉ Tiếng Việt
                </button>
                <button
                  type="button"
                  onClick={() => setLangTab('chinese_only')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    langTab === 'chinese_only'
                      ? 'bg-rose-100 text-rose-900'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  🇨🇳 Chỉ Tiếng Trung
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Script Content Area */}
        <div className="p-0">
          
          {/* ============================================================== */}
          {/* MODE 1: FULLTEXT VIEW (PLAIN TEXT / CLEAN CONVERSATION LINES)  */}
          {/* ============================================================== */}
          {viewMode === 'fulltext' ? (
            <div className="p-6 sm:p-8 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-pink-50">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
                  <MessageSquareQuote className="h-4 w-4 text-pink-500" />
                  <span>
                    {isDialogue
                      ? 'Kịch Bản Đối Thoại Liền Mạch'
                      : 'Toàn Bộ Lời Thoại Liền Mạch'}
                  </span>
                </span>
                <span className="text-xs text-slate-400">
                  {isDialogue ? `${filteredSegments.length} câu đối thoại` : `${result.fullOriginalScript.split(/\s+/).length} từ`}
                </span>
              </div>

              {filteredSegments.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Không tìm thấy câu thoại nào chứa từ khóa tìm kiếm.
                </div>
              ) : isDialogue ? (
                /* CASE A: Multi-speaker conversation -> Clean plain text lines with dash "-" */
                <div className="p-6 rounded-2xl bg-[#FFFBFD] border border-pink-100/70 font-sans text-sm sm:text-base leading-relaxed space-y-3.5 shadow-2xs select-text">
                  {filteredSegments.map((seg, idx) => {
                    const trans = seg.translatedText || seg.vietnameseTranslation || seg.originalText;
                    return (
                      <div key={seg.id || idx} className="flex items-start gap-2.5 group">
                        <span className="text-pink-500 font-bold select-none text-base leading-snug shrink-0">-</span>
                        <div className="flex-1 space-y-1">
                          {isVietnamese ? (
                            <p className="text-slate-800 leading-relaxed font-normal flex items-start gap-1.5">
                              <span>{seg.originalText}</span>
                              {mediaSrc && (
                                <button
                                  type="button"
                                  onClick={() => playerRef.current?.seekTo(seg.startSec)}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-pink-500 hover:text-pink-700 transition-opacity cursor-pointer shrink-0 mt-0.5"
                                  title={`Phát video từ ${seg.timestamp}`}
                                >
                                  <Play className="h-3.5 w-3.5 fill-pink-400" />
                                </button>
                              )}
                            </p>
                          ) : (
                            <>
                              {langTab !== 'vietnamese_only' && (
                                <p className="text-slate-800 leading-relaxed font-normal flex items-start gap-1.5">
                                  <span>{seg.originalText}</span>
                                  {mediaSrc && (
                                    <button
                                      type="button"
                                      onClick={() => playerRef.current?.seekTo(seg.startSec)}
                                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-pink-500 hover:text-pink-700 transition-opacity cursor-pointer shrink-0 mt-0.5"
                                      title={`Phát video từ ${seg.timestamp}`}
                                    >
                                      <Play className="h-3.5 w-3.5 fill-pink-400" />
                                    </button>
                                  )}
                                </p>
                              )}
                              {langTab !== 'chinese_only' && (
                                <p className={`leading-relaxed ${langTab === 'bilingual' ? 'text-emerald-800 text-xs sm:text-sm font-medium pl-3 border-l-2 border-emerald-300' : 'text-slate-800 font-normal'}`}>
                                  {trans}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* CASE B: Single speaker monologue / review -> Natural prose paragraph */
                <div className="p-6 rounded-2xl bg-[#FFFBFD] border border-pink-100/70 font-sans text-sm sm:text-base text-slate-800 leading-relaxed space-y-4 shadow-2xs select-text">
                  {isVietnamese ? (
                    <p className="whitespace-pre-wrap font-normal leading-relaxed">
                      {result.fullOriginalScript || filteredSegments.map((s) => s.originalText.trim()).join(' ')}
                    </p>
                  ) : (
                    <>
                      {langTab !== 'vietnamese_only' && (
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-bold text-rose-600 block uppercase tracking-wider">
                            🇨🇳 Kịch Bản Gốc Tiếng Trung:
                          </span>
                          <p className="whitespace-pre-wrap font-normal leading-relaxed text-slate-800">
                            {result.fullOriginalScript || filteredSegments.map((s) => s.originalText.trim()).join(' ')}
                          </p>
                        </div>
                      )}

                      {langTab !== 'chinese_only' && (
                        <div className={`space-y-1.5 ${langTab === 'bilingual' ? 'pt-4 border-t border-pink-100' : ''}`}>
                          <span className="text-[11px] font-bold text-emerald-700 block uppercase tracking-wider">
                            🇻🇳 Bản Dịch Tiếng Việt Theo Ngữ Cảnh:
                          </span>
                          <p className="whitespace-pre-wrap font-medium leading-relaxed text-slate-900">
                            {result.fullTranslatedScript || result.fullVietnameseScript || filteredSegments.map((s) => s.translatedText || s.vietnameseTranslation || s.originalText).join(' ')}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ============================================================== */
            /* MODE 2: TIMESTAMPS VIEW (DETAILED LINE-BY-LINE TIMESTAMPS)      */
            /* ============================================================== */
            isVietnamese ? (
              /* Vietnamese Timestamps View */
              <div className="divide-y divide-pink-50">
                <div className="hidden sm:grid grid-cols-12 bg-[#FFF9FB] p-3 px-6 text-xs font-bold text-slate-500 border-b border-pink-100">
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
                      className="flex flex-col sm:grid sm:grid-cols-12 p-3 sm:px-6 gap-2 sm:gap-3 items-start hover:bg-[#FFF9FB] transition-colors"
                    >
                      <div className="sm:col-span-2 shrink-0">
                        {mediaSrc ? (
                          <button
                            type="button"
                            onClick={() => playerRef.current?.seekTo(seg.startSec)}
                            className="font-mono text-xs font-bold text-purple-800 bg-purple-50 hover:bg-pink-100 hover:text-pink-700 px-2.5 py-1 rounded-lg border border-purple-100 hover:border-pink-300 transition-all cursor-pointer inline-flex items-center gap-1 group/ts"
                            title="Bấm để phát media tại mốc thời gian này"
                          >
                            <Play className="h-3 w-3 text-pink-500 fill-pink-400 group-hover/ts:scale-110 transition-transform" />
                            <span>{seg.timestamp}</span>
                          </button>
                        ) : (
                          <span className="font-mono text-xs font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-100 inline-block">
                            {seg.timestamp}
                          </span>
                        )}
                      </div>
                      <div className="sm:col-span-10 w-full space-y-1">
                        {seg.speaker && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 font-bold inline-block">
                            🗣️ {seg.speaker}
                          </span>
                        )}
                        <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">
                          {seg.originalText}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              /* Foreign / Chinese Timestamps View */
              <div className="divide-y divide-pink-50">
                <div className="hidden sm:grid grid-cols-12 bg-gradient-to-r from-pink-50/90 via-purple-50/70 to-indigo-50/70 p-3.5 px-6 text-xs font-bold text-slate-700 border-b border-pink-100">
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
                      <span>🇻🇳 Bản Dịch Tiếng Việt Theo Ngữ Cảnh</span>
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
                      className="flex flex-col sm:grid sm:grid-cols-12 p-3 sm:px-6 gap-2 sm:gap-3 items-start hover:bg-[#FFF9FB] transition-colors"
                    >
                      {/* Timestamp */}
                      <div className="sm:col-span-2 shrink-0">
                        {mediaSrc ? (
                          <button
                            type="button"
                            onClick={() => playerRef.current?.seekTo(seg.startSec)}
                            className="font-mono text-xs font-bold text-purple-800 bg-purple-50 hover:bg-pink-100 hover:text-pink-700 px-2.5 py-1 rounded-lg border border-purple-100 hover:border-pink-300 transition-all cursor-pointer inline-flex items-center gap-1 group/ts"
                            title="Bấm để phát media tại mốc thời gian này"
                          >
                            <Play className="h-3 w-3 text-pink-500 fill-pink-400 group-hover/ts:scale-110 transition-transform" />
                            <span>{seg.timestamp}</span>
                          </button>
                        ) : (
                          <span className="font-mono text-xs font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-100 inline-block">
                            {seg.timestamp}
                          </span>
                        )}
                      </div>

                      {/* Chinese Original */}
                      {langTab !== 'vietnamese_only' && (
                        <div className={`w-full ${langTab === 'bilingual' ? 'sm:col-span-5' : 'sm:col-span-10'} space-y-1`}>
                          <span className="sm:hidden text-[10px] font-bold text-rose-600 block uppercase">
                            🇨🇳 Gốc Tiếng Trung:
                          </span>
                          <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-normal">
                            {seg.originalText}
                          </p>
                        </div>
                      )}

                      {/* Vietnamese Translation */}
                      {langTab !== 'chinese_only' && (
                        <div className={`w-full ${langTab === 'bilingual' ? 'sm:col-span-5' : 'sm:col-span-10'} space-y-1 sm:border-l sm:border-pink-50 sm:pl-3`}>
                          <span className="sm:hidden text-[10px] font-bold text-indigo-600 block uppercase">
                            🇻🇳 Bản Dịch Tiếng Việt:
                          </span>
                          {seg.speaker && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 font-bold mb-1 inline-block">
                              🗣️ {seg.speaker}
                            </span>
                          )}
                          <p className="text-xs sm:text-sm font-medium text-slate-900 leading-relaxed bg-pink-50/40 p-2 sm:p-2.5 rounded-xl border border-pink-100/50">
                            {seg.translatedText || seg.vietnameseTranslation || seg.originalText}
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )
          )}
        </div>

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
    </div>
  );
};
