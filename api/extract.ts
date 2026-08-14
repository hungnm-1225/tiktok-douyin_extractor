import { downloadMediaFromUrl, cleanupLocalTempFile } from '../server/videoExtractor';
import { processMediaWithGemini } from '../server/geminiService';
import { SAMPLE_VIDEOS } from '../server/sampleData';

export const config = {
  maxDuration: 60,
};

export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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

    const { url, sampleId } = body || {};

    // Handle sample requests directly if requested
    if (sampleId) {
      const found = SAMPLE_VIDEOS.find((s) => s.id === sampleId);
      if (found) {
        return res.status(200).json({
          success: true,
          data: {
            ...found.sampleResult,
            id: `ext_sample_${Date.now()}`,
            createdAt: Date.now(),
          },
          message: 'Đã tải dữ liệu kịch bản mẫu thành công! 🌸',
        });
      }
    }

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp đường link video TikTok hoặc Douyin hợp lệ.',
      });
    }

    console.log(`[Vercel Serverless /api/extract] Processing URL: ${url}`);

    // Step 1: Download media stream
    const downloaded = await downloadMediaFromUrl(url.trim());
    localTempPath = downloaded.filePath;

    const customApiKey =
      (req.headers['x-gemini-api-key'] as string) ||
      (req.headers['X-Gemini-Api-Key'] as string) ||
      body.customApiKey;

    // Step 2 & 3: Process with Gemini
    console.log(`[Vercel Serverless /api/extract] Sending to Gemini...`);
    const result = await processMediaWithGemini({
      filePath: localTempPath,
      mimeType: downloaded.mimeType,
      customApiKey,
      videoMetadata: {
        url: url.trim(),
        platform: downloaded.platform,
        title: downloaded.title,
        author: downloaded.author,
        duration: downloaded.duration,
      },
    });

    return res.status(200).json({
      success: true,
      data: result,
      message: 'Bóc tách kịch bản thành công! 🎉',
    });
  } catch (error: any) {
    console.error('[Vercel Serverless /api/extract Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Đã có lỗi xảy ra trong quá trình bóc tách video.',
    });
  } finally {
    if (localTempPath) {
      cleanupLocalTempFile(localTempPath);
    }
  }
}
