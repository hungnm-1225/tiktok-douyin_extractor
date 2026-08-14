import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import util from 'util';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

const execPromise = util.promisify(exec);
const TEMP_DIR = path.join('/tmp', 'tiktok_douyin_media');

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

export interface DownloadedMedia {
  filePath: string;
  mimeType: string;
  title: string;
  duration?: number;
  author?: string;
  platform: 'tiktok' | 'douyin' | 'upload' | 'sample';
}

/**
 * Extracts pure URL from messy share text
 */
export function extractCleanUrl(text: string): string {
  const urlMatch = text.match(/https?:\/\/[^\s"'<>]+/);
  return urlMatch ? urlMatch[0] : text.trim();
}

/**
 * Identifies platform from URL
 */
export function identifyPlatform(url: string): 'tiktok' | 'douyin' | 'sample' {
  const lower = url.toLowerCase();
  if (lower.includes('douyin.com') || lower.includes('iesdouyin.com')) {
    return 'douyin';
  }
  if (lower.includes('tiktok.com')) {
    return 'tiktok';
  }
  return 'sample';
}

/**
 * Ensures yt-dlp is available in /tmp/yt-dlp or system PATH
 */
export async function ensureYtDlp(): Promise<string> {
  const binaryPath = '/tmp/yt-dlp';
  if (fs.existsSync(binaryPath)) {
    return binaryPath;
  }
  
  try {
    const { stdout } = await execPromise('which yt-dlp');
    if (stdout.trim()) {
      return stdout.trim();
    }
  } catch {
    // not in PATH
  }

  // Download standalone binary
  try {
    await execPromise('curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /tmp/yt-dlp && chmod +x /tmp/yt-dlp');
    return binaryPath;
  } catch (err) {
    console.error('Failed to download yt-dlp:', err);
    throw new Error('yt-dlp is not available and could not be downloaded.');
  }
}

/**
 * Strategy 1: High-Speed Direct API for TikTok & Douyin (TikWM Engine)
 */
async function downloadViaTikWmApi(cleanUrl: string, fileId: string, platform: 'tiktok' | 'douyin' | 'sample'): Promise<DownloadedMedia | null> {
  try {
    const form = new URLSearchParams();
    form.append('url', cleanUrl);
    form.append('hd', '1');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const apiRes = await fetch('https://www.tikwm.com/api/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://www.tikwm.com/',
      },
      body: form.toString(),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!apiRes.ok) {
      console.warn(`[TikWM API] HTTP error ${apiRes.status}`);
      return null;
    }

    const data = await apiRes.json();
    if (data.code !== 0 || !data.data) {
      console.warn(`[TikWM API] Unsuccessful response:`, data.msg || data.code);
      return null;
    }

    const videoData = data.data;
    const title = videoData.title || (platform === 'douyin' ? 'Douyin Video' : 'TikTok Video');
    const author = videoData.author?.nickname || videoData.author?.unique_id || 'Creator';
    const duration = videoData.duration || 30;

    // Prefer audio stream for faster transcription and lower Gemini payload size
    // Fall back to video stream if audio stream is missing
    const mediaStreamUrl = videoData.music || videoData.play || videoData.wmplay;
    if (!mediaStreamUrl) {
      console.warn('[TikWM API] No stream URL found in payload.');
      return null;
    }

    const isAudioOnly = Boolean(videoData.music);
    const extension = isAudioOnly ? 'mp3' : 'mp4';
    const mimeType = isAudioOnly ? 'audio/mp3' : 'video/mp4';
    const targetFilePath = path.join(TEMP_DIR, `${fileId}.${extension}`);

    console.log(`[TikWM API] Downloading media stream (${extension})...`);
    const streamRes = await fetch(mediaStreamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://www.tiktok.com/',
      },
    });

    if (!streamRes.ok) {
      console.warn(`[TikWM API] Failed to download stream: ${streamRes.status}`);
      return null;
    }

    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    const arrayBuffer = await streamRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length < 1000) {
      console.warn(`[TikWM API] Downloaded file is too small (${buffer.length} bytes), might be invalid.`);
      return null;
    }

    fs.writeFileSync(targetFilePath, buffer);
    console.log(`[TikWM API] Successfully downloaded ${buffer.length} bytes to ${targetFilePath}`);
    return {
      filePath: targetFilePath,
      mimeType,
      title,
      author,
      duration,
      platform,
    };
  } catch (err: any) {
    console.warn(`[TikWM API] Error occurred:`, err.message);
    return null;
  }
}

/**
 * Strategy 2: Direct Douyin Web API Extractor
 */
