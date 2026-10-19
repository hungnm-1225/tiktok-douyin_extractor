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

// API 2.7: Create direct resumable upload session for Google Gemini File API (up to 2GB per file)
app.post('/api/create-upload-session', async (req, res) => {
  try {
    const { fileName, mimeType, size } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'Chưa cấu hình GEMINI_API_KEY trên máy chủ.',
      });
    }

    const initUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`;
    const safeMimeType = mimeType || 'video/mp4';
    const safeLength = size ? String(size) : '0';

    const googleRes = await fetch(initUrl, {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': safeLength,
        'X-Goog-Upload-Header-Content-Type': safeMimeType,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file: {
          display_name: fileName || 'Uploaded Media',
        },
      }),
    });

    if (!googleRes.ok) {
      const errText = await googleRes.text();
      console.error('[Create Upload Session Error]:', googleRes.status, errText);
      return res.status(502).json({
        success: false,
        error: 'Không thể khởi tạo phiên tải lên Google Cloud.',
      });
    }

    const uploadUrl = googleRes.headers.get('x-goog-upload-url');
    if (!uploadUrl) {
      return res.status(502).json({
        success: false,
        error: 'Google không trả về đường dẫn tải tệp trực tiếp.',
      });
    }

    res.json({
      success: true,
      uploadUrl,
    });
  } catch (err: any) {
    console.error('[Create Upload Session Exception]:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Lỗi khởi tạo tải tệp.',
    });
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
        streamUrl: downloaded.streamUrl,
        downloadUrl: downloaded.downloadUrl || downloaded.streamUrl,
        coverImage: downloaded.coverImage,
        mimeType: downloaded.mimeType,
        mediaType: downloaded.mimeType?.startsWith('audio/') ? 'audio' : 'video',
      },
    });

    // Clean up temporary audio file if created
    if (tempAiAudioPath) {
      cleanupLocalTempFile(tempAiAudioPath);
    }

    console.log(`[API /api/extract] Script extraction finished successfully! Cleaning up media immediately...`);
    // Delete video/audio immediately after script extraction to keep website and server lightweight
    if (localTempPath) {
      cleanupLocalTempFile(localTempPath);
      localTempPath = undefined;
    }

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
  // Branch 1: Vercel Blob client token request
  if (req.body?.type === 'blob.generate-client-token' || req.body?.type?.startsWith('blob.')) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(400).json({
        error: 'Chưa kết nối BLOB_READ_WRITE_TOKEN. Vui lòng cấu hình biến môi trường BLOB_READ_WRITE_TOKEN.',
      });
    }

    try {
      const { handleUpload } = await import('@vercel/blob/client');
      const jsonResponse = await handleUpload({
        body: req.body,
        request: req,
        onBeforeGenerateToken: async (pathname: string) => {
          return {
            allowOverwrite: true,
            addRandomSuffix: false,
            maximumSizeInBytes: 500 * 1024 * 1024, // 500MB
            tokenPayload: JSON.stringify({ pathname }),
          };
        },
        onUploadCompleted: async ({ blob }) => {
          console.log('[Vercel Blob] Upload completed:', blob.url);
        },
      });

      return res.status(200).json(jsonResponse);
    } catch (error: any) {
      console.error('[Vercel Blob HandleUpload Error]:', error);
      return res.status(400).json({ error: error.message });
    }
  }

  let localTempPath: string | undefined;

  try {
    const { base64Data, fileUri, cloudFileName, fileName, mimeType, title } = req.body || {};

    if (!base64Data && !fileUri) {
      return res.status(400).json({
        success: false,
        error: 'Thiếu dữ liệu file tải lên.',
      });
    }

    const customApiKey = (req.headers['x-gemini-api-key'] as string) || req.body.customApiKey;

    const isAudio = Boolean(
      (mimeType && mimeType.startsWith('audio/')) ||
      /\.(mp3|wav|m4a|aac|ogg|flac|wma)$/i.test(fileName || '')
    );

    let result;

    if (fileUri) {
      // Direct Cloud Upload Mode: file uploaded directly to Google Gemini Cloud (up to 2GB)
      result = await processMediaWithGemini({
        fileUri,
        cloudFileName,
        mimeType: mimeType || (isAudio ? 'audio/mp3' : 'video/mp4'),
        customApiKey,
        videoMetadata: {
          url: 'local_upload',
          platform: 'upload',
          title: title || fileName || (isAudio ? 'Tệp Ghi Âm Tải Lên' : 'Video Tải Lên'),
          mimeType: mimeType || (isAudio ? 'audio/mp3' : 'video/mp4'),
          mediaType: isAudio ? 'audio' : 'video',
        },
      });
    } else {
      // Legacy Base64 Mode
      const fileId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const ext = fileName?.split('.').pop() || (mimeType?.includes('audio') ? 'mp3' : 'mp4');
      localTempPath = path.join(os.tmpdir(), `upload_${fileId}.${ext}`);

      const base64Clean = base64Data.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(base64Clean, 'base64');
      const fs = await import('fs');
      fs.writeFileSync(localTempPath, buffer);

      console.log(`[API /api/upload-media] Saved uploaded file to temp: ${localTempPath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);

      const optimized = await extractAudioIfVideoTooLarge(localTempPath);
      localTempPath = optimized.filePath;
      const finalMimeType = optimized.mimeType || mimeType || 'audio/mp3';

      result = await processMediaWithGemini({
        filePath: localTempPath,
        mimeType: finalMimeType,
        customApiKey,
        videoMetadata: {
          url: 'local_upload',
          platform: 'upload',
          title: title || fileName || (isAudio ? 'Tệp Ghi Âm Tải Lên' : 'Video Tải Lên'),
          mimeType: finalMimeType,
          mediaType: isAudio ? 'audio' : 'video',
        },
      });
    }

    result.videoMetadata.mimeType = mimeType || (isAudio ? 'audio/mp3' : 'video/mp4');
    result.videoMetadata.mediaType = isAudio ? 'audio' : 'video';

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

