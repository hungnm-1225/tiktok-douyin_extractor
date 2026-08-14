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
import { SampleModal } from './components/SampleModal';
import { ApiKeyModal } from './components/ApiKeyModal';
import { ExtractionResult, SampleVideoItem } from './types';
import { AlertCircle, Sparkles, Heart, Key } from 'lucide-react';
import confetti from 'canvas-confetti';

const LOCAL_STORAGE_HISTORY_KEY = 'tiktok_douyin_script_history_v2';
const LOCAL_STORAGE_API_KEY = 'gemini_custom_api_key';

const DEFAULT_SAMPLES: SampleVideoItem[] = [
  {
    id: 'douyin-skincare-viral',
    title: 'Douyin Skincare: 3 Bước Trị Mụn Ẩn Cấp Tốc',
    author: 'Linh Trần Beauty (Douyin Creator)',
    category: 'Làm Đẹp & Mỹ Phẩm',
    platform: 'douyin',
    duration: 28,
    coverUrl: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&auto=format&fit=crop&q=80',
    description: 'Video triệu view chia sẻ routine trị mụn ẩn bằng Acid Salicylic & cấp ẩm phục hồi.',
    sampleResult: {
      sourceLanguage: 'zh',
      sourceLanguageName: 'Tiếng Trung (Douyin)',
      isVietnamese: false,
      summary: 'Kịch bản hướng dẫn chăm sóc da trị mụn ẩn 3 bước chuẩn Douyin cực viral.',
      toneAndStyle: 'Chia sẻ kinh nghiệm làm đẹp, tự tin, cuốn hút',
      fullOriginalScript: '今天教大家一个三步去闭口的方法，真的超级有用！第一步先用温水洗脸打开毛孔。第二步厚涂水杨酸棉片湿敷三分钟。第三步一定要用修护精华锁住水分。坚持一周，皮肤细腻透亮！',
      fullVietnameseScript: 'Hôm nay mình sẽ chỉ cho mọi người phương pháp 3 bước trị mụn ẩn cực kỳ hiệu quả luôn nha! Bước 1: Rửa mặt bằng nước ấm để giãn nở lỗ chân lông. Bước 2: Dùng bông tẩy trang thấm Salicylic Acid đắp nhẹ trong 3 phút. Bước 3: Nhất định phải thoa serum phục hồi để khóa ẩm. Kiên trì 1 tuần, da sẽ mịn màng và căng bóng rõ rệt!',
      segments: [
        { timestamp: '00:00 - 00:05', startSec: 0, endSec: 5, originalText: '今天教大家一个三步去闭口的方法，真的超级有用！', vietnameseTranslation: 'Hôm nay mình sẽ chỉ cho mọi người phương pháp 3 bước trị mụn ẩn cực kỳ hiệu quả luôn nha!', speaker: 'Người hướng dẫn' },
        { timestamp: '00:05 - 00:10', startSec: 5, endSec: 10, originalText: '第一步先用温水洗脸打开毛孔。', vietnameseTranslation: 'Bước 1: Rửa mặt bằng nước ấm để giãn nở lỗ chân lông.', speaker: 'Người hướng dẫn' },
        { timestamp: '00:10 - 00:16', startSec: 10, endSec: 16, originalText: '第二步厚涂水杨酸棉片湿敷三分钟。', vietnameseTranslation: 'Bước 2: Dùng bông tẩy trang thấm Salicylic Acid đắp nhẹ trong 3 phút.', speaker: 'Người hướng dẫn' },
        { timestamp: '00:16 - 00:23', startSec: 16, endSec: 23, originalText: '第三步一定要用修护精华锁住水分。', vietnameseTranslation: 'Bước 3: Nhất định phải thoa serum phục hồi để khóa ẩm.', speaker: 'Người hướng dẫn' },
        { timestamp: '00:23 - 00:28', startSec: 23, endSec: 28, originalText: '坚持一周，皮肤细腻透亮！', vietnameseTranslation: 'Kiên trì 1 tuần, da sẽ mịn màng và căng bóng rõ rệt!', speaker: 'Người hướng dẫn' },
      ],
      videoMetadata: {
        url: 'https://v.douyin.com/sample1',
        platform: 'douyin',
        title: 'Douyin Skincare: 3 Bước Trị Mụn Ẩn Cấp Tốc',
        author: 'Linh Trần Beauty',
        duration: 28,
      },
    },
  },
  {
    id: 'tiktok-vn-food-review',
    title: 'Review Phố Ẩm Thực Hồ Thị Kỷ - Ăn Sập 10 Món',
    author: 'Ăn Cùng Quỳnh (TikToker)',
    category: 'Ẩm Thực / Review',
    platform: 'tiktok',
    duration: 35,
    coverUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&auto=format&fit=crop&q=80',
    description: 'Clip review ẩm thực Sài Gòn sôi động, giọng nói tự nhiên, năng lượng tích cực.',
    sampleResult: {
      sourceLanguage: 'vi',
      sourceLanguageName: 'Tiếng Việt',
      isVietnamese: true,
      summary: 'Review các món ăn vặt hot hit tại chợ Hồ Thị Kỷ với mức giá sinh viên.',
      toneAndStyle: 'Hào hứng, gần gũi, review chân thật',
      fullOriginalScript: 'Hello mọi người! Hôm nay Quỳnh sẽ dắt mọi người đi ăn sập khu phố ẩm thực Hồ Thị Kỷ chỉ với 100 cành nha. Món đầu tiên chính là thịt xiên nướng phô mai béo ngậy. Tiếp theo là bánh tráng nướng giòn rụm thơm nức mũi. Cuối cùng tráng miệng bằng ly chè Thái sầu riêng siêu đỉnh!',
      fullVietnameseScript: 'Hello mọi người! Hôm nay Quỳnh sẽ dắt mọi người đi ăn sập khu phố ẩm thực Hồ Thị Kỷ chỉ với 100 cành nha. Món đầu tiên chính là thịt xiên nướng phô mai béo ngậy. Tiếp theo là bánh tráng nướng giòn rụm thơm nức mũi. Cuối cùng tráng miệng bằng ly chè Thái sầu riêng siêu đỉnh!',
      segments: [
        { timestamp: '00:00 - 00:07', startSec: 0, endSec: 7, originalText: 'Hello mọi người! Hôm nay Quỳnh sẽ dắt mọi người đi ăn sập khu phố ẩm thực Hồ Thị Kỷ chỉ với 100 cành nha.', vietnameseTranslation: 'Hello mọi người! Hôm nay Quỳnh sẽ dắt mọi người đi ăn sập khu phố ẩm thực Hồ Thị Kỷ chỉ với 100 cành nha.', speaker: 'Quỳnh Food' },
        { timestamp: '00:07 - 00:15', startSec: 7, endSec: 15, originalText: 'Món đầu tiên chính là thịt xiên nướng phô mai béo ngậy.', vietnameseTranslation: 'Món đầu tiên chính là thịt xiên nướng phô mai béo ngậy.', speaker: 'Quỳnh Food' },
        { timestamp: '00:15 - 00:25', startSec: 15, endSec: 25, originalText: 'Tiếp theo là bánh tráng nướng giòn rụm thơm nức mũi.', vietnameseTranslation: 'Tiếp theo là bánh tráng nướng giòn rụm thơm nức mũi.', speaker: 'Quỳnh Food' },
        { timestamp: '00:25 - 00:35', startSec: 25, endSec: 35, originalText: 'Cuối cùng tráng miệng bằng ly chè Thái sầu riêng siêu đỉnh!', vietnameseTranslation: 'Cuối cùng tráng miệng bằng ly chè Thái sầu riêng siêu đỉnh!', speaker: 'Quỳnh Food' },
      ],
      videoMetadata: {
        url: 'https://www.tiktok.com/@sample2',
        platform: 'tiktok',
        title: 'Review Phố Ẩm Thực Hồ Thị Kỷ',
        author: 'Ăn Cùng Quỳnh',
        duration: 35,
      },
    },
  },
];

