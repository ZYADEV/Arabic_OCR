import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ 
    ok: true, 
    provider: process.env.OCR_PROVIDER || 'gemini',
    timestamp: new Date().toISOString()
  });
}
