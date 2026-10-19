import { GoogleGenAI, Type } from '@google/genai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import vm from 'node:vm';

export const config = {
  maxDuration: 60,
};

const CANDIDATE_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];

export function safeParseGeminiJson(rawText: string): any {
  if (!rawText || !rawText.trim()) {
    throw new Error('Gemini trả về phản hồi rỗng.');
  }

  let text = rawText.trim();

  // Strip markdown code fences if present (```json ... ```)
  if (text.startsWith('```json')) {
    text = text.substring(7);
  } else if (text.startsWith('```')) {
    text = text.substring(3);
  }
  if (text.endsWith('```')) {
    text = text.substring(0, text.length - 3);
  }
  text = text.trim();

  // 1. Try standard JSON.parse first
  try {
    return JSON.parse(text);
  } catch (err: any) {
    console.warn(`[JSON Repair] Initial parse failed (${err.message}). Attempting automated structure repair...`);
  }

  // 2. Repair truncated strings and unclosed brackets/braces
  let repaired = text;

  // Check if string is unclosed
  let inString = false;
  let isEscaped = false;
  for (let i = 0; i < repaired.length; i++) {
    const ch = repaired[i];
    if (ch === '\\' && inString) {
      isEscaped = !isEscaped;
    } else if (ch === '"' && !isEscaped) {
      inString = !inString;
    } else {
      isEscaped = false;
    }
  }

  if (inString) {
    repaired += '"';
  }

  // Check and close open brackets and braces
  const openStack: string[] = [];
  inString = false;
  isEscaped = false;

  for (let i = 0; i < repaired.length; i++) {
    const ch = repaired[i];
    if (ch === '\\' && inString) {
      isEscaped = !isEscaped;
    } else if (ch === '"' && !isEscaped) {
      inString = !inString;
    } else if (!inString) {
      if (ch === '{' || ch === '[') {
        openStack.push(ch);
      } else if (ch === '}' && openStack[openStack.length - 1] === '{') {
        openStack.pop();
      } else if (ch === ']' && openStack[openStack.length - 1] === '[') {
        openStack.pop();
      }
    } else {
      isEscaped = false;
    }
  }

  while (openStack.length > 0) {
    const last = openStack.pop();
    if (last === '{') repaired += '}';
    else if (last === '[') repaired += ']';
  }

  try {
    const parsed = JSON.parse(repaired);
    console.log('[JSON Repair] Successfully repaired truncated JSON structure!');
    return parsed;
  } catch (repairErr: any) {
    console.warn(`[JSON Repair] Structural repair failed (${repairErr.message}). Extracting valid segments via regex...`);
  }

  // 3. Fallback: Extract every complete segment object via Regex
  const segments: any[] = [];
  const segRegex = /\{\s*"(?:id|timestamp)"\s*:\s*"[^"]*"[^{}]*?"originalText"\s*:\s*"[^"]*"[^{}]*?\}/g;
  let match;
  while ((match = segRegex.exec(text)) !== null) {
    try {
      segments.push(JSON.parse(match[0]));
    } catch {}
  }

  const isViMatch = text.match(/"isVietnamese"\s*:\s*(true|false)/i);
  const isVietnamese = isViMatch ? isViMatch[1].toLowerCase() === 'true' : false;

  const summaryMatch = text.match(/"summary"\s*:\s*"([^"]*)"/);
  const summary = summaryMatch ? summaryMatch[1] : undefined;

  const toneMatch = text.match(/"toneAndStyle"\s*:\s*"([^"]*)"/);
  const toneAndStyle = toneMatch ? toneMatch[1] : undefined;

  if (segments.length > 0) {
    console.log(`[JSON Repair] Recovered ${segments.length} valid segments via regex recovery!`);
    return {
      isVietnamese,
      sourceLanguageName: isVietnamese ? 'Tiếng Việt' : 'Tiếng Trung (Douyin)',
      summary,
      toneAndStyle,
      segments,
      fullOriginalScript: segments.map((s) => s.originalText || '').join(' '),
      fullTranslatedScript: isVietnamese
        ? undefined
        : segments.map((s) => s.translatedText || s.originalText || '').join(' '),
    };
  }

  throw new Error(`Không thể giải mã phản hồi JSON từ AI (Phản hồi bị ngắt quãng).`);
}

