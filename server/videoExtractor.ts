import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import util from 'util';
import vm from 'node:vm';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

const execPromise = util.promisify(exec);
const TEMP_DIR = path.join(os.tmpdir(), 'tiktok_douyin_media');

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
 * Extracts pure URL from messy share text and normalizes special patterns (modal_id, etc.)
 */
export function extractCleanUrl(text: string): string {
  const urlMatch = text.match(/https?:\/\/[^\s"'<>]+/);
  let clean = urlMatch ? urlMatch[0] : text.trim();

  // Normalize Douyin modal_id link: e.g. https://www.douyin.com/jingxuan?modal_id=7696795427303181568
  const douyinModalMatch = clean.match(/douyin\.com\/.*?modal_id=(\d+)/i);
  if (douyinModalMatch && douyinModalMatch[1]) {
    // Keep original or provide direct aweme link for flexibility
    return clean;
  }
  return clean;
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
 * Ensures yt-dlp is available in os.tmpdir() or system PATH
 */
export async function ensureYtDlp(): Promise<string> {
  const isWindows = process.platform === 'win32';
  const binaryName = isWindows ? 'yt-dlp.exe' : 'yt-dlp';
  const binaryPath = path.join(os.tmpdir(), binaryName);
  if (fs.existsSync(binaryPath)) {
    return binaryPath;
  }
  
  try {
    const whichCmd = isWindows ? 'where yt-dlp' : 'which yt-dlp';
    const { stdout } = await execPromise(whichCmd);
    if (stdout.trim()) {
      return stdout.trim().split(/\r?\n/)[0];
    }
  } catch {
    // not in PATH
  }

  // Download standalone binary
  try {
    const downloadUrl = isWindows
      ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
      : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
    const curlCmd = isWindows
      ? `curl -L "${downloadUrl}" -o "${binaryPath}"`
      : `curl -L "${downloadUrl}" -o "${binaryPath}" && chmod +x "${binaryPath}"`;
    await execPromise(curlCmd);
    return binaryPath;
  } catch (err) {
    console.error('Failed to download yt-dlp:', err);
    throw new Error('yt-dlp is not available and could not be downloaded.');
  }
}

/**
 * Strategy 1: ByteDance Acrawler & RENDER_DATA Direct Video Extractor (Douyin)
 * Solves Douyin WAF/anti-crawler challenge by calculating __ac_signature via byted_acrawler in a sandbox
 */
async function downloadViaDouyinRenderData(cleanUrl: string, fileId: string): Promise<DownloadedMedia | null> {
  try {
    console.log(`[Douyin Acrawler] Extracting video directly via RENDER_DATA from: ${cleanUrl}`);
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

    // Step 1: Initial request to obtain challenge script and __ac_nonce
    const res1 = await fetch(cleanUrl, {
      headers: { 'User-Agent': ua }
    });
    const html1 = await res1.text();
    const cookies1 = res1.headers.getSetCookie ? res1.headers.getSetCookie() : [];
    const nonceMatch = cookies1.join('; ').match(/__ac_nonce=([^;]+)/);
    if (!nonceMatch) {
      console.warn('[Douyin Acrawler] No __ac_nonce returned');
      return null;
    }
    const nonce = nonceMatch[1];

    const scripts = html1.match(/<script>([\s\S]*?)<\/script>/g) || [];
    if (scripts.length === 0) return null;
    const s0 = scripts[0].replace(/^<script>/, '').replace(/<\/script>$/, '');

    // Step 2: Run byted_acrawler script in VM sandbox to calculate signature
    const sandbox = {
      window: {},
      navigator: { userAgent: ua, appVersion: '5.0 (Windows NT 10.0; Win64; x64)', platform: 'Win32', plugins: [] },
      document: { referrer: 'https://www.douyin.com/', cookie: '__ac_nonce=' + nonce, getElementsByTagName: () => [], createElement: () => ({ setAttribute: () => {} }) },
      location: { protocol: 'https:', href: cleanUrl, reload: () => {} },
      sessionStorage: { setItem: () => {}, getItem: () => null },
      localStorage: { setItem: () => {}, getItem: () => null },
      performance: { timing: { navigationStart: Date.now() } },
      console: { log: () => {}, warn: () => {}, error: () => {} },
      setTimeout: setTimeout,
    };
    sandbox.window = sandbox;
    (sandbox as any).global = sandbox;
    (sandbox as any).self = sandbox;

    const ctx = vm.createContext(sandbox);
    vm.runInContext(s0, ctx);

    if (!(sandbox as any).byted_acrawler) {
      console.warn('[Douyin Acrawler] byted_acrawler not found in sandbox');
      return null;
    }

    (sandbox as any).byted_acrawler.init({ aid: 99999999, dfp: 0 });
    const signature = (sandbox as any).byted_acrawler.sign('', nonce);
    if (!signature) {
      console.warn('[Douyin Acrawler] Signature generation failed');
      return null;
    }

    // Step 3: Request page with authenticated challenge cookies
    const cookieHeader = `__ac_nonce=${nonce}; __ac_signature=${signature};`;
    const pageRes = await fetch(cleanUrl, {
      headers: {
        'User-Agent': ua,
        'Cookie': cookieHeader,
        'Referer': 'https://www.douyin.com/'
      }
    });
    const pageHtml = await pageRes.text();

    // Step 4: Parse RENDER_DATA
    const renderDataMatch = pageHtml.match(/<script id=\"RENDER_DATA\"[^>]*>(.*?)<\/script>/);
    if (!renderDataMatch) {
      console.warn('[Douyin Acrawler] RENDER_DATA not found in response');
      return null;
    }

    const rawData = decodeURIComponent(renderDataMatch[1]);
    const parsed = JSON.parse(rawData);

    // Modal ID check
    const modalMatch = cleanUrl.match(/modal_id=(\d+)/) || cleanUrl.match(/video\/(\d+)/);
    const targetAwemeId = modalMatch ? modalMatch[1] : '';

    function findAweme(obj: any): any {
      if (!obj || typeof obj !== 'object') return null;
      if (targetAwemeId && (obj.awemeId === targetAwemeId || obj.aweme_id === targetAwemeId)) {
        return obj;
      }
      if (obj.video && (obj.desc || obj.itemTitle)) {
        return obj;
      }
      for (const k of Object.keys(obj)) {
        const found = findAweme(obj[k]);
        if (found) return found;
      }
      return null;
    }

    const item = findAweme(parsed);
    if (!item || !item.video) {
      console.warn('[Douyin Acrawler] No video item found in RENDER_DATA');
      return null;
    }

    const title = item.desc || item.itemTitle || 'Douyin Video';
    const author = item.authorInfo?.nickname || item.author?.nickname || 'Douyin Creator';
    const duration = Math.round((item.video.duration || 30000) / 1000);

    // Get MP4 video stream URL
    let videoStreamUrl = item.video.playAddr?.[0]?.src || item.video.play_addr?.url_list?.[0];
    if (!videoStreamUrl && Array.isArray(item.video.playApiList)) {
      videoStreamUrl = item.video.playApiList[0];
    }

    if (!videoStreamUrl) {
      console.warn('[Douyin Acrawler] No video stream URL found in item.video');
      return null;
    }

    console.log(`[Douyin Acrawler] Downloading full MP4 video for "${title}"...`);
    const targetFilePath = path.join(TEMP_DIR, `${fileId}.mp4`);

    const streamRes = await fetch(videoStreamUrl, {
      headers: {
        'User-Agent': ua,
        'Referer': 'https://www.douyin.com/'
      }
    });

    if (!streamRes.ok) {
      console.warn(`[Douyin Acrawler] Stream fetch failed with status ${streamRes.status}`);
      return null;
    }

    const buffer = Buffer.from(await streamRes.arrayBuffer());
    if (buffer.length < 5000) {
      console.warn(`[Douyin Acrawler] Downloaded buffer too small: ${buffer.length} bytes`);
      return null;
    }

    fs.writeFileSync(targetFilePath, buffer);
    console.log(`[Douyin Acrawler] Successfully downloaded ${buffer.length} bytes (~${(buffer.length / 1024 / 1024).toFixed(2)} MB) to ${targetFilePath}`);

    return {
      filePath: targetFilePath,
      mimeType: 'video/mp4',
      title,
      author,
      duration,
      platform: 'douyin',
    };
  } catch (err: any) {
    console.warn('[Douyin Acrawler Error]:', err.message);
    return null;
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

    // Always prioritize the full VIDEO stream (MP4) because TikTok/Douyin videos often have 
    // AI text-to-speech voiceovers or custom voice dubbing mixed into the video track,
    // while videoData.music only contains the raw background music track without the spoken dialogue.
    const mediaStreamUrl = videoData.play || videoData.wmplay || videoData.music;
    if (!mediaStreamUrl) {
      console.warn('[TikWM API] No stream URL found in payload.');
      return null;
    }

    const isVideo = Boolean(videoData.play || videoData.wmplay || (!videoData.music && mediaStreamUrl));
    const extension = isVideo ? 'mp4' : 'mp3';
    const mimeType = isVideo ? 'video/mp4' : 'audio/mp3';
    const targetFilePath = path.join(TEMP_DIR, `${fileId}.${extension}`);

    console.log(`[TikWM API] Downloading full video/media stream (${extension})...`);
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

    // Always prioritize the full video stream to capture AI voices, voiceovers and on-screen dialogue
    const videoUrl = item.video?.play_addr?.url_list?.[0]?.replace('playwm', 'play');
    const audioUrl = item.music?.play_url?.uri || item.music?.play_url?.url_list?.[0];
    const targetUrl = videoUrl || audioUrl;

    if (!targetUrl) return null;

    const isVideo = Boolean(videoUrl);
    const extension = isVideo ? 'mp4' : 'mp3';
    const mimeType = isVideo ? 'video/mp4' : 'audio/mp3';
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

  // Download full video format (MP4) to preserve all spoken dialogue & on-screen audio
  try {
    const downloadCmd = `"${ytDlpPath}" -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --no-playlist --user-agent "${browserUserAgent}" --referer "${referer}" -o "${outputTemplate}" "${cleanUrl}"`;
    await execPromise(downloadCmd, { timeout: 60000 });

    const files = fs.readdirSync(TEMP_DIR).filter(f => f.startsWith(fileId));
    if (files.length === 0) {
      throw new Error('Downloaded file not found in temp directory.');
    }

    const downloadedFile = path.join(TEMP_DIR, files[0]);
    const ext = path.extname(downloadedFile).toLowerCase();
    const mimeType = ext === '.mp4' ? 'video/mp4' : ext === '.mp3' ? 'audio/mp3' : 'video/mp4';

    return {
      filePath: downloadedFile,
      mimeType,
      title,
      author,
      duration,
      platform,
    };
  } catch (err: any) {
    console.warn('yt-dlp video download fallback to audio:', err.message);
    try {
      const audioCmd = `"${ytDlpPath}" -x --audio-format mp3 --audio-quality 0 --no-playlist --user-agent "${browserUserAgent}" --referer "${referer}" -o "${outputTemplate}" "${cleanUrl}"`;
      await execPromise(audioCmd, { timeout: 45000 });
      const files = fs.readdirSync(TEMP_DIR).filter(f => f.startsWith(fileId));
      if (files.length > 0) {
        const downloadedFile = path.join(TEMP_DIR, files[0]);
        return {
          filePath: downloadedFile,
          mimeType: 'audio/mp3',
          title,
          author,
          duration,
          platform,
        };
      }
    } catch {}
    throw new Error(
      `Không thể kết nối tải video từ liên kết này (${err.message || 'Hạn chế bot hoặc video riêng tư'}). ` +
      `Bạn có thể chọn thử một "Video Mẫu Viral" có sẵn trong thư viện hoặc kéo thả file âm thanh/video trực tiếp để bóc tách ngay!`
    );
  }
}

/**
 * Main Download Function: Multi-strategy cascade
 * Always prioritizes full VIDEO (MP4) to capture original dialogue, voiceovers & on-screen text,
 * preventing accidental capture of TikTok/Douyin background music sounds.
 */
export async function downloadMediaFromUrl(rawUrl: string): Promise<DownloadedMedia> {
  const cleanUrl = extractCleanUrl(rawUrl);
  const platform = identifyPlatform(cleanUrl);
  const fileId = `media_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  console.log(`[MediaExtractor] Processing ${platform.toUpperCase()} URL: ${cleanUrl}`);

  if (platform === 'douyin') {
    // 1. Try ByteDance Acrawler & RENDER_DATA direct MP4 video extractor (handles modal_id, jingxuan, share links)
    const douyinRenderResult = await downloadViaDouyinRenderData(cleanUrl, fileId);
    if (douyinRenderResult) {
      return douyinRenderResult;
    }

    // 2. Try Douyin Direct Web API
    const douyinResult = await downloadViaDouyinApi(cleanUrl, fileId);
    if (douyinResult) {
      return douyinResult;
    }

    // 3. Try TikWM API
    const tikWmResult = await downloadViaTikWmApi(cleanUrl, fileId, platform);
    if (tikWmResult) {
      return tikWmResult;
    }

    // 4. Fall back to yt-dlp
    console.log('[MediaExtractor] Falling back to yt-dlp for Douyin...');
    return await downloadViaYtDlp(cleanUrl, fileId, platform);
  }

  // TikTok platform
  // 1. Try TikWM API first (fastest, extracts full MP4 video stream with audio track)
  const tikWmResult = await downloadViaTikWmApi(cleanUrl, fileId, platform);
  if (tikWmResult) {
    return tikWmResult;
  }

  // 2. Fall back to yt-dlp
  console.log('[MediaExtractor] Falling back to yt-dlp for TikTok...');
  return await downloadViaYtDlp(cleanUrl, fileId, platform);
}

/**
 * Extracts audio track from large user-uploaded video files using ffmpeg
 * Keeps payload lightweight while preserving full spoken dialogue
 */
export async function extractAudioIfVideoTooLarge(
  inputFilePath: string,
  maxSizeBytes: number = 15 * 1024 * 1024
): Promise<{ filePath: string; mimeType: string }> {
  try {
    if (!fs.existsSync(inputFilePath)) {
      return { filePath: inputFilePath, mimeType: 'video/mp4' };
    }

    const stats = fs.statSync(inputFilePath);
    const ext = path.extname(inputFilePath).toLowerCase();
    const isVideo = ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.flv'].includes(ext);

    // If file is smaller than threshold or not a video, keep original
    if (!isVideo || stats.size <= maxSizeBytes) {
      return {
        filePath: inputFilePath,
        mimeType: isVideo ? 'video/mp4' : 'audio/mp3',
      };
    }

    console.log(`[Upload Optimization] File is large video (${(stats.size / 1024 / 1024).toFixed(2)} MB), extracting MP3 audio via ffmpeg...`);
    const outputAudioPath = inputFilePath.replace(/\.[^/.]+$/, '_extracted.mp3');

    // Run ffmpeg to extract lightweight mp3 audio
    const ffmpegCmd = `ffmpeg -y -i "${inputFilePath}" -vn -acodec libmp3lame -ab 128k -ar 44100 "${outputAudioPath}"`;
    await execPromise(ffmpegCmd, { timeout: 60000 });

    if (fs.existsSync(outputAudioPath) && fs.statSync(outputAudioPath).size > 1000) {
      const audioStats = fs.statSync(outputAudioPath);
      console.log(`[Upload Optimization] Successfully extracted audio: ${(audioStats.size / 1024 / 1024).toFixed(2)} MB (reduced from ${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      // Delete heavy original video file
      try {
        fs.unlinkSync(inputFilePath);
      } catch {}
      return {
        filePath: outputAudioPath,
        mimeType: 'audio/mp3',
      };
    }
  } catch (err: any) {
    console.warn('[Upload Optimization] ffmpeg extraction skipped:', err.message);
  }

  return { filePath: inputFilePath, mimeType: 'video/mp4' };
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
