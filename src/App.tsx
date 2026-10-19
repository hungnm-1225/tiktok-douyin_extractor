/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { InputSection, isValidMediaUrl } from './components/InputSection';
import { ResultViewer } from './components/ResultViewer';
import { LoadingCuteModal } from './components/LoadingCuteModal';
import { HistoryDrawer } from './components/HistoryDrawer';
import { SampleModal } from './components/SampleModal';
import { ExtractionResult, SampleVideoItem } from './types';
import { AlertCircle, Sparkles, AlertOctagon, ShieldAlert, Clock, RefreshCw } from 'lucide-react';
import confetti from 'canvas-confetti';
import { upload } from '@vercel/blob/client';
import { extractAudioFromVideoInBrowser } from './utils/exportUtils';

const LOCAL_STORAGE_HISTORY_KEY = 'tiktok_douyin_script_history_v2';

export interface AppErrorState {
  code?: string;
  message: string;
}

const DEFAULT_SAMPLES: SampleVideoItem[] = [
  {
    id: 'douyin-skincare-viral',
    platform: 'douyin',
    title: 'Douyin Skincare: 3 Bước Trị Mụn Ẩn Cấp Tốc Bằng Salicylic Acid',
    niche: 'Mỹ phẩm & Skincare (Tiếng Trung)',
    description: 'Video Douyin 2.4M likes - Kịch bản gốc Tiếng Trung và Bản dịch Tiếng Việt.',
    badge: 'Tiếng Trung (Douyin) • 2.4M Likes',
    sampleResult: {
      sourceLanguage: 'zh',
      sourceLanguageName: 'Tiếng Trung (Douyin)',
      isVietnamese: false,
      summary: 'Kịch bản hướng dẫn chăm sóc da trị mụn ẩn 3 bước chuẩn Douyin cực viral.',
      toneAndStyle: 'Chia sẻ kinh nghiệm làm đẹp, tự tin, cuốn hút',
      videoMetadata: {
        url: 'https://v.douyin.com/iJkLmNoP/',
        platform: 'douyin',
        title: 'Douyin Skincare: 3 Bước Trị Mụn Ẩn Cấp Tốc Bằng Salicylic Acid',
        author: '@美妆学姐 (Tiểu Tuyết Skincare)',
        duration: 28,
      },
      segments: [
        {
          id: 'seg_1',
          timestamp: '00:00 - 00:04',
          startSec: 0,
          endSec: 4,
          originalText: '如果你的脸上总是有这种密密麻麻的闭口粉刺，千万别去美容院乱挤！',
          translatedText: 'Nếu mặt bạn đang chi chít mụn ẩn li ti thế này, xin đừng dại mà đi spa nặn bừa bãi!',
          vietnameseTranslation: 'Nếu mặt bạn đang chi chít mụn ẩn li ti thế này, xin đừng dại mà đi spa nặn bừa bãi!',
        },
        {
          id: 'seg_2',
          timestamp: '00:04 - 00:09',
          startSec: 4,
          endSec: 9,
          originalText: '不仅留坑留印，毛孔还会越来越粗大。其实在家只要用好这瓶水杨酸棉片。',
          translatedText: 'Vừa để lại thâm rỗ, lỗ chân lông lại càng to ngoác ra. Thật ra ở nhà chỉ cần dùng đúng hũ bông Salicylic Acid này thôi.',
          vietnameseTranslation: 'Vừa để lại thâm rỗ, lỗ chân lông lại càng to ngoác ra. Thật ra ở nhà chỉ cần dùng đúng hũ bông Salicylic Acid này thôi.',
        },
        {
          id: 'seg_3',
          timestamp: '00:09 - 00:15',
          startSec: 9,
          endSec: 15,
          originalText: '先用凸起面轻轻打圈擦拭T区30秒，溶解深层油脂角质；再用平滑面湿敷在闭口处3分钟。',
          translatedText: 'Đầu tiên dùng mặt vân nổi mát-xa nhẹ vùng chữ T trong 30 giây để hòa tan dầu thừa bít tắc; sau đó đắp mặt phẳng lên chỗ mụn ẩn 3 phút.',
          vietnameseTranslation: 'Đầu tiên dùng mặt vân nổi mát-xa nhẹ vùng chữ T trong 30 giây để hòa tan dầu thừa bít tắc; sau đó đắp mặt phẳng lên chỗ mụn ẩn 3 phút.',
        },
        {
          id: 'seg_4',
          timestamp: '00:15 - 00:21',
          startSec: 15,
          endSec: 21,
          originalText: '坚持一周，你摸摸你的脸蛋，是不是像剥了壳的鸡蛋一样滑嫩透亮？',
          translatedText: 'Kiên trì đúng 1 tuần, bạn tự sờ lên má xem, da có láng mịn căng mọng như trứng gà bóc không?',
          vietnameseTranslation: 'Kiên trì đúng 1 tuần, bạn tự sờ lên má xem, da có láng mịn căng mọng như trứng gà bóc không?',
        },
        {
          id: 'seg_5',
          timestamp: '00:21 - 00:28',
          startSec: 21,
          endSec: 28,
          originalText: '今天左下角品牌方做活动，买一盒送一盒还包邮，赶紧去囤两盒！',
          translatedText: 'Hôm nay nhãn hàng đang trợ giá góc trái màn hình, mua 1 tặng 1 lại còn freeship, các bà ấn nhanh kẻo hết deal!',
          vietnameseTranslation: 'Hôm nay nhãn hàng đang trợ giá góc trái màn hình, mua 1 tặng 1 lại còn freeship, các bà ấn nhanh kẻo hết deal!',
        },
      ],
      fullOriginalScript: '如果你的脸上总是有这种密密麻麻的闭口粉刺，千万别去美容院乱挤！不仅留坑留印，毛孔还会越来越粗大。其实在家只要用好这瓶水杨酸棉片。先用凸起面轻轻打圈擦拭T区30秒，溶解深层油脂角质；再用平滑面湿敷在闭口处3分钟。坚持一周，你摸摸你的脸蛋，是不是像剥了壳的鸡蛋一样滑嫩透亮？今天左下角品牌方做活动，买一盒送一盒还包邮，赶紧去囤两盒！',
      fullTranslatedScript: 'Nếu mặt bạn đang chi chít mụn ẩn li ti thế này, xin đừng dại mà đi spa nặn bừa bãi! Vừa để lại thâm rỗ, lỗ chân lông lại càng to ngoác ra. Thật ra ở nhà chỉ cần dùng đúng hũ bông Salicylic Acid này thôi. Đầu tiên dùng mặt vân nổi mát-xa nhẹ vùng chữ T trong 30 giây để hòa tan dầu thừa bít tắc; sau đó đắp mặt phẳng lên chỗ mụn ẩn 3 phút. Kiên trì đúng 1 tuần, bạn tự sờ lên má xem, da có láng mịn căng mọng như trứng gà bóc không? Hôm nay nhãn hàng đang trợ giá góc trái màn hình, mua 1 tặng 1 lại còn freeship, các bà ấn nhanh kẻo hết deal!',
      fullVietnameseScript: 'Nếu mặt bạn đang chi chít mụn ẩn li ti thế này, xin đừng dại mà đi spa nặn bừa bãi! Vừa để lại thâm rỗ, lỗ chân lông lại càng to ngoác ra. Thật ra ở nhà chỉ cần dùng đúng hũ bông Salicylic Acid này thôi. Đầu tiên dùng mặt vân nổi mát-xa nhẹ vùng chữ T trong 30 giây để hòa tan dầu thừa bít tắc; sau đó đắp mặt phẳng lên chỗ mụn ẩn 3 phút. Kiên trì đúng 1 tuần, bạn tự sờ lên má xem, da có láng mịn căng mọng như trứng gà bóc không? Hôm nay nhãn hàng đang trợ giá góc trái màn hình, mua 1 tặng 1 lại còn freeship, các bà ấn nhanh kẻo hết deal!',
    },
  },
  {
    id: 'tiktok-vn-food-review',
    platform: 'tiktok',
    title: 'Review Phố Ẩm Thực Hồ Thị Kỷ - Ăn Sập 10 Món',
    niche: 'Ẩm Thực / Review (Tiếng Việt)',
    description: 'Clip review ẩm thực Sài Gòn sôi động, giọng nói tự nhiên, năng lượng tích cực.',
    badge: 'Tiếng Việt • 1.8M Views',
    sampleResult: {
      sourceLanguage: 'vi',
      sourceLanguageName: 'Tiếng Việt',
      isVietnamese: true,
      summary: 'Review các món ăn vặt hot hit tại chợ Hồ Thị Kỷ với mức giá sinh viên.',
      toneAndStyle: 'Hào hứng, gần gũi, review chân thật',
      videoMetadata: {
        url: 'https://www.tiktok.com/@sample2',
        platform: 'tiktok',
        title: 'Review Phố Ẩm Thực Hồ Thị Kỷ',
        author: 'Ăn Cùng Quỳnh',
        duration: 35,
      },
      segments: [
        { id: 'seg_1', timestamp: '00:00 - 00:07', startSec: 0, endSec: 7, originalText: 'Hello mọi người! Hôm nay Quỳnh sẽ dắt mọi người đi ăn sập khu phố ẩm thực Hồ Thị Kỷ chỉ với 100 cành nha.', translatedText: 'Hello mọi người! Hôm nay Quỳnh sẽ dắt mọi người đi ăn sập khu phố ẩm thực Hồ Thị Kỷ chỉ với 100 cành nha.', vietnameseTranslation: 'Hello mọi người! Hôm nay Quỳnh sẽ dắt mọi người đi ăn sập khu phố ẩm thực Hồ Thị Kỷ chỉ với 100 cành nha.' },
        { id: 'seg_2', timestamp: '00:07 - 00:15', startSec: 7, endSec: 15, originalText: 'Món đầu tiên chính là thịt xiên nướng phô mai béo ngậy.', translatedText: 'Món đầu tiên chính là thịt xiên nướng phô mai béo ngậy.', vietnameseTranslation: 'Món đầu tiên chính là thịt xiên nướng phô mai béo ngậy.' },
        { id: 'seg_3', timestamp: '00:15 - 00:25', startSec: 15, endSec: 25, originalText: 'Tiếp theo là bánh tráng nướng giòn rụm thơm nức mũi.', translatedText: 'Tiếp theo là bánh tráng nướng giòn rụm thơm nức mũi.', vietnameseTranslation: 'Tiếp theo là bánh tráng nướng giòn rụm thơm nức mũi.' },
        { id: 'seg_4', timestamp: '00:25 - 00:35', startSec: 25, endSec: 35, originalText: 'Cuối cùng tráng miệng bằng ly chè Thái sầu riêng siêu đỉnh!', translatedText: 'Cuối cùng tráng miệng bằng ly chè Thái sầu riêng siêu đỉnh!', vietnameseTranslation: 'Cuối cùng tráng miệng bằng ly chè Thái sầu riêng siêu đỉnh!' },
      ],
      fullOriginalScript: 'Hello mọi người! Hôm nay Quỳnh sẽ dắt mọi người đi ăn sập khu phố ẩm thực Hồ Thị Kỷ chỉ với 100 cành nha. Món đầu tiên chính là thịt xiên nướng phô mai béo ngậy. Tiếp theo là bánh tráng nướng giòn rụm thơm nức mũi. Cuối cùng tráng miệng bằng ly chè Thái sầu riêng siêu đỉnh!',
      fullVietnameseScript: 'Hello mọi người! Hôm nay Quỳnh sẽ dắt mọi người đi ăn sập khu phố ẩm thực Hồ Thị Kỷ chỉ với 100 cành nha. Món đầu tiên chính là thịt xiên nướng phô mai béo ngậy. Tiếp theo là bánh tráng nướng giòn rụm thơm nức mũi. Cuối cùng tráng miệng bằng ly chè Thái sầu riêng siêu đỉnh!',
    },
  },
];

