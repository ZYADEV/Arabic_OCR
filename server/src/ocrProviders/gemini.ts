import fs from 'fs/promises';
import axios from 'axios';

export type OCRResult = { filename: string; text: string; model: string; provider: 'gemini'; };

export async function processWithGemini(input: { filePath: string; filename: string; ext: string; }): Promise<OCRResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY');

  const buffer = await fs.readFile(input.filePath);
  const mime = guessMime(input.ext);
  const base64 = buffer.toString('base64');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const prompt = `أنت متخصص في التعرف الضوئي على الحروف (OCR) للغة العربية. استخرج النص بدقة مع الحفاظ على الفقرات والقوائم والجداول قدر الإمكان. أعِد النتيجة بتنسيق Markdown نظيف.`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mime, data: base64 } }
        ]
      }
    ]
  };

  const { data } = await axios.post(url, payload, { timeout: 120000 });
  const text: string = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('\n') || '';

  return { filename: input.filename, text, model, provider: 'gemini' };
}

function guessMime(ext: string) {
  switch (ext) {
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.webp': return 'image/webp';
    case '.pdf': return 'application/pdf';
    case '.tif':
    case '.tiff': return 'image/tiff';
    default: return 'application/octet-stream';
  }
}
