import { SAMPLE_VIDEOS } from '../server/sampleData';

export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    success: true,
    samples: SAMPLE_VIDEOS,
  });
}
