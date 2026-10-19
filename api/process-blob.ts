import { GoogleGenAI, Type } from '@google/genai';
import { del, get } from '@vercel/blob';

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
  if (text.startsWith('```json')) text = text.substring(7);
  else if (text.startsWith('```')) text = text.substring(3);
  if (text.endsWith('```')) text = text.substring(0, text.length - 3);
  text = text.trim();

  try {
    return JSON.parse(text);
  } catch (err: any) {
    console.warn(`[JSON Repair] Initial parse failed (${err.message}). Attempting automated repair...`);
  }

  let repaired = text;
  let inString = false;
  let isEscaped = false;
  for (let i = 0; i < repaired.length; i++) {
    const ch = repaired[i];
    if (ch === '\\' && inString) isEscaped = !isEscaped;
    else if (ch === '"' && !isEscaped) inString = !inString;
    else isEscaped = false;
  }
  if (inString) repaired += '"';

  const openStack: string[] = [];
  inString = false;
  isEscaped = false;
  for (let i = 0; i < repaired.length; i++) {
    const ch = repaired[i];
    if (ch === '\\' && inString) isEscaped = !isEscaped;
    else if (ch === '"' && !isEscaped) inString = !inString;
    else if (!inString) {
      if (ch === '{' || ch === '[') openStack.push(ch);
      else if (ch === '}' && openStack[openStack.length - 1] === '{') openStack.pop();
      else if (ch === ']' && openStack[openStack.length - 1] === '[') openStack.pop();
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
    return JSON.parse(repaired);
  } catch (repairErr: any) {
    console.warn(`[JSON Repair] Fallback to regex extraction...`);
  }

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

  if (segments.length > 0) {
    return {
      isVietnamese,
      sourceLanguageName: isVietnamese ? 'Tiếng Việt' : 'Tiếng Trung (Douyin)',
      summary,
      segments,
      fullOriginalScript: segments.map((s) => s.originalText || '').join(' '),
      fullTranslatedScript: isVietnamese
        ? undefined
        : segments.map((s) => s.translatedText || s.originalText || '').join(' '),
    };
  }

  throw new Error(`Không thể giải mã phản hồi JSON từ AI.`);
}