const SYSTEM_INSTRUCTION = `Bạn là chuyên gia bóc tách kịch bản audio/video ngắn hàng đầu (TikTok & Douyin).
Nhiệm vụ trọng tâm:
1. Nghe và nhận diện chính xác ngôn ngữ của video (Tiếng Việt, Tiếng Trung, Tiếng Anh,...).
2. Bóc tách nguyên văn 100% từng câu thoại trong video thành văn bản (Script verbatim):
   - CHÚ Ý ĐẶC BIỆT: Video có thể chứa giọng lồng tiếng, giọng đọc nhân tạo AI (Text-to-Speech), lời dẫn thuyết minh, âm thanh hội thoại xen kẽ nhạc nền hoặc chữ phụ đề chạy trên màn hình. Bạn hãy lắng nghe kỹ tất cả các câu thoại/giọng đọc này và kết hợp quan sát phụ đề trên video để trích xuất đầy đủ, tuyệt đối không được bỏ sót bất kỳ câu nói hay lời thuyết minh nào.
   - Nếu là video Tiếng Việt: Bóc tách chính xác từng câu tiếng Việt kèm timestamp.
   - Nếu là video Tiếng Trung (hoặc tiếng nước ngoài): Bóc tách nguyên văn tiếng Trung gốc (chữ Hán), VÀ đồng thời dịch câu đó sang Tiếng Việt tự nhiên, chuẩn văn phong hội thoại / bắt trend mượt mà.
   - Nếu là video hoàn toàn chỉ có nhạc không lời không có bất kỳ giọng nói nào: Tạo phân đoạn mô tả ngắn gọn giai điệu nhạc nền [mm:ss].
3. Đánh dấu mốc thời gian (Timestamp) chính xác cho từng phân đoạn dạng [mm:ss - mm:ss], kèm thời gian giây bắt đầu (startSec) và kết thúc (endSec).
4. Cung cấp toàn bộ kịch bản liền mạch (Full text).`;

const EXTRACTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    sourceLanguage: {
      type: Type.STRING,
      description: 'Mã ngôn ngữ nguồn chính (vi, zh, en, ...)',
    },
    sourceLanguageName: {
      type: Type.STRING,
      description: 'Tên ngôn ngữ nguồn (Tiếng Việt, Tiếng Trung, Tiếng Anh, ...)',
    },
    isVietnamese: {
      type: Type.BOOLEAN,
      description: 'true nếu ngôn ngữ gốc là Tiếng Việt, false nếu là Tiếng Trung / ngoại ngữ khác',
    },
    fullOriginalScript: {
      type: Type.STRING,
      description: 'Toàn bộ lời thoại nguyên văn không ngắt quãng',
    },
    fullVietnameseScript: {
      type: Type.STRING,
      description: 'Toàn bộ bản dịch Tiếng Việt hoàn chỉnh (hoặc kịch bản tiếng Việt nếu gốc là tiếng Việt)',
    },
    summary: {
      type: Type.STRING,
      description: 'Tóm tắt nội dung chính và thông điệp của video trong 1-2 câu',
    },
    segments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          timestamp: {
            type: Type.STRING,
            description: 'Định dạng mm:ss hoặc mm:ss - mm:ss',
          },
          startSec: {
            type: Type.NUMBER,
            description: 'Giây bắt đầu',
          },
          endSec: {
            type: Type.NUMBER,
            description: 'Giây kết thúc',
          },
          originalText: {
            type: Type.STRING,
            description: 'Câu thoại nguyên văn ngôn ngữ gốc (chữ Hán nếu là Douyin)',
          },
          vietnameseTranslation: {
            type: Type.STRING,
            description: 'Bản dịch Tiếng Việt tự nhiên (bỏ trống hoặc giống originalText nếu là tiếng Việt)',
          },
          speaker: {
            type: Type.STRING,
            description: 'Người nói (Nhân vật A, Người dẫn, Lời dẫn, Nhạc nền...)',
          },
        },
        required: ['timestamp', 'startSec', 'endSec', 'originalText'],
      },
    },
  },
  required: [
    'sourceLanguage',
    'sourceLanguageName',
    'isVietnamese',
    'fullOriginalScript',
    'fullVietnameseScript',
    'summary',
    'segments',
  ],
};

export type ExtractionErrorCode =
  | 'VIDEO_UNAVAILABLE'
  | 'WAF_CHALLENGE_BLOCKED'
  | 'RATE_LIMIT'
  | 'INVALID_URL'
  | 'DOWNLOAD_STREAM_FAILED'
  | 'AI_ERROR';

export class VideoExtractionError extends Error {
  code: ExtractionErrorCode;
  constructor(code: ExtractionErrorCode, message: string) {
    super(message);
    this.name = 'VideoExtractionError';
    this.code = code;
  }
}

