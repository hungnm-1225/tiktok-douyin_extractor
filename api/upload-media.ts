import { GoogleGenAI, Type } from '@google/genai';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '40mb',
    },
  },
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

  let localTempPath: string | undefined;

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

    const { base64Data, fileUri, cloudFileName, fileName, mimeType, title } = body || {};

    if (!base64Data && !fileUri) {
      return res.status(400).json({
        success: false,
        error: 'Thiếu dữ liệu tệp tải lên.',
      });
    }

    const apiKey =
      (req.headers['x-gemini-api-key'] as string) ||
      (req.headers['X-Gemini-Api-Key'] as string) ||
      body.customApiKey ||
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

    let mediaPart: any;
    let uploadedFileRef: any = null;

    if (fileUri) {
      // Direct Cloud Upload Mode: file is already on Google Gemini Cloud (up to 2GB, 0 Vercel payload!)
      mediaPart = {
        fileData: {
          fileUri,
          mimeType: mimeType || 'video/mp4',
        },
      };
      if (cloudFileName) {
        uploadedFileRef = { name: cloudFileName };
      }
    } else {
      // Legacy Base64 Mode
      const fileId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const ext = fileName?.split('.').pop() || (mimeType?.includes('audio') ? 'mp3' : 'mp4');
      localTempPath = path.join(os.tmpdir(), `upload_${fileId}.${ext}`);

      const base64Clean = base64Data.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(base64Clean, 'base64');
      fs.writeFileSync(localTempPath, buffer);

      const fileStats = fs.statSync(localTempPath);
      const fileSizeInMB = fileStats.size / (1024 * 1024);

      if (fileSizeInMB <= 20) {
        mediaPart = {
          inlineData: {
            mimeType: mimeType || 'audio/mp3',
            data: base64Clean,
          },
        };
      } else {
        uploadedFileRef = await ai.files.upload({
          file: localTempPath,
          mimeType: mimeType || 'audio/mp3',
        } as any);

        mediaPart = {
          fileData: {
            fileUri: uploadedFileRef.uri,
            mimeType: uploadedFileRef.mimeType || mimeType || 'audio/mp3',
          },
        };
      }
    }

    let activeModel = CANDIDATE_MODELS[0];
    let geminiResponse: any = null;
    let lastError: any = null;

    for (const modelName of CANDIDATE_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            mediaPart,
            {
              text: `Hãy bóc tách toàn bộ kịch bản và câu thoại từ file tải lên này theo định dạng JSON có cấu trúc. Tên file: "${fileName || 'Audio/Video Upload'}"`,
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
      }
    }

    try {
      if (uploadedFileRef?.name) {
        ai.files.delete({ name: uploadedFileRef.name }).catch(() => {});
      }
    } catch {}

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
      (mimeType && mimeType.startsWith('audio/')) ||
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
          mimeType: mimeType || (isAudio ? 'audio/mp3' : 'video/mp4'),
          mediaType: isAudio ? 'audio' : 'video',
        },
        createdAt: Date.now(),
        modelUsed: activeModel,
      },
      message: 'Bóc tách file thành công với Gemini! ✨',
    });
  } catch (error: any) {
    console.error('[API /api/upload-media Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Lỗi xử lý file tải lên.',
    });
  } finally {
    if (localTempPath && fs.existsSync(localTempPath)) {
      try {
        fs.unlinkSync(localTempPath);
      } catch {}
    }
  }
}
