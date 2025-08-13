import type { VercelRequest, VercelResponse } from '@vercel/node';

// Lightweight export placeholder to keep UI working on Vercel.
// For real PDF/EPUB/DOCX generation, run the full Express server locally.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { filename = 'ocr-ar', format = 'txt', content = '' } = (req.body || {}) as any;

  const safeName = String(filename || 'ocr-ar').replace(/\W+/g, '-');
  const formats: Record<string, string> = {
    txt: 'text/plain;charset=utf-8',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pdf: 'application/pdf',
    epub: 'application/epub+zip'
  };
  const mime = formats[String(format)] || 'text/plain;charset=utf-8';

  // Generate a minimal buffer just to download something
  const outText = `\u202E${String(content || 'نموذج ملف تجريبي من بيئة Vercel — قم بالتشغيل محلياً لتصدير كامل.')}\u202C`;
  const buf = Buffer.from(outText, 'utf8');

  res.status(200).json({ filename: `${safeName}.${format}`, mime, base64: buf.toString('base64') });
}