const SYSTEM_INSTRUCTION = `Bạn là chuyên gia bóc tách kịch bản audio/video ngắn hàng đầu (TikTok & Douyin).
Nhiệm vụ trọng tâm:
1. Nghe và nhận diện chính xác ngôn ngữ của video (Tiếng Việt, Tiếng Trung, Tiếng Anh,...).
2. Bóc tách nguyên văn 100% từng câu thoại trong video/audio thành văn bản (Script verbatim):
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

async function downloadBlobBuffer(blobUrl: string): Promise<Buffer> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  let lastError: any = null;

  // Attempt 1: Direct fetch with Bearer token & retry (handles CDN replication delay after overwrite)
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[Vercel Blob Download] Attempt ${attempt} fetching: ${blobUrl}`);
      const headers: Record<string, string> = {
        'Cache-Control': 'no-cache, no-store',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(blobUrl, { headers, cache: 'no-store' });
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        if (arrayBuf.byteLength > 0) {
          console.log(`[Vercel Blob Download] Success on attempt ${attempt} (${(arrayBuf.byteLength / 1024 / 1024).toFixed(2)} MB)`);
          return Buffer.from(arrayBuf);
        }
      }
      lastError = new Error(`Direct fetch HTTP ${res.status} (${res.statusText})`);
      console.warn(`[Vercel Blob Download] Attempt ${attempt} failed: ${lastError.message}`);
    } catch (err: any) {
      lastError = err;
      console.warn(`[Vercel Blob Download] Attempt ${attempt} network error:`, err.message);
    }

    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
    }
  }

  // Attempt 2: Use official @vercel/blob get() with public access
  try {
    console.log(`[Vercel Blob Download] Fallback: get() with public access...`);
    const blobResult = await get(blobUrl, {
      access: 'public',
      useCache: false,
      token,
    });
    if (blobResult?.stream) {
      const streamBuffer = await new Response(blobResult.stream).arrayBuffer();
      if (streamBuffer.byteLength > 0) {
        return Buffer.from(streamBuffer);
      }
    }
  } catch (err: any) {
    console.warn(`[Vercel Blob Download] get(public) failed:`, err.message);
  }

  // Attempt 3: Use official @vercel/blob get() with private access
  try {
    console.log(`[Vercel Blob Download] Fallback: get() with private access...`);
    const blobResult = await get(blobUrl, {
      access: 'private',
      useCache: false,
      token,
    });
    if (blobResult?.stream) {
      const streamBuffer = await new Response(blobResult.stream).arrayBuffer();
      if (streamBuffer.byteLength > 0) {
        return Buffer.from(streamBuffer);
      }
    }
  } catch (err: any) {
    console.warn(`[Vercel Blob Download] get(private) failed:`, err.message);
  }

  throw new Error(`Không thể tải tệp từ kho lưu trữ Blob: ${lastError?.message || 'Tệp chưa sẵn sàng hoặc không thể truy cập.'}`);
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-gemini-api-key, X-Gemini-Api-Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const { blobUrl, fileName, mimeType, title } = body || {};

  if (!blobUrl) {
    return res.status(400).json({
      success: false,
      error: 'Thiếu đường dẫn Blob URL.',
    });
  }

  const apiKey =
    (req.headers['x-gemini-api-key'] as string) ||
    (req.headers['X-Gemini-Api-Key'] as string) ||
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: 'Chưa cấu hình GEMINI_API_KEY trên máy chủ.',
    });
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });

  let uploadedCloudFile: any = null;

  try {
    console.log(`[Vercel Blob Process] Fetching blob content: ${blobUrl}`);
    const buffer = await downloadBlobBuffer(blobUrl);
    const safeMimeType = mimeType || 'video/mp4';
    const fileSizeInMB = buffer.length / (1024 * 1024);

    let mediaPart: any;
    if (fileSizeInMB <= 20) {
      console.log(`[Gemini Pipeline] Buffer <= 20MB (${fileSizeInMB.toFixed(2)} MB), using inlineData`);
      mediaPart = {
        inlineData: {
          mimeType: safeMimeType,
          data: buffer.toString('base64'),
        },
      };
    } else {
      console.log(`[Gemini Pipeline] Buffer > 20MB (${fileSizeInMB.toFixed(2)} MB), uploading to Gemini Cloud File API...`);
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');
      const ext = fileName?.split('.').pop() || (safeMimeType.includes('audio') ? 'mp3' : 'mp4');
      const tempFilePath = path.join(os.tmpdir(), `blob_gemini_${Date.now()}.${ext}`);
      fs.writeFileSync(tempFilePath, buffer);

      try {
        uploadedCloudFile = await ai.files.upload({
          file: tempFilePath,
        });

        let fileState = uploadedCloudFile.state;
        let attempts = 0;
        while (fileState === 'PROCESSING' && attempts < 10) {
          await new Promise((r) => setTimeout(r, 1500));
          const checked = await ai.files.get({ name: uploadedCloudFile.name });
          fileState = checked.state;
          attempts++;
        }

        mediaPart = {
          fileData: {
            fileUri: uploadedCloudFile.uri,
            mimeType: uploadedCloudFile.mimeType || safeMimeType,
          },
        };
      } finally {
        try {
          fs.unlinkSync(tempFilePath);
        } catch {}
      }
    }

    let activeModel = CANDIDATE_MODELS[0];
    let geminiResponse: any = null;
    let lastError: any = null;

    for (const modelName of CANDIDATE_MODELS) {
      try {
        console.log(`[Gemini Pipeline] Processing with: ${modelName}`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            mediaPart,
            {
              text: `Hãy bóc tách toàn bộ kịch bản và câu thoại từ file tải lên này theo định dạng JSON có cấu trúc. Tên file: "${fileName || 'Media Upload'}"`,
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
        console.warn(`[Gemini Pipeline] Model ${modelName} failed:`, err.message);
      }
    }

    if (!geminiResponse || !geminiResponse.text) {
      throw lastError || new Error('Không nhận được phản hồi từ AI.');
    }

    const parsed = safeParseGeminiJson(geminiResponse.text);

    const isVietnamese = parsed.isVietnamese ?? (parsed.sourceLanguage === 'vi' || parsed.sourceLanguageName?.toLowerCase().includes('việt'));
    const rawSegments = parsed.segments || [];
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
    const fullTranslation = parsed.fullTranslatedScript || parsed.fullVietnameseScript || (isVietnamese ? undefined : segments.map((s: any) => s.translatedText || s.originalText).join(' '));

    const isAudio = Boolean(
      (safeMimeType && safeMimeType.startsWith('audio/')) ||
      /\.(mp3|wav|m4a|aac|ogg|flac|wma)$/i.test(fileName || '')
    );

    return res.status(200).json({
      success: true,
      data: {
        ...parsed,
        segments,
        fullTranslatedScript: fullTranslation,
        fullVietnameseScript: fullTranslation,
        isVietnamese: Boolean(isVietnamese),
        id: `ext_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        videoMetadata: {
          url: 'local_upload',
          platform: 'upload',
          title: title || fileName || (isAudio ? 'Tệp Ghi Âm Tải Lên' : 'Video Tải Lên'),
          mimeType: safeMimeType,
          mediaType: isAudio ? 'audio' : 'video',
        },
        createdAt: Date.now(),
        modelUsed: activeModel,
      },
      message: 'Bóc tách file thành công với Gemini! ✨',
    });
  } catch (error: any) {
    console.error('[API /api/process-blob Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Lỗi xử lý file.',
    });
  } finally {
    // Clean up Gemini cloud file if created
    if (uploadedCloudFile?.name) {
      try {
        await ai.files.delete({ name: uploadedCloudFile.name });
        console.log(`[Gemini Cleanup] Deleted cloud file: ${uploadedCloudFile.name}`);
      } catch (err) {
        console.warn('[Gemini Cleanup Warning]:', err);
      }
    }

    // Automatically delete file from Vercel Blob immediately to keep storage 100% free & clean!
    try {
      if (blobUrl) {
        console.log(`[Vercel Blob Cleanup] Deleting blob: ${blobUrl}`);
        await del(blobUrl, { token: process.env.BLOB_READ_WRITE_TOKEN });
      }
    } catch (delErr) {
      console.warn('[Vercel Blob Cleanup Warning]:', delErr);
    }
  }
}
