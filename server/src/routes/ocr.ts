import express from 'express';
import multer from 'multer';
import path from 'path';
import { processWithGemini } from '../ocrProviders/gemini';
import { processWithMistral } from '../ocrProviders/mistral';

const storage = (dest: string) => multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, dest),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

function pickProvider(fromHeader?: string | string[]) {
  const configured = (process.env.OCR_PROVIDER || 'gemini').toLowerCase();
  const header = (Array.isArray(fromHeader) ? fromHeader[0] : fromHeader)?.toLowerCase();
  const provider = header === 'mistral' || header === 'gemini' ? header : configured;
  if (provider === 'mistral') return processWithMistral;
  return processWithGemini;
}

export function ocrRouter(uploadDir: string) {
  const router = express.Router();
  const upload = multer({ storage: storage(uploadDir), limits: { fileSize: 25 * 1024 * 1024 } });

  // Ensure upload directory exists at runtime (especially important on serverless tmp)
  try {
    const fs = require('fs') as typeof import('fs');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  } catch {}

  // Single or batch
  router.post('/upload', upload.array('files', 20), async (req, res) => {
    try {
      const files = (req.files || []) as Express.Multer.File[];
      if (!files.length) return res.status(400).json({ error: 'No files uploaded' });

  const providerFn = pickProvider(req.headers['x-ocr-provider']);
    const results = await Promise.all(files.map(async (f) => {
        const ext = path.extname(f.originalname).toLowerCase();
        try {
          return await providerFn({ filePath: f.path, filename: f.originalname, ext });
        } catch (e: any) {
      const prov = (req.headers['x-ocr-provider'] as string) || process.env.OCR_PROVIDER || 'gemini';
      return { filename: f.originalname, text: `OCR fallback (${prov}) error: ${e?.message || 'unknown'}`, model: 'fallback', provider: prov as any } as any;
        }
      }));

      res.json({ results });
    } catch (err: any) {
      console.error('OCR Error', err);
      res.status(500).json({ error: err?.message || 'OCR failed' });
    }
  });

  return router;
}
