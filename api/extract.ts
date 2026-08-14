import { GoogleGenAI, Type } from '@google/genai';
import fs from 'fs';
import path from 'path';

export const config = {
  maxDuration: 60,
};

const CANDIDATE_MODELS = [
  'gemini-3.7-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
  'gemini-2.5-flash',
];

const SYSTEM_INSTRUCTION = `Bạn là chuyên gia bóc tách kịch bản audio/video ngắn hàng đầu (TikTok & Douyin).
Nhiệm vụ trọng tâm:
1. Nghe và nhận diện chính xác ngôn ngữ của video (Tiếng Việt, Tiếng Trung, Tiếng Anh,...).
2. Bóc tách nguyên văn 100% từng câu thoại trong video/audio thành văn bản (Script verbatim).
   - Nếu là video Tiếng Việt: Bóc tách chính xác từng câu tiếng Việt kèm timestamp.
   - Nếu là video Tiếng Trung (hoặc tiếng nước ngoài): Bóc tách nguyên văn tiếng Trung gốc (chữ Hán), VÀ đồng thời dịch câu đó sang Tiếng Việt tự nhiên, chuẩn văn phong hội thoại / bắt trend mượt mà.
   - Nếu là nhạc không lời hoặc chỉ có âm thanh nền: Tạo phân đoạn mô tả ngắn gọn giai điệu nhạc nền [mm:ss].
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
    toneAndStyle: {
      type: Type.STRING,
      description: 'Phong cách, giọng điệu (hài hước, review, tâm sự, bán hàng...)',
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

async function downloadMedia(cleanUrl: string, fileId: string, platform: 'tiktok' | 'douyin' | 'sample') {
  const tempDir = '/tmp';
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // Strategy 1: TikWM API
  try {
    const form = new URLSearchParams();
    form.append('url', cleanUrl);
    form.append('hd', '1');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const apiRes = await fetch('https://www.tikwm.com/api/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
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
        const mediaStreamUrl = videoData.music || videoData.play || videoData.wmplay;

        if (mediaStreamUrl) {
          const isAudioOnly = Boolean(videoData.music);
          const ext = isAudioOnly ? 'mp3' : 'mp4';
          const mimeType = isAudioOnly ? 'audio/mp3' : 'video/mp4';
          const targetFilePath = path.join(tempDir, `${fileId}.${ext}`);

          const streamRes = await fetch(mediaStreamUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              Referer: 'https://www.tikwm.com/',
            },
          });

          if (streamRes.ok) {
            const buffer = Buffer.from(await streamRes.arrayBuffer());
            if (buffer.length > 1000) {
              fs.writeFileSync(targetFilePath, buffer);
              return { filePath: targetFilePath, mimeType, title, author, duration, platform };
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Download] TikWM attempt error:', err);
  }

  // Strategy 2: Douyin Direct API
  if (platform === 'douyin') {
    try {
      const redirectRes = await fetch(cleanUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15',
        },
        redirect: 'follow',
      });
      const finalUrl = redirectRes.url;
      const awemeIdMatch = finalUrl.match(/video\/(\d+)/) || finalUrl.match(/modal_id=(\d+)/);
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
            const audioUrl = item.music?.play_url?.uri || item.music?.play_url?.url_list?.[0];
            const videoUrl = item.video?.play_addr?.url_list?.[0]?.replace('playwm', 'play');
            const targetUrl = audioUrl || videoUrl;

            if (targetUrl) {
              const isAudio = Boolean(audioUrl);
              const ext = isAudio ? 'mp3' : 'mp4';
              const mimeType = isAudio ? 'audio/mp3' : 'video/mp4';
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
                  return { filePath: targetFilePath, mimeType, title, author, duration, platform };
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('[Download] Douyin Direct attempt error:', err);
    }
  }

  throw new Error(
    'Không thể tải stream âm thanh từ đường link này (có thể do video bị khóa quyền riêng tư hoặc giới hạn vị trí). ' +
    'Bạn hãy thử mở video trên điện thoại, bấm Lưu Video (Save Video) rồi dùng nút "Tải file MP4/MP3" trên giao diện để bóc tách ngay!'
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
          segments: [
            { timestamp: '00:00 - 00:05', startSec: 0, endSec: 5, originalText: '今天教大家一个三步去闭口的方法，真的超级有用！', vietnameseTranslation: 'Hôm nay mình sẽ chỉ cho mọi người phương pháp 3 bước trị mụn ẩn cực kỳ hiệu quả luôn nha!', speaker: 'Người hướng dẫn' },
            { timestamp: '00:05 - 00:10', startSec: 5, endSec: 10, originalText: '第一步先用温水洗脸打开毛孔。', vietnameseTranslation: 'Bước 1: Rửa mặt bằng nước ấm để giãn nở lỗ chân lông.', speaker: 'Người hướng dẫn' },
            { timestamp: '00:10 - 00:16', startSec: 10, endSec: 16, originalText: '第二步厚涂水杨酸棉片湿敷三分钟。', vietnameseTranslation: 'Bước 2: Dùng bông tẩy trang thấm Salicylic Acid đắp nhẹ trong 3 phút.', speaker: 'Người hướng dẫn' },
            { timestamp: '00:16 - 00:23', startSec: 16, endSec: 23, originalText: '第三步一定要用修护精华锁住水分。', vietnameseTranslation: 'Bước 3: Nhất định phải thoa serum phục hồi để khóa ẩm.', speaker: 'Người hướng dẫn' },
            { timestamp: '00:23 - 00:28', startSec: 23, endSec: 28, originalText: '坚持一周，皮肤细腻透亮！', vietnameseTranslation: 'Kiên trì 1 tuần, da sẽ mịn màng và căng bóng rõ rệt!', speaker: 'Người hướng dẫn' },
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

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng nhập đường link TikTok hoặc Douyin hợp lệ.',
      });
    }

    const cleanUrl = extractCleanUrl(url.trim());
    const platform = identifyPlatform(cleanUrl);
    const fileId = `media_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    console.log(`[API /api/extract] Downloading: ${cleanUrl}`);
    const media = await downloadMedia(cleanUrl, fileId, platform);
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

    const parsedData = JSON.parse(geminiResponse.text);

    return res.status(200).json({
      success: true,
      data: {
        ...parsedData,
        id: `ext_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        videoMetadata: {
          url: cleanUrl,
          platform: media.platform,
          title: media.title,
          author: media.author,
          duration: media.duration,
        },
        createdAt: Date.now(),
        modelUsed: activeModel,
      },
      message: 'Bóc tách kịch bản thành công! 🎉',
    });
  } catch (error: any) {
    console.error('[API /api/extract Error]:', error);
    let msg = error.message || 'Lỗi bóc tách video.';
    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
      msg = 'Gemini API Key đang bị chạm hạn mức tốc độ (Rate Limit 429). Vui lòng thử lại sau 30 giây hoặc bấm nút [API Key] trên header để đổi Key cá nhân!';
    }
    return res.status(500).json({
      success: false,
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
