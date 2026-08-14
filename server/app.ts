import express from 'express';
import { downloadMediaFromUrl, cleanupLocalTempFile } from './videoExtractor';
import { processMediaWithGemini } from './geminiService';
import { SAMPLE_VIDEOS } from './sampleData';

const app = express();

// JSON payload limits for base64 audio/video uploads
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

// API 1: Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    model: 'gemini-3.7-flash',
    sdk: '@google/genai',
    hasApiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// API 2: Get curated sample scripts
app.get('/api/samples', (req, res) => {
  res.json({
    success: true,
    samples: SAMPLE_VIDEOS,
  });
});

// API 3: Extract script from TikTok / Douyin URL
app.post('/api/extract', async (req, res) => {
  let localTempPath: string | undefined;

  try {
    const { url, sampleId } = req.body;

    // Handle sample requests directly if requested
    if (sampleId) {
      const found = SAMPLE_VIDEOS.find((s) => s.id === sampleId);
      if (found) {
        return res.json({
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

    console.log(`[API /api/extract] Received request for URL: ${url}`);

    // Step 1: Download media stream
    const downloaded = await downloadMediaFromUrl(url.trim());
    localTempPath = downloaded.filePath;

    const customApiKey = (req.headers['x-gemini-api-key'] as string) || req.body.customApiKey;

    // Step 2 & 3: Process with Gemini
    console.log(`[API /api/extract] Sending to Gemini for script extraction...`);
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

    console.log(`[API /api/extract] Script extraction finished successfully!`);

    res.json({
      success: true,
      data: result,
      message: 'Bóc tách kịch bản thành công! 🎉',
    });
  } catch (error: any) {
    console.error('[API /api/extract Error]:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Đã có lỗi xảy ra trong quá trình bóc tách video.',
    });
  } finally {
    if (localTempPath) {
      cleanupLocalTempFile(localTempPath);
    }
  }
});

// API 4: Direct upload audio/video file for transcription
app.post('/api/upload-media', async (req, res) => {
  let localTempPath: string | undefined;

  try {
    const { base64Data, fileName, mimeType, title } = req.body;

    if (!base64Data) {
      return res.status(400).json({
        success: false,
        error: 'Thiếu dữ liệu file tải lên.',
      });
    }

    // Save base64 to temp file
    const fileId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const ext = fileName?.split('.').pop() || (mimeType?.includes('audio') ? 'mp3' : 'mp4');
    localTempPath = `/tmp/upload_${fileId}.${ext}`;

    const base64Clean = base64Data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');
    const fs = await import('fs');
    fs.writeFileSync(localTempPath, buffer);

    console.log(`[API /api/upload-media] Saved uploaded file to temp: ${localTempPath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);

    const customApiKey = (req.headers['x-gemini-api-key'] as string) || req.body.customApiKey;

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

    res.json({
      success: true,
      data: result,
      message: 'Bóc tách file thành công với Gemini! ✨',
    });
  } catch (error: any) {
    console.error('[API /api/upload-media Error]:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi xử lý file tải lên.',
    });
  } finally {
    if (localTempPath) {
      cleanupLocalTempFile(localTempPath);
    }
  }
});

export default app;
export { app };