function extractCleanUrl(text: string): string {
  const urlMatch = text.match(/https?:\/\/[^\s"'<>]+/);
  return urlMatch ? urlMatch[0] : text.trim();
}

function identifyPlatform(url: string): 'tiktok' | 'douyin' | 'sample' {
  const lower = url.toLowerCase();
  if (lower.includes('douyin.com') || lower.includes('iesdouyin.com')) {
    return 'douyin';
  }
  if (lower.includes('tiktok.com')) {
    return 'tiktok';
  }
  return 'sample';
}

/**
 * Resolves short links (e.g. v.douyin.com, vt.tiktok.com) and validates whether the video is still active.
 * If Douyin/TikTok redirects to homepage (root), the video is deleted, private, or expired!
 */
async function resolveAndValidateUrl(rawUrl: string): Promise<{
  finalUrl: string;
  platform: 'tiktok' | 'douyin' | 'sample';
  awemeId?: string;
}> {
  const cleanUrl = extractCleanUrl(rawUrl);
  const platform = identifyPlatform(cleanUrl);

  const isShortLink =
    cleanUrl.includes('v.douyin.com') ||
    cleanUrl.includes('vt.tiktok.com') ||
    cleanUrl.includes('vm.tiktok.com');

  let finalUrl = cleanUrl;

  try {
    const res = await fetch(cleanUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
      },
    });

    if (res.url) {
      finalUrl = res.url;
    }
  } catch (err: any) {
    console.warn('[URL Resolver Serverless] Network warning:', err.message);
  }

  // Check if destination is redirected back to root homepage
  const isDouyinRoot = /^https?:\/\/(www\.)?douyin\.com\/?(\?.*)?$/i.test(finalUrl);
  const isTikTokRoot = /^https?:\/\/(www\.)?tiktok\.com\/?(\?.*)?$/i.test(finalUrl);

  if ((isShortLink && (isDouyinRoot || isTikTokRoot)) || (!isShortLink && (isDouyinRoot || isTikTokRoot))) {
    throw new VideoExtractionError(
      'VIDEO_UNAVAILABLE',
      'Video không khả dụng (Video này có thể đã bị tác giả xóa, cài đặt chế độ riêng tư hoặc đường link chia sẻ đã hết hạn).'
    );
  }

  const awemeMatch =
    finalUrl.match(/video\/(\d+)/i) ||
    finalUrl.match(/modal_id=(\d+)/i) ||
    finalUrl.match(/item_ids=(\d+)/i);
  const awemeId = awemeMatch ? awemeMatch[1] : undefined;

  return { finalUrl, platform, awemeId };
}

