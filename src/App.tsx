/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { InputSection } from './components/InputSection';
import { ResultViewer } from './components/ResultViewer';
import { LoadingCuteModal } from './components/LoadingCuteModal';
import { HistoryDrawer } from './components/HistoryDrawer';
import { ExtractionResult } from './types';
import { AlertCircle, Sparkles} from 'lucide-react';
import confetti from 'canvas-confetti';

const LOCAL_STORAGE_HISTORY_KEY = 'tiktok_douyin_script_history_v2';

export default function App() {
  const [url, setUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentResult, setCurrentResult] = useState<ExtractionResult | null>(null);
  const [history, setHistory] = useState<ExtractionResult[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load history from LocalStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setHistory(parsed.slice(0, 5));
        }
      }
    } catch (e) {
      console.warn('Could not read from LocalStorage:', e);
    }
  }, []);

  const saveToHistory = (newResult: ExtractionResult) => {
    setHistory((prev) => {
      const filtered = prev.filter(
        (item) => item.id !== newResult.id && item.videoMetadata.title !== newResult.videoMetadata.title
      );
      const updated = [newResult, ...filtered].slice(0, 5);
      try {
        localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
      return updated;
    });
  };

  const handleClearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(LOCAL_STORAGE_HISTORY_KEY);
    } catch (e) {
      console.warn('LocalStorage clear error:', e);
    }
  };

  const handleDeleteHistoryItem = (id: string) => {
    setHistory((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      try {
        localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('LocalStorage item delete error:', e);
      }
      return updated;
    });
  };

  // Submit URL extraction
  const handleSubmitUrl = async () => {
    if (!url.trim()) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
        }),
      });

      let data: any;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const textErr = await res.text();
        throw new Error(textErr || `Lỗi phản hồi từ máy chủ (${res.status})`);
      }

      if (!res.ok || !data.success) {
        let msg = data.error || 'Bóc tách video thất bại.';
        if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
          msg = 'Hạn mức AI hôm nay tạm thời đạt giới hạn. Vui lòng thử lại sau giây lát!';
        }
        throw new Error(msg);
      }

      setCurrentResult(data.data);
      saveToHistory(data.data);

      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#F472B6', '#C084FC', '#818CF8'],
      });
    } catch (err: any) {
      console.error('Extract error:', err);
      let errMsg = err.message || 'Đã có lỗi xảy ra khi bóc tách video.';
      if (errMsg.includes('Failed to fetch')) {
        errMsg = 'Không thể kết nối tới máy chủ. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau vài giây.';
      }
      setErrorMessage(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Upload custom video/audio file
  const handleUploadFile = (file: File) => {
    if (!file) return;

    setIsLoading(true);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;
        const res = await fetch('/api/upload-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base64Data,
            fileName: file.name,
            mimeType: file.type || 'audio/mp3',
            title: file.name.replace(/\.[^/.]+$/, ''),
          }),
        });

        let data: any;
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          data = await res.json();
        } else {
          const textErr = await res.text();
          throw new Error(textErr || `Lỗi phản hồi từ máy chủ (${res.status})`);
        }

        if (!res.ok || !data.success) {
          let msg = data.error || 'Lỗi bóc tách file media.';
          if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
            msg = 'Hạn mức AI hôm nay tạm thời đạt giới hạn. Vui lòng thử lại sau giây lát!';
          }
          throw new Error(msg);
        }

        setCurrentResult(data.data);
        saveToHistory(data.data);

        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#F472B6', '#C084FC', '#818CF8'],
        });
      } catch (err: any) {
        console.error('Upload extract error:', err);
        let errMsg = err.message || 'Lỗi xử lý file tải lên.';
        if (errMsg.includes('Failed to fetch')) {
          errMsg = 'Không thể kết nối tới máy chủ. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau vài giây.';
        }
        setErrorMessage(errMsg);
      } finally {
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
      setErrorMessage('Không thể đọc file đã chọn.');
      setIsLoading(false);
    };

    reader.readAsDataURL(file);
  };

  return (
    <div id="main-app-container" className="min-h-screen bg-[#FFF9FB] text-slate-700 flex flex-col font-['Quicksand',sans-serif]">
      {/* Header */}
      <Header
        historyCount={history.length}
        onOpenHistory={() => setIsHistoryOpen(true)}
      />

      {/* Main Container */}
      <main id="app-body" className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        
        {/* Error Alert Box */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start justify-between gap-3 shadow-sm animate-in fade-in">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <strong className="font-bold">Thông báo:</strong> {errorMessage}
              </div>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs font-bold text-rose-600 hover:text-rose-800 underline shrink-0 cursor-pointer"
            >
              Đóng
            </button>
          </div>
        )}

        {/* Dynamic View: Input Section or Result View */}
        {!currentResult ? (
          <div className="space-y-8">
            {/* Hero Title */}
            <section id="hero-banner" className="text-center max-w-2xl mx-auto space-y-3 pt-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-100 text-pink-700 text-xs font-bold border border-pink-200 shadow-xs">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Bóc Tách Kịch Bản TikTok & Douyin Tự Động</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-800 tracking-tight leading-tight">
                Trích Xuất Script Video <br className="hidden sm:inline" />
                <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 bg-clip-text text-transparent">
                  Tiếng Việt & Tiếng Trung Song Ngữ
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-medium">
                Tự động bóc chính xác từng câu thoại kèm timestamp. Với video Tiếng Việt xuất kịch bản chuẩn xác; với video Tiếng Trung xuất cả tiếng Trung gốc và bản dịch Tiếng Việt.
              </p>
            </section>

            {/* Input Form Card */}
            <InputSection
              url={url}
              setUrl={setUrl}
              onSubmitUrl={handleSubmitUrl}
              onUploadFile={handleUploadFile}
              isLoading={isLoading}
            />
          </div>
        ) : (
          /* Result View */
          <ResultViewer
            result={currentResult}
            onReset={() => {
              setCurrentResult(null);
              setUrl('');
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer id="app-footer" className="mt-16 py-6 border-t border-pink-100 bg-white/50 text-center text-xs text-slate-400">
        <p className="flex items-center justify-center gap-1.5 font-medium">
          Dành riêng cho Hoàng Hồng Hạnh <Sparkles className="h-3.5 w-3.5 fill-pink-400 text-pink-500 inline" /> 
        </p>
      </footer>

      {/* Loading Modal */}
      <LoadingCuteModal
        isOpen={isLoading}
        option="script_extraction"
      />

      {/* History Drawer */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelectHistoryItem={(item) => setCurrentResult(item)}
        onClearHistory={handleClearHistory}
        onDeleteItem={handleDeleteHistoryItem}
      />
    </div>
  );
}