async function downloadViaDouyinApi(cleanUrl: string, fileId: string): Promise<DownloadedMedia | null> {
  try {
    // 1. Resolve redirect to obtain video aweme_id
    const redirectRes = await fetch(cleanUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
      },
      redirect: 'follow',
    });

    const finalUrl = redirectRes.url;
    const awemeIdMatch = finalUrl.match(/video\/(\d+)/) || finalUrl.match(/modal_id=(\d+)/);
    if (!awemeIdMatch || !awemeIdMatch[1]) {
      return null;
    }

    const itemId = awemeIdMatch[1];
    const infoRes = await fetch(`https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids=${itemId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
      },
    });

    if (!infoRes.ok) return null;
    const infoData = await infoRes.json();
    const item = infoData.item_list?.[0];
    if (!item) return null;

    const title = item.desc || 'Douyin Video';
    const author = item.author?.nickname || 'Douyin Creator';
    const duration = Math.round((item.duration || 30000) / 1000);

    // Audio stream or video stream
    const audioUrl = item.music?.play_url?.uri || item.music?.play_url?.url_list?.[0];
    const videoUrl = item.video?.play_addr?.url_list?.[0]?.replace('playwm', 'play');
    const targetUrl = audioUrl || videoUrl;

    if (!targetUrl) return null;

    const isAudio = Boolean(audioUrl);
    const extension = isAudio ? 'mp3' : 'mp4';
    const mimeType = isAudio ? 'audio/mp3' : 'video/mp4';
    const targetFilePath = path.join(TEMP_DIR, `${fileId}.${extension}`);

    const mediaRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        'Referer': 'https://www.douyin.com/',
      },
    });

    if (!mediaRes.ok) return null;

    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    const arrayBuffer = await mediaRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length < 1000) {
      return null;
    }

    fs.writeFileSync(targetFilePath, buffer);

    return {
      filePath: targetFilePath,
      mimeType,
      title,
      author,
      duration,
      platform: 'douyin',
    };
  } catch (err: any) {
    console.warn(`[Douyin Direct API] Error:`, err.message);
    return null;
  }
}

/**
 * Strategy 3: yt-dlp fallback with realistic browser headers & redirect resolution
 */
async function downloadViaYtDlp(cleanUrl: string, fileId: string, platform: 'tiktok' | 'douyin' | 'sample'): Promise<DownloadedMedia> {
  const ytDlpPath = await ensureYtDlp();
  const outputTemplate = path.join(TEMP_DIR, `${fileId}.%(ext)s`);

  let title = `${platform === 'douyin' ? 'Douyin' : 'TikTok'} Marketing Video`;
  let author = 'Creator';
  let duration = 30;

  const browserUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  const referer = platform === 'douyin' ? 'https://www.douyin.com/' : 'https://www.tiktok.com/';

  // Try extracting metadata
  try {
    const metaCmd = `"${ytDlpPath}" --no-warnings --dump-json --no-playlist --user-agent "${browserUserAgent}" --referer "${referer}" "${cleanUrl}"`;
    const { stdout } = await execPromise(metaCmd, { timeout: 20000 });
    if (stdout) {
      const meta = JSON.parse(stdout);
      title = meta.title || meta.description || title;
      author = meta.uploader || meta.channel || author;
      duration = meta.duration || duration;
    }
  } catch (e) {
    console.warn('yt-dlp metadata fetch skipped:', e);
  }

  // Download audio format
  try {
    const downloadCmd = `"${ytDlpPath}" -x --audio-format mp3 --audio-quality 0 --no-playlist --user-agent "${browserUserAgent}" --referer "${referer}" -o "${outputTemplate}" "${cleanUrl}"`;
    await execPromise(downloadCmd, { timeout: 45000 });

    const files = fs.readdirSync(TEMP_DIR).filter(f => f.startsWith(fileId));
    if (files.length === 0) {
      throw new Error('Downloaded file not found in temp directory.');
    }

    const downloadedFile = path.join(TEMP_DIR, files[0]);
    const ext = path.extname(downloadedFile).toLowerCase();
    const mimeType = ext === '.mp3' ? 'audio/mp3' : ext === '.m4a' ? 'audio/m4a' : 'audio/mpeg';

    return {
      filePath: downloadedFile,
      mimeType,
      title,
      author,
      duration,
      platform,
    };
  } catch (err: any) {
    console.error('yt-dlp download failed:', err);
    throw new Error(
      `Không thể kết nối tải video từ liên kết này (${err.message || 'Hạn chế bot hoặc video riêng tư'}). ` +
      `Bạn có thể chọn thử một "Video Mẫu Viral" có sẵn trong thư viện hoặc kéo thả file âm thanh/video trực tiếp để bóc tách ngay!`
    );
  }
}

/**
 * Main Download Function: Multi-strategy cascade
 */
export async function downloadMediaFromUrl(rawUrl: string): Promise<DownloadedMedia> {
  const cleanUrl = extractCleanUrl(rawUrl);
  const platform = identifyPlatform(cleanUrl);
  const fileId = `media_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  console.log(`[MediaExtractor] Processing ${platform.toUpperCase()} URL: ${cleanUrl}`);

  // 1. Try TikWM API first (fastest, solves TikTok & Douyin bot blocks)
  const tikWmResult = await downloadViaTikWmApi(cleanUrl, fileId, platform);
  if (tikWmResult) {
    return tikWmResult;
  }

  // 2. If Douyin, try Douyin Direct Web API
  if (platform === 'douyin') {
    const douyinResult = await downloadViaDouyinApi(cleanUrl, fileId);
    if (douyinResult) {
      return douyinResult;
    }
  }

  // 3. Fall back to optimized yt-dlp
  console.log('[MediaExtractor] Falling back to yt-dlp with custom headers...');
  return await downloadViaYtDlp(cleanUrl, fileId, platform);
}

/**
 * Removes temporary files from local disk
 */
export function cleanupLocalTempFile(filePath?: string) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[CleanUp] Removed local temp file: ${filePath}`);
    }
  } catch (err) {
    console.error(`[CleanUp Error] Failed to delete local temp file ${filePath}:`, err);
  }
}