async function downloadViaDouyinRenderData(
  targetUrl: string,
  fileId: string,
  tempDir: string,
  awemeId?: string
) {
  const urlsToTry = [targetUrl];
  if (awemeId) {
    const canonicalModal = `https://www.douyin.com/jingxuan?modal_id=${awemeId}`;
    const canonicalVideo = `https://www.douyin.com/video/${awemeId}`;
    if (!urlsToTry.includes(canonicalModal)) urlsToTry.push(canonicalModal);
    if (!urlsToTry.includes(canonicalVideo)) urlsToTry.push(canonicalVideo);
  }

  const ua =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

  for (const pageUrl of urlsToTry) {
    try {
      const res1 = await fetch(pageUrl, {
        headers: {
          'User-Agent': ua,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9',
        },
      });
      const html1 = await res1.text();
      const cookies1 = res1.headers.getSetCookie ? res1.headers.getSetCookie() : [];
      const nonceMatch = cookies1.join('; ').match(/__ac_nonce=([^;]+)/);
      if (!nonceMatch) continue;
      const nonce = nonceMatch[1];

      const scripts = html1.match(/<script>([\s\S]*?)<\/script>/g) || [];
      if (scripts.length === 0) continue;
      const s0 = scripts[0].replace(/^<script>/, '').replace(/<\/script>$/, '');

      const sandbox = {
        window: {},
        navigator: {
          userAgent: ua,
          appVersion: '5.0 (Windows NT 10.0; Win64; x64)',
          platform: 'Win32',
          plugins: [],
        },
        document: {
          referrer: 'https://www.douyin.com/',
          cookie: '__ac_nonce=' + nonce,
          getElementsByTagName: () => [],
          createElement: () => ({ setAttribute: () => {} }),
        },
        location: { protocol: 'https:', href: pageUrl, reload: () => {} },
        sessionStorage: { setItem: () => {}, getItem: () => null },
        localStorage: { setItem: () => {}, getItem: () => null },
        performance: { timing: { navigationStart: Date.now() } },
        console: { log: () => {}, warn: () => {}, error: () => {} },
        setTimeout: setTimeout,
      };
      sandbox.window = sandbox;
      (sandbox as any).global = sandbox;
      (sandbox as any).self = sandbox;

      const ctx = vm.createContext(sandbox);
      vm.runInContext(s0, ctx);

      if (!(sandbox as any).byted_acrawler) continue;

      (sandbox as any).byted_acrawler.init({ aid: 99999999, dfp: 0 });
      const signature = (sandbox as any).byted_acrawler.sign('', nonce);
      if (!signature) continue;

      const cookieHeader = `__ac_nonce=${nonce}; __ac_signature=${signature};`;
      const pageRes = await fetch(pageUrl, {
        headers: {
          'User-Agent': ua,
          'Cookie': cookieHeader,
          'Referer': 'https://www.douyin.com/',
        },
      });
      const pageHtml = await pageRes.text();
      const renderDataMatch = pageHtml.match(/<script id=\"RENDER_DATA\"[^>]*>(.*?)<\/script>/);
      if (!renderDataMatch) continue;

      const rawData = decodeURIComponent(renderDataMatch[1]);
      const parsed = JSON.parse(rawData);

      const modalMatch = pageUrl.match(/modal_id=(\d+)/) || pageUrl.match(/video\/(\d+)/);
      const targetAwemeId = awemeId || (modalMatch ? modalMatch[1] : '');

      function findAweme(obj: any): any {
        if (!obj || typeof obj !== 'object') return null;
        if (targetAwemeId && (obj.awemeId === targetAwemeId || obj.aweme_id === targetAwemeId)) return obj;
        if (obj.video && (obj.desc || obj.itemTitle)) return obj;
        for (const k of Object.keys(obj)) {
          const found = findAweme(obj[k]);
          if (found) return found;
        }
        return null;
      }

      const item = findAweme(parsed);
      if (item && item.video) {
        const title = item.desc || item.itemTitle || 'Douyin Video';
        const author = item.authorInfo?.nickname || item.author?.nickname || 'Douyin Creator';
        const duration = Math.round((item.video.duration || 30000) / 1000);
        let videoCoverUrl = item.video?.cover?.url_list?.[0] || item.video?.origin_cover?.url_list?.[0];
        if (videoCoverUrl && videoCoverUrl.startsWith('//')) {
          videoCoverUrl = 'https:' + videoCoverUrl;
        }

        let videoStreamUrl = item.video.playAddr?.[0]?.src || item.video.play_addr?.url_list?.[0];
        if (!videoStreamUrl && Array.isArray(item.video.playApiList)) videoStreamUrl = item.video.playApiList[0];

        if (videoStreamUrl) {
          if (videoStreamUrl.startsWith('//')) {
            videoStreamUrl = 'https:' + videoStreamUrl;
          }

          const targetFilePath = path.join(tempDir, `${fileId}.mp4`);
          const streamRes = await fetch(videoStreamUrl, {
            headers: { 'User-Agent': ua, 'Referer': 'https://www.douyin.com/' },
          });
          if (streamRes.ok) {
            const buffer = Buffer.from(await streamRes.arrayBuffer());
            if (buffer.length > 5000) {
              fs.writeFileSync(targetFilePath, buffer);
              const proxyStreamUrl = `/api/proxy-media?url=${encodeURIComponent(videoStreamUrl)}`;
              return {
                filePath: targetFilePath,
                mimeType: 'video/mp4',
                title,
                author,
                duration,
                platform: 'douyin' as const,
                streamUrl: proxyStreamUrl,
                downloadUrl: proxyStreamUrl,
                coverImage: videoCoverUrl,
              };
            }
          }
        }
      }
    } catch (e) {
      console.warn(`[Douyin Acrawler Serverless Error on ${pageUrl}]:`, e);
    }
  }

  return null;
}

async function downloadViaTikWm(
  cleanUrl: string,
  fileId: string,
  platform: 'tiktok' | 'douyin' | 'sample',
  tempDir: string,
  awemeId?: string
) {
  const urlsToTry = [cleanUrl];
  if (platform === 'douyin' && awemeId) {
    const canonical = `https://www.douyin.com/video/${awemeId}`;
    if (!urlsToTry.includes(canonical)) urlsToTry.push(canonical);
  }

  for (const urlTarget of urlsToTry) {
    try {
      const form = new URLSearchParams();
      form.append('url', urlTarget);
      form.append('hd', '1');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const apiRes = await fetch('https://www.tikwm.com/api/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
        body: form.toString(),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (apiRes.ok) {
        const data = await apiRes.json();
        if (data.code === 0 && data.data) {
          const videoData = data.data;
          const title = videoData.title || (platform === 'douyin' ? 'Douyin Video' : 'TikTok Video');
          const author = videoData.author?.nickname || videoData.author?.unique_id || 'Creator';
          const duration = videoData.duration || 30;

          const mediaStreamUrl = videoData.play || videoData.wmplay || videoData.hdplay || videoData.music;
          const directPlayUrl = videoData.play || videoData.wmplay || videoData.hdplay;
          let coverUrl = videoData.cover || videoData.origin_cover;
          if (coverUrl && coverUrl.startsWith('//')) {
            coverUrl = 'https:' + coverUrl;
          }

          let fullPlayUrl = directPlayUrl || mediaStreamUrl;
          if (fullPlayUrl && fullPlayUrl.startsWith('//')) {
            fullPlayUrl = 'https:' + fullPlayUrl;
          }

          if (mediaStreamUrl) {
            const isVideo = Boolean(videoData.play || videoData.wmplay || videoData.hdplay || (!videoData.music && mediaStreamUrl));
            const ext = isVideo ? 'mp4' : 'mp3';
            const mimeType = isVideo ? 'video/mp4' : 'audio/mp3';
            const targetFilePath = path.join(tempDir, `${fileId}.${ext}`);

            const streamRes = await fetch(mediaStreamUrl, {
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                Referer: platform === 'douyin' ? 'https://www.douyin.com/' : 'https://www.tiktok.com/',
              },
            });

            if (streamRes.ok) {
              const buffer = Buffer.from(await streamRes.arrayBuffer());
              if (buffer.length > 1000) {
                fs.writeFileSync(targetFilePath, buffer);
                const proxyStreamUrl = fullPlayUrl ? `/api/proxy-media?url=${encodeURIComponent(fullPlayUrl)}` : undefined;
                return {
                  filePath: targetFilePath,
                  mimeType,
                  title,
                  author,
                  duration,
                  platform,
                  streamUrl: proxyStreamUrl || fullPlayUrl,
                  downloadUrl: proxyStreamUrl || fullPlayUrl,
                  coverImage: coverUrl,
                };
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[Download] TikWM attempt error on ${urlTarget}:`, err);
    }
  }

  return null;
}

async function downloadMedia(rawUrl: string, fileId: string) {
  const tempDir = path.join(os.tmpdir(), 'tiktok_douyin_media');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const { finalUrl, platform, awemeId } = await resolveAndValidateUrl(rawUrl);

  // Strategy for Douyin: Try ByteDance Acrawler & RENDER_DATA Direct Video Extractor first
  if (platform === 'douyin') {
    const douyinRender = await downloadViaDouyinRenderData(finalUrl, fileId, tempDir, awemeId);
    if (douyinRender) return douyinRender;

    const tikWmRes = await downloadViaTikWm(finalUrl, fileId, platform, tempDir, awemeId);
    if (tikWmRes) return tikWmRes;

    // Strategy 3: Douyin Direct API
    try {
      const canonical = awemeId ? `https://www.douyin.com/video/${awemeId}` : finalUrl;
      const redirectRes = await fetch(canonical, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15',
        },
        redirect: 'follow',
      });
      const resolvedUrl = redirectRes.url;
      const awemeIdMatch = resolvedUrl.match(/video\/(\d+)/) || resolvedUrl.match(/modal_id=(\d+)/);
      if (awemeIdMatch && awemeIdMatch[1]) {
        const itemId = awemeIdMatch[1];
        const infoRes = await fetch(`https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids=${itemId}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X)' },
        });
        if (infoRes.ok) {
          const infoData = await infoRes.json();
          const item = infoData.item_list?.[0];
          if (item) {
            const title = item.desc || 'Douyin Video';
            const author = item.author?.nickname || 'Douyin Creator';
            const duration = Math.round((item.duration || 30000) / 1000);
            const videoUrl = item.video?.play_addr?.url_list?.[0]?.replace('playwm', 'play');
            const audioUrl = item.music?.play_url?.uri || item.music?.play_url?.url_list?.[0];
            const targetUrl = videoUrl || audioUrl;
            let videoCoverUrl = item.video?.cover?.url_list?.[0];
            if (videoCoverUrl && videoCoverUrl.startsWith('//')) {
              videoCoverUrl = 'https:' + videoCoverUrl;
            }
            let fullTargetUrl = targetUrl;
            if (fullTargetUrl && fullTargetUrl.startsWith('//')) {
              fullTargetUrl = 'https:' + fullTargetUrl;
            }

            if (targetUrl) {
              const isVideo = Boolean(videoUrl);
              const ext = isVideo ? 'mp4' : 'mp3';
              const mimeType = isVideo ? 'video/mp4' : 'audio/mp3';
              const targetFilePath = path.join(tempDir, `${fileId}.${ext}`);

              const mediaRes = await fetch(targetUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X)',
                  Referer: 'https://www.douyin.com/',
                },
              });

              if (mediaRes.ok) {
                const buffer = Buffer.from(await mediaRes.arrayBuffer());
                if (buffer.length > 1000) {
                  fs.writeFileSync(targetFilePath, buffer);
                  const proxyStreamUrl = `/api/proxy-media?url=${encodeURIComponent(fullTargetUrl)}`;
                  return {
                    filePath: targetFilePath,
                    mimeType,
                    title,
                    author,
                    duration,
                    platform,
                    streamUrl: proxyStreamUrl,
                    downloadUrl: proxyStreamUrl,
                    coverImage: videoCoverUrl,
                  };
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('[Download] Douyin Direct attempt error:', err);
    }

    throw new VideoExtractionError(
      'WAF_CHALLENGE_BLOCKED',
      'Không thể trích xuất video Douyin (Tường lửa chống bot hoặc cơ chế bảo mật của Douyin hạn chế máy chủ). ' +
      'Bạn hãy thử mở video trên điện thoại, bấm Lưu Video (Save Video) rồi dùng tab "Tải file MP4/MP3" trên giao diện để AI bóc tách ngay!'
    );
  }

  // Strategy for TikTok: TikWM API
  const tikWmRes = await downloadViaTikWm(finalUrl, fileId, platform, tempDir, awemeId);
  if (tikWmRes) return tikWmRes;

  throw new VideoExtractionError(
    'WAF_CHALLENGE_BLOCKED',
    'Không thể tải stream video từ TikTok (Do hạn chế kết nối từ TikTok hoặc video bị giới hạn vùng). ' +
    'Bạn hãy thử mở video trên điện thoại, bấm Lưu Video (Save Video) rồi dùng tab "Tải file MP4/MP3" trên giao diện để AI bóc tách ngay!'
  );
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-gemini-api-key, X-Gemini-Api-Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  let localFilePath: string | undefined;

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

    const { url, sampleId } = body || {};

    if (sampleId) {
      return res.status(200).json({
        success: true,
        data: {
          id: `sample_${Date.now()}`,
          sourceLanguage: 'zh',
          sourceLanguageName: 'Tiếng Trung (Douyin)',
          isVietnamese: false,
          summary: 'Kịch bản hướng dẫn chăm sóc da trị mụn ẩn 3 bước chuẩn Douyin cực viral.',
          toneAndStyle: 'Chia sẻ kinh nghiệm làm đẹp, tự tin, cuốn hút',
          fullOriginalScript: '今天教大家一个三步去闭口的方法，真的超级有用！第一步先用温水洗脸打开毛孔。第二步厚涂水杨酸棉片湿敷三分钟。第三步一定要用修护精华锁住水分。坚持一周，皮肤细腻透亮！',
          fullVietnameseScript: 'Hôm nay mình sẽ chỉ cho mọi người phương pháp 3 bước trị mụn ẩn cực kỳ hiệu quả luôn nha! Bước 1: Rửa mặt bằng nước ấm để giãn nở lỗ chân lông. Bước 2: Dùng bông tẩy trang thấm Salicylic Acid đắp nhẹ trong 3 phút. Bước 3: Nhất định phải thoa serum phục hồi để khóa ẩm. Kiên trì 1 tuần, da sẽ mịn màng và căng bóng rõ rệt!',
          fullTranslatedScript: 'Hôm nay mình sẽ chỉ cho mọi người phương pháp 3 bước trị mụn ẩn cực kỳ hiệu quả luôn nha! Bước 1: Rửa mặt bằng nước ấm để giãn nở lỗ chân lông. Bước 2: Dùng bông tẩy trang thấm Salicylic Acid đắp nhẹ trong 3 phút. Bước 3: Nhất định phải thoa serum phục hồi để khóa ẩm. Kiên trì 1 tuần, da sẽ mịn màng và căng bóng rõ rệt!',
          segments: [
            { id: 'seg_1', timestamp: '00:00 - 00:05', startSec: 0, endSec: 5, originalText: '今天教大家一个三步去闭口的方法，真的超级有用！', vietnameseTranslation: 'Hôm nay mình sẽ chỉ cho mọi người phương pháp 3 bước trị mụn ẩn cực kỳ hiệu quả luôn nha!', translatedText: 'Hôm nay mình sẽ chỉ cho mọi người phương pháp 3 bước trị mụn ẩn cực kỳ hiệu quả luôn nha!', speaker: 'Người hướng dẫn' },
            { id: 'seg_2', timestamp: '00:05 - 00:10', startSec: 5, endSec: 10, originalText: '第一步先用温水洗脸打开毛孔。', vietnameseTranslation: 'Bước 1: Rửa mặt bằng nước ấm để giãn nở lỗ chân lông.', translatedText: 'Bước 1: Rửa mặt bằng nước ấm để giãn nở lỗ chân lông.', speaker: 'Người hướng dẫn' },
            { id: 'seg_3', timestamp: '00:10 - 00:16', startSec: 10, endSec: 16, originalText: '第二步厚涂水杨酸棉片湿敷三分钟。', vietnameseTranslation: 'Bước 2: Dùng bông tẩy trang thấm Salicylic Acid đắp nhẹ trong 3 phút.', translatedText: 'Bước 2: Dùng bông tẩy trang thấm Salicylic Acid đắp nhẹ trong 3 phút.', speaker: 'Người hướng dẫn' },
            { id: 'seg_4', timestamp: '00:16 - 00:23', startSec: 16, endSec: 23, originalText: '第三步一定要用修护精华锁住水分。', vietnameseTranslation: 'Bước 3: Nhất định phải thoa serum phục hồi để khóa ẩm.', translatedText: 'Bước 3: Nhất định phải thoa serum phục hồi để khóa ẩm.', speaker: 'Người hướng dẫn' },
            { id: 'seg_5', timestamp: '00:23 - 00:28', startSec: 23, endSec: 28, originalText: '坚持一周，皮肤细腻透亮！', vietnameseTranslation: 'Kiên trì 1 tuần, da sẽ mịn màng và căng bóng rõ rệt!', translatedText: 'Kiên trì 1 tuần, da sẽ mịn màng và căng bóng rõ rệt!', speaker: 'Người hướng dẫn' },
          ],
          videoMetadata: {
            url: 'https://v.douyin.com/sample',
            platform: 'douyin',
            title: '3 Bước Trị Mụn Ẩn Douyin Skincare',
            author: 'Douyin Beauty',
            duration: 28,
          },
          createdAt: Date.now(),
        },
      });
    }

    if (!url || typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp đường link video TikTok hoặc Douyin hợp lệ.',
      });
    }

    const trimmedUrl = url.trim();
    const hasHttp = /^https?:\/\//i.test(trimmedUrl);
    const isSupported = /tiktok\.com|douyin\.com|iesdouyin\.com/i.test(trimmedUrl);

    if (!hasHttp || !isSupported) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng nhập đúng đường link video từ TikTok hoặc Douyin (bắt đầu bằng https://...). Hệ thống không hỗ trợ tìm kiếm theo từ khóa.',
      });
    }

    const fileId = `media_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    console.log(`[API /api/extract] Downloading: ${trimmedUrl}`);
    const media = await downloadMedia(trimmedUrl, fileId);
    localFilePath = media.filePath;

    // Gemini Processing
    const apiKey =
      (req.headers['x-gemini-api-key'] as string) ||
      (req.headers['X-Gemini-Api-Key'] as string) ||
      body.customApiKey ||
      process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'Chưa cấu hình GEMINI_API_KEY. Vui lòng bấm nút [API Key] trên thanh menu để nhập API Key miễn phí từ Google AI Studio!',
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    // Prepare mediaPart for Gemini generateContent
    const fileStats = fs.statSync(localFilePath);
    const fileSizeInMB = fileStats.size / (1024 * 1024);
    let mediaPart: any;
    let uploadedFileRef: any = null;

    if (fileSizeInMB <= 20) {
      console.log(`[API /api/extract] Using inlineData for ${fileSizeInMB.toFixed(2)} MB media...`);
      const buffer = fs.readFileSync(localFilePath);
      mediaPart = {
        inlineData: {
          mimeType: media.mimeType || 'audio/mp3',
          data: buffer.toString('base64'),
        },
      };
    } else {
      console.log(`[API /api/extract] Uploading file to Gemini File API (${fileSizeInMB.toFixed(2)} MB)...`);
      uploadedFileRef = await ai.files.upload({
        file: localFilePath,
        mimeType: media.mimeType,
      } as any);

      mediaPart = {
        fileData: {
          fileUri: uploadedFileRef.uri,
          mimeType: uploadedFileRef.mimeType || media.mimeType,
        },
      };
    }

    let activeModel = CANDIDATE_MODELS[0];
    let geminiResponse: any = null;
    let lastError: any = null;

    for (const modelName of CANDIDATE_MODELS) {
      try {
        console.log(`[API /api/extract] Generating content with model: ${modelName}...`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            mediaPart,
            {
              text: `Hãy bóc tách toàn bộ lời thoại âm thanh từ file phương tiện này theo định dạng JSON có cấu trúc. Tiêu đề video: "${media.title}". Nền tảng: ${media.platform}.`,
            },
          ],
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: EXTRACTION_SCHEMA,
            temperature: 0.2,
          },
        });

        if (response.text) {
          geminiResponse = response;
          activeModel = modelName;
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[API /api/extract] Model ${modelName} failed:`, err.message);
      }
    }

    // Delete Gemini uploaded cloud file if any
    try {
      if (uploadedFileRef?.name) {
        ai.files.delete({ name: uploadedFileRef.name }).catch(() => {});
      }
    } catch {}

    if (!geminiResponse || !geminiResponse.text) {
      throw lastError || new Error('Không nhận được phản hồi từ mô hình AI.');
    }

    const parsedData = safeParseGeminiJson(geminiResponse.text);

    const isVietnamese = parsedData.isVietnamese ?? (parsedData.sourceLanguage === 'vi' || parsedData.sourceLanguageName?.toLowerCase().includes('việt'));
    const rawSegments = parsedData.segments || [];
    const segments = rawSegments.map((seg: any, idx: number) => {
      const translation = seg.translatedText || seg.vietnameseTranslation || (isVietnamese ? seg.originalText : undefined);
      return {
        id: seg.id || `seg_${idx + 1}`,
        timestamp: seg.timestamp || `[00:${String(idx * 5).padStart(2, '0')} - 00:${String((idx + 1) * 5).padStart(2, '0')}]`,
        startSec: typeof seg.startSec === 'number' ? seg.startSec : idx * 5,
        endSec: typeof seg.endSec === 'number' ? seg.endSec : (idx + 1) * 5,
        originalText: seg.originalText || '',
        translatedText: translation,
        vietnameseTranslation: translation,
        speaker: seg.speaker,
      };
    });
    const fullTranslation = parsedData.fullTranslatedScript || parsedData.fullVietnameseScript || (isVietnamese ? undefined : segments.map((s: any) => s.translatedText || s.originalText).join(' '));

    return res.status(200).json({
      success: true,
      data: {
        ...parsedData,
        segments,
        fullTranslatedScript: fullTranslation,
        fullVietnameseScript: fullTranslation,
        isVietnamese: Boolean(isVietnamese),
        id: `ext_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        videoMetadata: {
          url: trimmedUrl,
          platform: media.platform,
          title: media.title,
          author: media.author,
          duration: media.duration,
          streamUrl: (media as any).streamUrl,
          downloadUrl: (media as any).downloadUrl || (media as any).streamUrl,
          coverImage: (media as any).coverImage,
          mimeType: media.mimeType,
          mediaType: media.mimeType?.startsWith('audio/') ? 'audio' : 'video',
        },
        createdAt: Date.now(),
        modelUsed: activeModel,
      },
      message: 'Bóc tách kịch bản thành công! 🎉',
    });
  } catch (error: any) {
    console.error('[API /api/extract Error]:', error);

    if (error instanceof VideoExtractionError) {
      const statusMap: Record<string, number> = {
        VIDEO_UNAVAILABLE: 404,
        WAF_CHALLENGE_BLOCKED: 403,
        RATE_LIMIT: 429,
        INVALID_URL: 400,
        DOWNLOAD_STREAM_FAILED: 502,
        AI_ERROR: 500,
      };
      const statusCode = statusMap[error.code] || 500;
      return res.status(statusCode).json({
        success: false,
        errorCode: error.code,
        error: error.message,
      });
    }

    let msg = error.message || 'Lỗi bóc tách video.';
    let errorCode = 'EXTRACTION_FAILED';

    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
      errorCode = 'RATE_LIMIT';
      msg = 'Gemini AI đang bị chạm hạn mức tần suất (Rate Limit 429). Vui lòng thử lại sau 30 giây!';
    }

    return res.status(500).json({
      success: false,
      errorCode,
      error: msg,
    });
  } finally {
    if (localFilePath && fs.existsSync(localFilePath)) {
      try {
        fs.unlinkSync(localFilePath);
      } catch {}
    }
  }
}
