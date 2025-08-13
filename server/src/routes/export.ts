import express from 'express';
import path from 'path';
import fs from 'fs';
import { exportDocx, exportPdf, exportTxt, exportEpub } from '../utils/exporters';

interface ExportBody { filename?: string; format?: string; content: string; font?: string; }

export function exportRouter(fontsDir?: string) {
  const router = express.Router();

  router.post('/generate', async (req, res) => {
    try {
      const { filename = 'ocr-output', format = 'txt', content, font } = req.body as ExportBody;
      if (!content) return res.status(400).json({ error: 'Missing content' });

      let fontPath: string | undefined;
      let publicBaseFromReq: string | undefined;
      let fontUrl: string | undefined;
      // Compute public base URL from request (works on Vercel behind proxies)
      try {
        const xfProto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
        const xfHost = (req.headers['x-forwarded-host'] as string) || req.get('host') || '';
        if (xfHost) publicBaseFromReq = `${xfProto}://${xfHost}`;
        if (publicBaseFromReq && !process.env.PUBLIC_BASE_URL) process.env.PUBLIC_BASE_URL = publicBaseFromReq;
      } catch {}
      if (font && fontsDir) {
        // font expected as relative path like /fonts/Family/File.ttf
        // sanitize: ensure resolved path is inside fontsDir
        const rel = font.replace(/^\/fonts\//, '');
        const abs = path.join(fontsDir, rel);
        if (abs.startsWith(fontsDir) && fs.existsSync(abs) && abs.toLowerCase().endsWith('.ttf')) {
          fontPath = abs;
          if (process.env.PUBLIC_BASE_URL) fontUrl = `${process.env.PUBLIC_BASE_URL}/fonts/${rel}`;
        }
      }

      console.log(`[export] Format: ${format}, Font: ${font}, FontPath: ${fontPath}`);

      let file;
      if (format === 'txt') file = await exportTxt(filename, content);
      else if (format === 'docx') file = await exportDocx(filename, content, { fontFamily: font ? path.parse(font).name : undefined });
      else if (format === 'pdf') file = await exportPdf(filename, content, { fontPath, fontUrl });
      else if (format === 'epub') file = await exportEpub(filename, content, { fontPath });
      else return res.status(400).json({ error: 'Unsupported format' });
      return res.json(file);
    } catch (err: any) {
      console.error('Export error', err);
      res.status(500).json({ error: err?.message || 'Export failed' });
    }
  });

  return router;
}