export default function App() {
  const [url, setUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentResult, setCurrentResult] = useState<ExtractionResult | null>(null);
  const [history, setHistory] = useState<ExtractionResult[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isSampleModalOpen, setIsSampleModalOpen] = useState<boolean>(false);
  const [samples, setSamples] = useState<SampleVideoItem[]>(DEFAULT_SAMPLES);
  const [onlyVietnamese, setOnlyVietnamese] = useState<boolean>(false);
  const [errorState, setErrorState] = useState<AppErrorState | null>(null);

  // Active object URL ref for memory cleanup
  const activeStreamUrlRef = useRef<string | null>(null);

  // Revoke active media URL to completely free browser memory and audio/video resources
  const revokeActiveMedia = () => {
    if (activeStreamUrlRef.current) {
      try {
        if (activeStreamUrlRef.current.startsWith('blob:')) {
          URL.revokeObjectURL(activeStreamUrlRef.current);
          console.log('[Media Lifecycle] Revoked previous media blob URL:', activeStreamUrlRef.current);
        }
      } catch (e) {
        console.warn('[Media Lifecycle Error]:', e);
      }
      activeStreamUrlRef.current = null;
    }
  };

  // Clean up object URLs on component unmount
  useEffect(() => {
    return () => {
      revokeActiveMedia();
    };
  }, []);

  // Load history & samples from LocalStorage / API
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

    // Fetch dynamic samples from API
    fetch('/api/samples')
      .then((res) => res.json())
      .then((data) => {
        if (data?.samples && Array.isArray(data.samples) && data.samples.length > 0) {
          setSamples(data.samples);
        }
      })
      .catch((err) => {
        console.warn('Could not load samples from API, using defaults:', err);
      });
  }, []);

  const handleSelectSample = (sample: SampleVideoItem) => {
    if (sample.sampleResult) {
      revokeActiveMedia();
      const resultData = {
        ...sample.sampleResult,
        id: `ext_sample_${Date.now()}`,
        createdAt: Date.now(),
        isFreshExtraction: false,
      } as ExtractionResult;
      setCurrentResult(resultData);
      saveToHistory(resultData);
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#F472B6', '#C084FC', '#818CF8'],
      });
    }
  };

  const saveToHistory = (newResult: ExtractionResult) => {
    setHistory((prev) => {
      // LOẠI BỎ streamUrl khi lưu vào Lịch sử, đánh dấu isFreshExtraction = false để khi truy cập lại không có media player
      const historyItem: ExtractionResult = {
        ...newResult,
        isFreshExtraction: false,
        videoMetadata: {
          ...newResult.videoMetadata,
          streamUrl: undefined,
          downloadUrl: undefined,
        },
      };
      const filtered = prev.filter(
        (item) => item.id !== newResult.id && item.videoMetadata.title !== newResult.videoMetadata.title
      );
      const updated = [historyItem, ...filtered].slice(0, 5);
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

    if (!isValidMediaUrl(url)) {
      setErrorState({
        code: 'INVALID_URL',
        message: 'Vui lòng dán đúng link TikTok hoặc Douyin.',
      });
      return;
    }

    // Clean up previous video/audio before starting a new extraction
    revokeActiveMedia();
    setIsLoading(true);
    setErrorState(null);

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          onlyVietnamese,
        }),
      });

      let data: any;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const textErr = await res.text();
        throw new Error(textErr || `Lỗi máy chủ (${res.status})`);
      }

      if (!res.ok || !data.success) {
        const errObj: any = new Error(data.error || 'Bóc tách video thất bại.');
        errObj.code = data.errorCode;
        throw errObj;
      }

      data.data.onlyVietnamese = onlyVietnamese;
      data.data.isFreshExtraction = true;
      if (data.data.videoMetadata?.streamUrl) {
        activeStreamUrlRef.current = data.data.videoMetadata.streamUrl;
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
      let code = err.code || 'UNKNOWN';
      let message = err.message || 'Đã có lỗi xảy ra khi bóc tách video.';
      if (message.includes('Failed to fetch')) {
        code = 'NETWORK_ERROR';
        message = 'Mất kết nối mạng. Vui lòng thử lại sau.';
      }
      setErrorState({ code, message });
    } finally {
      setIsLoading(false);
    }
  };

  // Upload custom video/audio file with Vercel Blob Client Upload (up to 500MB) & Browser Audio Fallback
  const handleUploadFile = async (file: File) => {
    if (!file) return;

    // Clean up previous video/audio before starting a new upload
    revokeActiveMedia();
    setIsLoading(true);
    setErrorState(null);

    const isAudio = Boolean(
      file.type.startsWith('audio/') ||
      /\.(mp3|wav|m4a|aac|ogg|flac|wma)$/i.test(file.name)
    );

    // Strategy 1: Vercel Blob Client Upload (Direct from Browser to Vercel Blob, up to 500MB, 0 Payload!)
    try {
      console.log('[Vercel Blob] Uploading directly from browser...');
      const targetPathname = file.name || (isAudio ? 'audio.mp3' : 'video.mp4');

      const newBlob = await upload(targetPathname, file, {
        access: 'public',
        handleUploadUrl: '/api/upload-media',
      });

      if (newBlob?.url) {
        console.log('[Vercel Blob] Uploaded successfully, sending blob URL to /api/process-blob...');
        const response = await fetch('/api/process-blob', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            blobUrl: newBlob.url,
            fileName: file.name,
            mimeType: file.type || (isAudio ? 'audio/mp3' : 'video/mp4'),
            title: file.name.replace(/\.[^/.]+$/, ''),
            onlyVietnamese,
          }),
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Lỗi bóc tách tệp.');
        }

        result.data.onlyVietnamese = onlyVietnamese;
        result.data.videoMetadata.mimeType = file.type || (isAudio ? 'audio/mp3' : 'video/mp4');
        result.data.videoMetadata.mediaType = isAudio ? 'audio' : 'video';

        // Keep media ONLY at the fresh extraction moment for verification
        try {
          const objectUrl = URL.createObjectURL(file);
          activeStreamUrlRef.current = objectUrl;
          result.data.videoMetadata.streamUrl = objectUrl;
          result.data.isFreshExtraction = true;
        } catch {}

        setCurrentResult(result.data);
        saveToHistory(result.data);
        confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
        setIsLoading(false);
        return;
      }
    } catch (blobErr: any) {
      console.warn('[Vercel Blob] Blob client upload skipped/failed, using high-speed audio optimization fallback:', blobErr.message || blobErr);
    }

    // Strategy 2: High-Speed Browser Audio Extraction Fallback (WAV/Audio 16kHz Mono: only ~120KB-2MB, 100% Vercel Safe!)
    try {
      console.log('[Audio Optimization] Extracting lightweight audio in browser...');
      const audioFile = await extractAudioFromVideoInBrowser(file);
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
              mimeType: audioFile.type || 'audio/wav',
              title: file.name.replace(/\.[^/.]+$/, ''),
              onlyVietnamese,
            }),
          });

          if (res.status === 413) {
            throw {
              code: 'PAYLOAD_TOO_LARGE',
              message: 'Tệp quá lớn. Vui lòng chọn tệp ngắn hơn hoặc file MP3.',
            };
          }

          let data: any;
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            data = await res.json();
          } else {
            throw {
              code: 'PAYLOAD_TOO_LARGE',
              message: 'Tệp quá lớn. Vui lòng chọn tệp ngắn hơn hoặc file MP3.',
            };
          }

          if (!res.ok || !data.success) {
            const errObj: any = new Error(data.error || 'Lỗi bóc tách tệp.');
            errObj.code = data.errorCode;
            throw errObj;
          }

          data.data.onlyVietnamese = onlyVietnamese;
          data.data.videoMetadata.mimeType = file.type || (isAudio ? 'audio/mp3' : 'video/mp4');
          data.data.videoMetadata.mediaType = isAudio ? 'audio' : 'video';

          // Keep media ONLY at the fresh extraction moment for verification
          try {
            const objectUrl = URL.createObjectURL(file);
            activeStreamUrlRef.current = objectUrl;
            data.data.videoMetadata.streamUrl = objectUrl;
            data.data.isFreshExtraction = true;
          } catch {}

          setCurrentResult(data.data);
          saveToHistory(data.data);
          confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
        } catch (err: any) {
          console.error('Upload extract error:', err);
          let code = err.code || 'UNKNOWN';
          let message = err.message || 'Lỗi xử lý tệp tải lên.';
          if (typeof message === 'string' && (message.includes('413') || message.includes('PAYLOAD_TOO_LARGE'))) {
            code = 'PAYLOAD_TOO_LARGE';
            message = 'Tệp quá lớn. Vui lòng chọn tệp ngắn hơn hoặc file MP3.';
          } else if (message.includes('Failed to fetch')) {
            code = 'NETWORK_ERROR';
            message = 'Mất kết nối mạng. Vui lòng thử lại sau.';
          }
          setErrorState({ code, message });
        } finally {
          setIsLoading(false);
        }
      };

      reader.onerror = () => {
        setErrorState({ code: 'FILE_READ_ERROR', message: 'Không thể đọc tệp từ thiết bị của bạn.' });
        setIsLoading(false);
      };

      reader.readAsDataURL(audioFile);
    } catch (compressErr: any) {
      console.error('Audio compression error:', compressErr);
      setErrorState({ code: 'COMPRESS_ERROR', message: 'Không thể xử lý âm thanh tệp này. Vui lòng thử tệp khác.' });
      setIsLoading(false);
    }
  };

  return (
    <div id="main-app-container" className="min-h-screen bg-[#FFF9FB] text-slate-700 flex flex-col font-['Quicksand',sans-serif]">
      {/* Header */}
      <Header
        historyCount={history.length}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenSampleModal={() => setIsSampleModalOpen(true)}
        onHomeClick={() => {
          setCurrentResult(null);
          setUrl('');
        }}
      />

      {/* Main Container */}
      <main id="app-body" className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        
        {/* Enhanced Error & Video Status Alert Box */}
        {errorState && (
          <div
            id="error-status-alert-box"
            className={`p-3.5 sm:p-4 rounded-2xl border text-xs sm:text-sm flex items-center justify-between gap-3 shadow-xs animate-in fade-in transition-all ${
              errorState.code === 'VIDEO_UNAVAILABLE'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : errorState.code === 'WAF_CHALLENGE_BLOCKED'
                ? 'bg-purple-50 border-purple-200 text-purple-950'
                : errorState.code === 'RATE_LIMIT'
                ? 'bg-blue-50 border-blue-200 text-blue-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {errorState.code === 'VIDEO_UNAVAILABLE' ? (
                <AlertOctagon className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 shrink-0" />
              ) : errorState.code === 'WAF_CHALLENGE_BLOCKED' ? (
                <ShieldAlert className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 shrink-0" />
              ) : errorState.code === 'RATE_LIMIT' ? (
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-rose-500 shrink-0" />
              )}
              <span className="font-bold text-xs sm:text-sm leading-snug truncate sm:whitespace-normal">
                {errorState.message}
              </span>
            </div>
            <button
              onClick={() => setErrorState(null)}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 underline shrink-0 cursor-pointer px-1 py-0.5"
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
              onOpenSampleModal={() => setIsSampleModalOpen(true)}
              onlyVietnamese={onlyVietnamese}
              setOnlyVietnamese={setOnlyVietnamese}
            />
          </div>
        ) : (
          /* Result View */
          <ResultViewer
            result={currentResult}
            onReset={() => {
              // Immediately release video/audio when user returns to home
              revokeActiveMedia();
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
        onSelectHistoryItem={(item) => {
          // Immediately revoke active media and strip streamUrl so historical review doesn't show black screen
          revokeActiveMedia();
          setCurrentResult({
            ...item,
            isFreshExtraction: false,
            videoMetadata: {
              ...item.videoMetadata,
              streamUrl: undefined,
              downloadUrl: undefined,
            },
          });
        }}
        onClearHistory={handleClearHistory}
        onDeleteItem={handleDeleteHistoryItem}
      />

      {/* Sample Modal */}
      <SampleModal
        isOpen={isSampleModalOpen}
        onClose={() => setIsSampleModalOpen(false)}
        samples={samples}
        onSelectSample={handleSelectSample}
      />
    </div>
  );
}
