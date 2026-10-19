import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Readable } from 'stream';

export const config = {
  maxDuration: 60,
};

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).send('Method Not Allowed');
  }

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
    const isDouyin = targetUrl.includes('douyin') || targetUrl.includes('snssdk.com');

    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Referer': isDouyin ? 'https://www.douyin.com/' : 'https://www.tiktok.com/',
      'Accept': '*/*',
    };

    if (range) {
      headers['Range'] = range;
    }

    const upstreamRes = await fetch(targetUrl, {
      method: req.method,
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

    if (req.method === 'HEAD' || !upstreamRes.body) {
      return res.end();
    }

    // Stream video directly from upstream CDN to client browser
    const nodeStream = Readable.fromWeb(upstreamRes.body as any);
    nodeStream.pipe(res);
  } catch (err: any) {
    console.error('[Proxy Media Exception]:', err);
    if (!res.headersSent) {
      res.status(500).send(err.message || 'Error streaming media');
    }
  }
}
