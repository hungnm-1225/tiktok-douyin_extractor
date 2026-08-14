import fs from 'fs';
import { processMediaWithGemini } from '../server/geminiService';
import { cleanupLocalTempFile } from '../server/videoExtractor';

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-gemini-api-key');

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
    localTempPath = `/tmp/upload_${fileId}.${ext}`;

    const base64Clean = base64Data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');
    fs.writeFileSync(localTempPath, buffer);

    const customApiKey =
      (req.headers['x-gemini-api-key'] as string) ||
      (req.headers['X-Gemini-Api-Key'] as string) ||
      body.customApiKey;

    const result = await processMediaWithGemini({
      filePath: localTempPath,
      mimeType: mimeType || 'audio/mp3',
      customApiKey,
      videoMetadata: {
        url: 'local_upload',
        platform: 'upload',
        title: title || fileName || 'Video/Audio Tải Lên',
      },
    });

    return res.status(200).json({
      success: true,
      data: result,
      message: 'Bóc tách file thành công với Gemini! ✨',
    });
  } catch (error: any) {
    console.error('[Vercel Serverless /api/upload-media Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Lỗi xử lý file tải lên.',
    });
  } finally {
    if (localTempPath) {
      cleanupLocalTempFile(localTempPath);
    }
  }
}