export default function App() {
  const [url, setUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentResult, setCurrentResult] = useState<ExtractionResult | null>(null);
  const [history, setHistory] = useState<ExtractionResult[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isSampleOpen, setIsSampleOpen] = useState<boolean>(false);
  const [isApiKeyOpen, setIsApiKeyOpen] = useState<boolean>(false);
  const [apiKey, setApiKey] = useState<string>('');
  const [samples, setSamples] = useState<SampleVideoItem[]>(DEFAULT_SAMPLES);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load history and custom API key from LocalStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setHistory(parsed.slice(0, 5));
        }
      }
      const savedKey = localStorage.getItem(LOCAL_STORAGE_API_KEY);
      if (savedKey) {
        setApiKey(savedKey);
      }
    } catch (e) {
      console.warn('Could not read from LocalStorage:', e);
    }
  }, []);

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    try {
      if (key) {
        localStorage.setItem(LOCAL_STORAGE_API_KEY, key);
      } else {
        localStorage.removeItem(LOCAL_STORAGE_API_KEY);
      }
    } catch (e) {
      console.warn('Could not save API key:', e);
    }
  };

  // Fetch samples from server
  useEffect(() => {
    fetch('/api/samples')
      .then((res) => res.json())
      .then((data) => {
        if (data?.samples) {
          setSamples(data.samples);
        }
      })
      .catch((err) => console.warn('Failed to load samples:', err));
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
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey.trim()) {
        headers['x-gemini-api-key'] = apiKey.trim();
      }

      const res = await fetch('/api/extract', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          url: url.trim(),
          customApiKey: apiKey.trim() || undefined,
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
          msg = 'Hạn mức Gemini AI hôm nay tạm thời đạt giới hạn. Bạn có thể bấm nút "API Key" ở góc trên để dán API Key cá nhân miễn phí từ Google AI Studio, hoặc thử các Video Mẫu trong thư viện!';
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
      let errMsg = err.message || 'Đã có lỗi xảy ra. Hãy thử dùng một trong các Video Mẫu hoặc tải file âm thanh lên.';
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
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (apiKey.trim()) {
          headers['x-gemini-api-key'] = apiKey.trim();
        }

        const res = await fetch('/api/upload-media', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            base64Data,
            fileName: file.name,
            mimeType: file.type || 'audio/mp3',
            title: file.name.replace(/\.[^/.]+$/, ''),
            customApiKey: apiKey.trim() || undefined,
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
            msg = 'Hạn mức Gemini AI hôm nay tạm thời đạt giới hạn. Bạn có thể bấm nút "API Key" ở góc trên để dán API Key cá nhân miễn phí từ Google AI Studio!';
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

  // Select sample video
  const handleSelectSample = (sample: SampleVideoItem | string) => {
    const sampleId = typeof sample === 'string' ? sample : sample.id;
    const found = samples.find((s) => s.id === sampleId);

    if (found?.sampleResult) {
      const fullResult: ExtractionResult = {
        id: `ext_sample_${Date.now()}`,
        createdAt: Date.now(),
        videoMetadata: found.sampleResult.videoMetadata || {
          url: found.url,
          platform: found.platform,
          title: found.title,
          duration: 30,
        },
        segments: found.sampleResult.segments || [],
        fullOriginalScript: found.sampleResult.fullOriginalScript || '',
        fullTranslatedScript: found.sampleResult.fullTranslatedScript,
        sourceLanguage: found.sampleResult.sourceLanguage || 'zh',
        sourceLanguageName: found.sampleResult.sourceLanguageName || 'Tiếng Trung (Douyin)',
        isVietnamese: Boolean(found.sampleResult.isVietnamese),
        cleanedUpTempFiles: true,
      };

      setCurrentResult(fullResult);
      saveToHistory(fullResult);
      setUrl(found.url);

      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#F472B6', '#C084FC'],
      });
    }
  };

  return (
    <div id="main-app-container" className="min-h-screen bg-[#FFF9FB] text-slate-700 flex flex-col font-['Quicksand',sans-serif]">
      {/* Header */}
      <Header
        historyCount={history.length}
        hasCustomKey={Boolean(apiKey)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenSamples={() => setIsSampleOpen(true)}
        onOpenApiKeyModal={() => setIsApiKeyOpen(true)}
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
              onSelectSample={(sampleId) => handleSelectSample(sampleId)}
              isLoading={isLoading}
            />

            {/* Simple Feature Info Cards */}
            <section id="feature-highlights" className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-5 rounded-3xl bg-white border border-pink-100/70 pastel-shadow-sm space-y-2 text-center">
                <div className="text-2xl">🇻🇳</div>
                <h3 className="font-bold text-sm text-slate-800">Video Tiếng Việt</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Bóc tách nguyên văn 100% từng câu thoại tiếng Việt theo mốc thời gian.
                </p>
              </div>

              <div className="p-5 rounded-3xl bg-white border border-purple-100/70 pastel-shadow-sm space-y-2 text-center">
                <div className="text-2xl">🇨🇳 ➔ 🇻🇳</div>
                <h3 className="font-bold text-sm text-slate-800">Video Tiếng Trung (Douyin)</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Xuất song ngữ: chữ Hán nguyên bản + bản dịch Tiếng Việt bắt trend mượt mà.
                </p>
              </div>

              <div className="p-5 rounded-3xl bg-white border border-indigo-100/70 pastel-shadow-sm space-y-2 text-center">
                <div className="text-2xl">⏱️</div>
                <h3 className="font-bold text-sm text-slate-800">Xuất Phụ Đề .SRT & .TXT</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Sao chép 1-click hoặc tải file SRT để import trực tiếp vào CapCut / Premiere.
                </p>
              </div>
            </section>
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
          TikTok & Douyin Script Extractor <Heart className="h-3.5 w-3.5 fill-pink-400 text-pink-500 inline" /> Hỗ trợ Video Tiếng Việt & Tiếng Trung Song Ngữ
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

      {/* Sample Modal */}
      <SampleModal
        isOpen={isSampleOpen}
        onClose={() => setIsSampleOpen(false)}
        samples={samples}
        onSelectSample={handleSelectSample}
      />

      {/* Api Key Modal */}
      <ApiKeyModal
        isOpen={isApiKeyOpen}
        onClose={() => setIsApiKeyOpen(false)}
        apiKey={apiKey}
        onSaveApiKey={handleSaveApiKey}
      />
    </div>
  );
}