// API 5: Process media from Vercel Blob URL directly
app.post('/api/process-blob', async (req, res) => {
  const { blobUrl, fileName, mimeType, title } = req.body || {};

  if (!blobUrl) {
    return res.status(400).json({ success: false, error: 'Thiếu đường dẫn Blob URL.' });
  }

  const customApiKey = (req.headers['x-gemini-api-key'] as string) || req.body.customApiKey;

  try {
    console.log(`[API /api/process-blob] Fetching blob stream: ${blobUrl}`);
    const headers: Record<string, string> = { 'Cache-Control': 'no-cache, no-store' };
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`;
    }
    const fileRes = await fetch(blobUrl, { headers, cache: 'no-store' });
    if (!fileRes.ok) {
      throw new Error(`Không thể đọc file từ Blob storage (${fileRes.status})`);
    }

    const arrayBuffer = await fileRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const safeMimeType = mimeType || 'video/mp4';

    const tempFileId = `blob_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const ext = fileName?.split('.').pop() || (safeMimeType.includes('audio') ? 'mp3' : 'mp4');
    const tempFilePath = path.join(os.tmpdir(), `${tempFileId}.${ext}`);
    fs.writeFileSync(tempFilePath, buffer);

    const isAudio = Boolean(
      safeMimeType.startsWith('audio/') ||
      /\.(mp3|wav|m4a|aac|ogg|flac|wma)$/i.test(fileName || '')
    );

    const result = await processMediaWithGemini({
      filePath: tempFilePath,
      mimeType: safeMimeType,
      customApiKey,
      videoMetadata: {
        url: 'local_upload',
        platform: 'upload',
        title: title || fileName || (isAudio ? 'Tệp Ghi Âm Tải Lên' : 'Video Tải Lên'),
        mimeType: safeMimeType,
        mediaType: isAudio ? 'audio' : 'video',
      },
    });

    cleanupLocalTempFile(tempFilePath);

    // Clean up Vercel Blob if token available
    try {
      const { del } = await import('@vercel/blob');
      await del(blobUrl);
      console.log(`[Vercel Blob Cleanup] Deleted blob: ${blobUrl}`);
    } catch {}

    res.json({
      success: true,
      data: result,
      message: 'Bóc tách file thành công với Gemini! ✨',
    });
  } catch (error: any) {
    console.error('[API /api/process-blob Error]:', error);
    res.status(500).json({ success: false, error: error.message || 'Lỗi xử lý file blob.' });
  }
});

// API 6: Proxy media streaming for Douyin & TikTok to bypass CORS and Referer restrictions
app.get('/api/proxy-media', async (req, res) => {
  const rawUrl = req.query.url as string;
  if (!rawUrl) {
    return res.status(400).send('Missing url parameter');
  }

  try {
    let targetUrl = decodeURIComponent(rawUrl).trim();
    if (targetUrl.startsWith('//')) {
      targetUrl = 'https:' + targetUrl;
    }

    const range = req.headers.range;
    const platformQuery = ((req.query.platform as string) || '').toLowerCase();
    const isDouyin =
      platformQuery === 'douyin' ||
      targetUrl.includes('douyin') ||
      targetUrl.includes('zjcdn.com') ||
      targetUrl.includes('douyinvod.com') ||
      targetUrl.includes('snssdk.com') ||
      targetUrl.includes('bytegoofy.com') ||
      targetUrl.includes('bytedance.com') ||
      targetUrl.includes('pstatp.com') ||
      targetUrl.includes('amemv.com') ||
      targetUrl.includes('ixigua.com') ||
      targetUrl.includes('toutiao');

    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Referer': isDouyin ? 'https://www.douyin.com/' : 'https://www.tiktok.com/',
      'Origin': isDouyin ? 'https://www.douyin.com' : 'https://www.tiktok.com',
      'Accept': '*/*',
    };

    if (range) {
      headers['Range'] = range;
    }

    const upstreamRes = await fetch(targetUrl, {
      method: 'GET',
      headers,
    });

    res.status(upstreamRes.status);

    const contentType = upstreamRes.headers.get('content-type') || 'video/mp4';
    const contentLength = upstreamRes.headers.get('content-length');
    const contentRange = upstreamRes.headers.get('content-range');
    const acceptRanges = upstreamRes.headers.get('accept-ranges') || 'bytes';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', acceptRanges);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (contentRange) res.setHeader('Content-Range', contentRange);
    res.setHeader('Cache-Control', 'public, max-age=7200');

    if (!upstreamRes.body) {
      return res.end();
    }

    const { Readable } = await import('stream');
    const nodeStream = Readable.fromWeb(upstreamRes.body as any);
    nodeStream.pipe(res);
  } catch (err: any) {
    console.error('[Proxy Media Server Error]:', err);
    if (!res.headersSent) {
      res.status(500).send(err.message || 'Stream proxy error');
    }
  }
});

export default app;
export { app };
