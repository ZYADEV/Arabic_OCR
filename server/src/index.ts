import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { ocrRouter } from './routes/ocr';
import { exportRouter } from './routes/export';

dotenv.config();

const app = express();

// Enhanced CORS for production
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-vercel-domain.vercel.app'] 
    : true,
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// __dirname available under CommonJS transpilation.

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
const absUpload = path.join(__dirname, '..', UPLOAD_DIR);
const FONTS_DIR = path.join(__dirname, '..', 'fonts');
if (!fs.existsSync(absUpload)) fs.mkdirSync(absUpload, { recursive: true });
if (!fs.existsSync(FONTS_DIR)) fs.mkdirSync(FONTS_DIR, { recursive: true });

// Static serve uploads for debugging (optional)
app.use('/uploads', express.static(absUpload));
app.use('/fonts', express.static(FONTS_DIR));
// Enable CORS/headers for fonts to allow cross-origin loading from Vite dev server
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, provider: process.env.OCR_PROVIDER || 'gemini' });
});

app.use('/api/ocr', ocrRouter(absUpload));
// Fonts listing endpoint
app.get('/api/fonts', (_req, res) => {
  try {
    const families = fs.readdirSync(FONTS_DIR).filter(d => {
      try { return fs.statSync(path.join(FONTS_DIR, d)).isDirectory(); } catch { return false; }
    });
    const list: { family: string; regular: string | null; variants: string[] }[] = [];
    for (const fam of families) {
      const dir = path.join(FONTS_DIR, fam);
      const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.ttf'));
      const variants = files.map(f => `/fonts/${fam}/${f}`);
      let regular = files.find(f => /regular/i.test(f));
      if (!regular && files.length) regular = files[0];
      list.push({ family: fam, regular: regular ? `/fonts/${fam}/${regular}` : null, variants });
    }
    res.json({ fonts: list });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Font list failed' });
  }
});

app.use('/api/export', exportRouter(FONTS_DIR));

async function start() {
  if ((global as any).__OCR_SERVER_STARTED) return;
  (global as any).__OCR_SERVER_STARTED = true;
  let port = Number(process.env.PORT || 5174);
  const maxTries = 5;
  for (let i = 0; i < maxTries; i++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const srv = app.listen(port, () => {
          console.log(`[server] listening on http://localhost:${port}`);
          resolve();
        });
        srv.on('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            port += 1; // try next port
            srv.close();
            reject(err);
          } else reject(err);
        });
      });
      break; // started
    } catch (e: any) {
      if (e.code !== 'EADDRINUSE') {
        console.error('Server start error', e);
        break;
      }
      if (i === maxTries - 1) console.error('Exhausted port attempts');
    }
  }
}

start();
