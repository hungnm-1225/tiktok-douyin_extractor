import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { downloadMediaFromUrl, cleanupLocalTempFile, identifyPlatform } from './server/videoExtractor';
import { processMediaWithGemini } from './server/geminiService';
import { SAMPLE_VIDEOS } from './server/sampleData';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON payload limits
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

      // Check if URL matches any sample link for instant match
      const matchingSample = SAMPLE_VIDEOS.find(
        (s) => s.url.toLowerCase() === url.trim().toLowerCase() || url.includes(s.id)
      );
      if (matchingSample) {
        return res.json({
          success: true,
          data: {
            ...matchingSample.sampleResult,
            id: `ext_sample_${Date.now()}`,
            createdAt: Date.now(),
          },
          message: 'Bóc tách kịch bản thành công từ liên kết mẫu! ✨',
        });
      }

      const platform = identifyPlatform(url);
      console.log(`[API /api/extract] Processing URL: ${url} | Platform: ${platform}`);

      // Step 1: Download media audio stream with yt-dlp
      console.log(`[API /api/extract] Downloading audio stream with yt-dlp...`);
      const downloaded = await downloadMediaFromUrl(url.trim());
      localTempPath = downloaded.filePath;

      const customApiKey = (req.headers['x-gemini-api-key'] as string) || req.body.customApiKey;

      // Step 2 & 3: Process with Gemini
      console.log(`[API /api/extract] Sending to Gemini for script extraction...`);
      const result = await processMediaWithGemini({
        filePath: downloaded.filePath,
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

      res.json({
        success: true,
        data: result,
        message: 'Bóc tách kịch bản thành công! 💖',
      });
    } catch (error: any) {
      console.error('[API /api/extract Error]:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Đã xảy ra lỗi trong quá trình bóc tách video. Vui lòng kiểm tra lại liên kết hoặc thử video mẫu!',
      });
    } finally {
      // Step 4: Cleanup local temp audio file
      if (localTempPath) {
        cleanupLocalTempFile(localTempPath);
      }
    }
  });

  // API 4: Direct upload of audio/video file (MP4/MP3)
  app.post('/api/upload-media', async (req, res) => {
    let localTempPath: string | undefined;

    try {
      const { base64Data, fileName = 'upload_media.mp3', mimeType = 'audio/mp3', title = 'File Video/Audio Tải Lên' } = req.body;

      if (!base64Data) {
        return res.status(400).json({
          success: false,
          error: 'Không tìm thấy dữ liệu file media.',
        });
      }

      const tempDir = path.join('/tmp', 'tiktok_douyin_media');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const buffer = Buffer.from(base64Data.replace(/^data:[^;]+;base64,/, ''), 'base64');
      const ext = path.extname(fileName) || '.mp3';
      const tempFileName = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 6)}${ext}`;
      localTempPath = path.join(tempDir, tempFileName);

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
          title: title || fileName,
          author: 'Người dùng',
          duration: 30,
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌸 TikTok & Douyin Script AI Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
