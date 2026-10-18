import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';

export const config = {
  maxDuration: 60,
};

export default async function handler(request: any, response: any) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-gemini-api-key, X-Gemini-Api-Key');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  let body = request.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  try {
    const jsonResponse = await handleUpload({
      body: body as HandleUploadBody,
      request,
      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: [
            'video/mp4',
            'video/quicktime',
            'video/webm',
            'video/x-matroska',
            'audio/mp3',
            'audio/mpeg',
            'audio/m4a',
            'audio/wav',
            'audio/aac',
            'audio/ogg',
          ],
          maximumSizeInBytes: 500 * 1024 * 1024, // Up to 500MB via Vercel Blob Client Upload
          tokenPayload: JSON.stringify({}),
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log('[Vercel Blob] Upload completed:', blob.url);
      },
    });

    return response.status(200).json(jsonResponse);
  } catch (error: any) {
    console.error('[Vercel Blob HandleUpload Error]:', error);
    return response.status(400).json({ error: error.message });
  }
}
