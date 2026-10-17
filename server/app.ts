import 'dotenv/config';
import express from 'express';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { 
  downloadMediaFromUrl, 
  cleanupLocalTempFile, 
  extractAudioIfVideoTooLarge, 
  VideoExtractionError 
} from './videoExtractor';
import { processMediaWithGemini } from './geminiService';
import { SAMPLE_VIDEOS } from './sampleData';

const app = express();

// JSON payload limits for base64 audio/video uploads (supports up to 150MB)
app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ extended: true, limit: '150mb' }));

// API 1: Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    model: 'gemini-3.5-flash-lite',
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

// API 2.5: Download extracted media (video MP4 / audio MP3)
app.get('/api/download-media', (req, res) => {
  try {
    const fileName = req.query.file as string;
    if (!fileName || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      return res.status(400).send('Tên file không hợp lệ.');
    }
    const tempDir = path.join(os.tmpdir(), 'tiktok_douyin_media');
    const filePath = path.join(tempDir, fileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('File video không tồn tại hoặc đã hết hạn (tự động dọn dẹp sau 60 phút).');
    }
    res.download(filePath, fileName);
  } catch (err: any) {
    res.status(500).send(`Lỗi tải file: ${err.message}`);
  }
});

// API 2.6: Stream media online for custom video/audio player (supports HTTP 206 Partial Content)
app.get('/api/stream-media', (req, res) => {
  try {
    const fileName = req.query.file as string;
    if (!fileName || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      return res.status(400).send('Tên file không hợp lệ.');
    }
    const tempDir = path.join(os.tmpdir(), 'tiktok_douyin_media');
    const filePath = path.join(tempDir, fileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('File media không tồn tại hoặc đã hết hạn.');
    }
    res.sendFile(filePath);
  } catch (err: any) {
    res.status(500).send(`Lỗi phát file: ${err.message}`);
  }
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

    console.log(`[API /api/extract] Received request for URL: ${url}`);

    // Step 1: Download media stream (preserves full original MP4 video for player and direct download)
    const downloaded = await downloadMediaFromUrl(url.trim());
    localTempPath = downloaded.filePath;

    // Step 2: Optimization for Gemini Speed (10x faster)
    // For video files, extract lightweight 128kbps MP3 audio for Gemini transcription.
    // This reduces payload from 70-120MB to ~2-3MB, eliminating File API upload latency
    // and cutting AI transcription time from >2.5 minutes down to ~15-25 seconds!
    let aiMediaFilePath = localTempPath;
    let aiMimeType = downloaded.mimeType;
    let tempAiAudioPath: string | undefined;

    if (downloaded.filePath.endsWith('.mp4') || downloaded.mimeType.startsWith('video/')) {
      console.log(`[API /api/extract] Extracting lightweight audio track for Gemini 10x acceleration...`);
      const audioOptimized = await extractAudioIfVideoTooLarge(downloaded.filePath, 0); // extract audio
      if (audioOptimized.filePath !== downloaded.filePath) {
        aiMediaFilePath = audioOptimized.filePath;
        aiMimeType = 'audio/mp3';
        tempAiAudioPath = audioOptimized.filePath;
      }
    }

    const customApiKey = (req.headers['x-gemini-api-key'] as string) || req.body.customApiKey;

    // Step 3: Process with Gemini using lightweight audio
    console.log(`[API /api/extract] Sending audio to Gemini for rapid script extraction...`);
    const result = await processMediaWithGemini({
      filePath: aiMediaFilePath,
      mimeType: aiMimeType,
      customApiKey,
      videoMetadata: {
        url: url.trim(),
        platform: downloaded.platform,
        title: downloaded.title,
        author: downloaded.author,
        duration: downloaded.duration,
      },
    });

    // Clean up temporary audio file if created
    if (tempAiAudioPath) {
      cleanupLocalTempFile(tempAiAudioPath);
    }

    // Attach direct download & stream URL for frontend custom player and download button (points to full original MP4)
    if (downloaded.filePath && fs.existsSync(downloaded.filePath)) {
      const fileName = path.basename(downloaded.filePath);
      result.videoMetadata.downloadUrl = `/api/download-media?file=${encodeURIComponent(fileName)}`;
      result.videoMetadata.streamUrl = `/api/stream-media?file=${encodeURIComponent(fileName)}`;
    }

    console.log(`[API /api/extract] Script extraction finished successfully!`);

    // Schedule cleanup after 60 minutes so user can download the video
    setTimeout(() => {
      cleanupLocalTempFile(localTempPath);
    }, 60 * 60 * 1000);

    res.json({
      success: true,
      data: result,
      message: 'Bóc tách kịch bản thành công! 🎉',
    });
  } catch (error: any) {
    if (localTempPath) {
      cleanupLocalTempFile(localTempPath);
    }
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

    let msg = error.message || 'Đã có lỗi xảy ra trong quá trình bóc tách video.';
    let errorCode = 'EXTRACTION_FAILED';

    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
      errorCode = 'RATE_LIMIT';
      msg = 'Gemini AI đang bị chạm hạn mức tần suất (Rate Limit 429). Vui lòng thử lại sau giây lát!';
    }

    res.status(500).json({
      success: false,
      errorCode,
      error: msg,
    });
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
    localTempPath = path.join(os.tmpdir(), `upload_${fileId}.${ext}`);

    const base64Clean = base64Data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');
    const fs = await import('fs');
    fs.writeFileSync(localTempPath, buffer);

    console.log(`[API /api/upload-media] Saved uploaded file to temp: ${localTempPath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);

    // If uploaded file is a heavy video (> 15MB), extract audio track via ffmpeg to keep Gemini request lightweight & fast
    const optimized = await extractAudioIfVideoTooLarge(localTempPath);
    localTempPath = optimized.filePath;
    const finalMimeType = optimized.mimeType || mimeType || 'audio/mp3';

    const customApiKey = (req.headers['x-gemini-api-key'] as string) || req.body.customApiKey;

    const result = await processMediaWithGemini({
      filePath: localTempPath,
      mimeType: finalMimeType,
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
