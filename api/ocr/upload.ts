import type { VercelRequest, VercelResponse } from '@vercel/node';

// Placeholder endpoint to keep client flow working in production without full OCR
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Minimal fake response that mimics the server contract used by the client
  res.status(200).json({
    results: [
      {
        filename: 'demo.txt',
        text: 'نموذج تجريبي — قم برفع ملفاتك في بيئة التطوير المحلية للحصول على OCR حقيقي.',
        model: 'mock',
        provider: 'gemini'
      }
    ]
  });
}


