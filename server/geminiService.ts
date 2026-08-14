import { GoogleGenAI, Type } from '@google/genai';
import fs from 'fs';
import { ExtractionResult, ScriptSegment } from '../src/types';

function getAiClient(customApiKey?: string): GoogleGenAI {
  const key = customApiKey || process.env.GEMINI_API_KEY;
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const CANDIDATE_MODELS = [
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-3.1-pro-preview",
    "gemini-3-flash-preview",
    "gemini-pro-latest",
    "gemini-flash-latest",
    "gemini-flash-lite-latest"
];

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

interface ProcessMediaParams {
  filePath: string;
  mimeType: string;
  customApiKey?: string;
  videoMetadata: {
    url: string;
    platform: 'tiktok' | 'douyin' | 'upload' | 'sample';
    title: string;
    author?: string;
    duration?: number;
  };
}

export async function processMediaWithGemini({
  filePath,
  mimeType,
  customApiKey,
  videoMetadata,
}: ProcessMediaParams): Promise<ExtractionResult> {
  const ai = getAiClient(customApiKey);
  let uploadedCloudFile: any = null;

  try {
    const stats = fs.statSync(filePath);
    const fileSizeInMB = stats.size / (1024 * 1024);
    console.log(`[Gemini Pipeline] Processing media: ${filePath} (${fileSizeInMB.toFixed(2)} MB, ${mimeType})`);

    let mediaPart: any;

    if (fileSizeInMB <= 20) {
      console.log(`[Gemini Pipeline] Using zero-latency inlineData audio buffer`);
      const buffer = fs.readFileSync(filePath);
      const base64Data = buffer.toString('base64');
      mediaPart = {
        inlineData: {
          mimeType: mimeType || 'audio/mp3',
          data: base64Data,
        },
      };
    } else {
      console.log(`[Gemini Pipeline] Uploading to File API (${fileSizeInMB.toFixed(2)} MB)`);
      uploadedCloudFile = await ai.files.upload({
        file: filePath,
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
          mimeType: uploadedCloudFile.mimeType || mimeType,
        },
      };
    }

    const taskPrompt = `Hãy bóc tách toàn bộ kịch bản video này:
1. Nhận diện ngôn ngữ chính: đặt isVietnamese = true nếu là tiếng Việt, false nếu là tiếng Trung/khác.
2. sourceLanguageName: Tên ngôn ngữ (ví dụ: "Tiếng Việt", "Tiếng Trung (Douyin)", "Tiếng Anh").
3. Bóc tách từng câu thoại theo thứ tự thời gian vào mảng 'segments':
   - timestamp: định dạng [mm:ss - mm:ss]
   - startSec, endSec: thời gian tính bằng giây
   - originalText: lời thoại gốc nguyên văn
   - translatedText: bản dịch tiếng Việt (nếu video gốc là tiếng Trung hoặc tiếng nước ngoài; nếu video gốc đã là tiếng Việt thì để nguyên lời thoại tiếng Việt)
4. fullOriginalScript: Toàn bộ kịch bản gốc nối thành đoạn văn liền mạch.
5. fullTranslatedScript: Toàn bộ bản dịch tiếng Việt nối liền mạch.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        isVietnamese: {
          type: Type.BOOLEAN,
          description: "true nếu video là tiếng Việt, false nếu là tiếng Trung hoặc ngoại ngữ khác",
        },
        sourceLanguage: {
          type: Type.STRING,
          description: "Mã ngôn ngữ: 'vi', 'zh', 'en', hoặc 'other'",
        },
        sourceLanguageName: {
          type: Type.STRING,
          description: "Tên ngôn ngữ gốc, ví dụ: 'Tiếng Việt', 'Tiếng Trung (Douyin)', 'Tiếng Anh'",
        },
        fullOriginalScript: {
          type: Type.STRING,
          description: "Toàn bộ văn bản kịch bản gốc liền mạch",
        },
        fullTranslatedScript: {
          type: Type.STRING,
          description: "Toàn bộ bản dịch tiếng Việt liền mạch (nếu gốc là tiếng nước ngoài)",
        },
        segments: {
          type: Type.ARRAY,
          description: "Danh sách từng câu thoại theo mốc thời gian",
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              timestamp: { type: Type.STRING, description: "Mốc thời gian [mm:ss - mm:ss]" },
              startSec: { type: Type.NUMBER, description: "Giây bắt đầu" },
              endSec: { type: Type.NUMBER, description: "Giây kết thúc" },
              originalText: { type: Type.STRING, description: "Lời thoại gốc nguyên văn" },
              translatedText: { type: Type.STRING, description: "Bản dịch tiếng Việt (nếu tiếng Trung/ngoại ngữ)" },
            },
            required: ["timestamp", "startSec", "endSec", "originalText"],
          },
        },
      },
      required: ["isVietnamese", "sourceLanguageName", "fullOriginalScript", "segments"],
    };

    let response: any;
    let lastError: any;

    for (const modelName of CANDIDATE_MODELS) {
      console.log(`[Gemini Pipeline] Attempting with model: ${modelName}...`);
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: [
            mediaPart,
            {
              text: `${taskPrompt}\n\nTiêu đề video tham khảo: "${videoMetadata.title || ''}".`,
            },
          ],
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: responseSchema,
          },
        });

        if (response?.text) {
          console.log(`[Gemini Pipeline] Success with model: ${modelName}!`);
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[Gemini Pipeline] Model ${modelName} error:`, err.message || err);
        continue;
      }
    }

    if (!response?.text) {
      throw lastError || new Error('Không thể kết nối Gemini AI. Vui lòng thử lại sau giây lát.');
    }

    const parsedData = JSON.parse(response.text);

    let rawSegments = parsedData.segments || [];
    if (rawSegments.length === 0) {
      rawSegments = [
        {
          id: 'seg_1',
          timestamp: '[00:00 - 00:30]',
          startSec: 0,
          endSec: videoMetadata.duration || 30,
          originalText: parsedData.fullOriginalScript || 'Giai điệu âm thanh / nhạc nền video',
          translatedText: parsedData.fullTranslatedScript || 'Giai điệu âm thanh / nhạc nền video',
        },
      ];
    }

    const segments: ScriptSegment[] = rawSegments.map((seg: any, idx: number) => ({
      id: seg.id || `seg_${idx + 1}`,
      timestamp: seg.timestamp || `[00:${String(idx * 5).padStart(2, '0')} - 00:${String((idx + 1) * 5).padStart(2, '0')}]`,
      startSec: typeof seg.startSec === 'number' ? seg.startSec : idx * 5,
      endSec: typeof seg.endSec === 'number' ? seg.endSec : (idx + 1) * 5,
      originalText: seg.originalText || '',
      translatedText: seg.translatedText || (parsedData.isVietnamese ? seg.originalText : undefined),
    }));

    const isVietnamese = parsedData.isVietnamese ?? (parsedData.sourceLanguage === 'vi' || parsedData.sourceLanguageName?.toLowerCase().includes('việt'));

    const result: ExtractionResult = {
      id: `ext_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: Date.now(),
      videoMetadata: {
        ...videoMetadata,
        duration: videoMetadata.duration || (segments.length > 0 ? segments[segments.length - 1].endSec : 30),
      },
      segments,
      fullOriginalScript: parsedData.fullOriginalScript || segments.map(s => s.originalText).join(' '),
      fullTranslatedScript: parsedData.fullTranslatedScript || (isVietnamese ? undefined : segments.map(s => s.translatedText || s.originalText).join(' ')),
      sourceLanguage: parsedData.sourceLanguage || (isVietnamese ? 'vi' : 'zh'),
      sourceLanguageName: parsedData.sourceLanguageName || (isVietnamese ? 'Tiếng Việt' : 'Tiếng Trung (Douyin)'),
      isVietnamese: Boolean(isVietnamese),
      cleanedUpTempFiles: true,
    };

    return result;
  } catch (error: any) {
    console.error('[Gemini Processing Error]:', error);
    throw new Error(`Lỗi xử lý AI: ${error.message || 'Không thể bóc tách kịch bản.'}`);
  } finally {
    if (uploadedCloudFile?.name) {
      try {
        console.log(`[CleanUp Gemini Cloud] Deleting file: ${uploadedCloudFile.name}`);
        await ai.files.delete({ name: uploadedCloudFile.name });
      } catch (delErr) {
        console.warn(`[CleanUp Warning] Failed to delete Gemini Cloud file:`, delErr);
      }
    }
  }
}
