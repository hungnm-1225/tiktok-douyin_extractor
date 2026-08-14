import { GoogleGenAI, Type } from '@google/genai';
import fs from 'fs';
import path from 'path';

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '40mb',
    },
  },
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

    const { base64Data, fileName, mimeType, title } = body || {};

    if (!base64Data) {
      return res.status(400).json({
        success: false,
        error: 'Thiếu dữ liệu file tải lên.',
      });
    }

    const fileId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const ext = fileName?.split('.').pop() || (mimeType?.includes('audio') ? 'mp3' : 'mp4');
    localTempPath = path.join('/tmp', `upload_${fileId}.${ext}`);

    const base64Clean = base64Data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');
    fs.writeFileSync(localTempPath, buffer);

    const apiKey =
      (req.headers['x-gemini-api-key'] as string) ||
      (req.headers['X-Gemini-Api-Key'] as string) ||
      body.customApiKey ||
      process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'Chưa cấu hình GEMINI_API_KEY. Vui lòng bấm nút [API Key] trên header để nhập API Key.',
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const uploadRes = await ai.files.upload({
      file: localTempPath,
      mimeType: mimeType || 'audio/mp3',
    } as any);

    let activeModel = CANDIDATE_MODELS[0];
    let geminiResponse: any = null;
    let lastError: any = null;

    for (const modelName of CANDIDATE_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            uploadRes,
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
      if (uploadRes?.name) {
        ai.files.delete({ name: uploadRes.name }).catch(() => {});
      }
    } catch {}

    if (!geminiResponse || !geminiResponse.text) {
      throw lastError || new Error('Không nhận được phản hồi từ AI.');
    }

    const parsed = JSON.parse(geminiResponse.text);

    return res.status(200).json({
      success: true,
      data: {
        ...parsed,
        id: `ext_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        videoMetadata: {
          url: 'local_upload',
          platform: 'upload',
          title: title || fileName || 'Video/Audio Tải Lên',
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
