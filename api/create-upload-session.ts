export const config = {
  maxDuration: 30,
};

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

    const { fileName, mimeType, size } = body || {};
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

    return res.status(200).json({
      success: true,
      uploadUrl,
    });
  } catch (err: any) {
    console.error('[Create Upload Session Exception]:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Lỗi khởi tạo tải tệp.',
    });
  }
}
