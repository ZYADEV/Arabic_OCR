import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { UploadIcon, OCRIcon, DownloadIcon, TwitterIcon, GitHubIcon, TelegramIcon, YouTubeIcon, SunIcon, MoonIcon } from './components/Icons';
import logo from './assets/logo.jpg';

interface OCRItem {
  filename: string;
  text: string;
  model: string;
  provider: 'gemini' | 'mistral';
}

function App() {
  // Point axios to server Vercel URL when provided
  axios.defaults.baseURL = (import.meta as any).env?.VITE_API_BASE || '';
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<OCRItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<'gemini' | 'mistral'>('gemini');
  const [format, setFormat] = useState<'txt' | 'docx' | 'pdf' | 'epub'>('txt');
  const [fonts, setFonts] = useState<{ family: string; regular: string | null; variants: string[] }[]>([]);
  const [fontModal, setFontModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  // selectedFont is the chosen TTF path under /fonts. We persist to localStorage and also apply to UI via a dynamic @font-face.
  const [selectedFont, setSelectedFont] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePick = () => inputRef.current?.click();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setFiles(Array.from(e.target.files));
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files);
    setFiles(dropped);
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();

  const onUpload = async () => {
    if (!files.length) return;
    setLoading(true);
    try {
      // switch provider via env on server; but we also support overriding via header
      const form = new FormData();
      files.forEach(f => form.append('files', f));
      const { data } = await axios.post('/api/ocr/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data', 'x-ocr-provider': provider }
      });
      setResults(data.results);
    } catch (err) {
      console.error(err);
      alert('فشل التحويل');
    } finally {
      setLoading(false);
    }
  };

  // Merge without filename headings per requirement
  const mergedText = useMemo(() => results.map(r => r.text).join('\n\n---\n\n'), [results]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get('/api/fonts');
        setFonts(data.fonts || []);
      } catch {}
      // Load persisted font
      const persisted = localStorage.getItem('arabic_font_path');
      if (persisted) applyUiFont(persisted); else setFontModal(true);
    })();
  }, []);

  const applyUiFont = (fontPath: string) => {
    setSelectedFont(fontPath);
    localStorage.setItem('arabic_font_path', fontPath);
    
    // Use Google Fonts for UI instead of local TTF files for better reliability
    const fontFamily = fontPath.includes('Amiri') ? '"Amiri", serif' : '"Cairo", sans-serif';
    
    // Apply font to the entire app
    document.documentElement.style.fontFamily = fontFamily;
    document.body.style.fontFamily = fontFamily;
    
    // Set CSS custom property for consistent usage
    document.documentElement.style.setProperty('--ui-font', fontFamily);
  };

  const exportFile = async () => {
    if (!mergedText) return;
    // If no font chosen yet, ask once before first export so the same font applies to all types
    if (!selectedFont) {
      setFontModal(true);
      return;
    }
    try {
      // Client-side HTML → PDF (avoids serverless headless browser limits)
      if (format === 'pdf') {
        const useServer = true; // prefer server if BROWSERLESS_URL is configured
        if (useServer) {
          setGenerating(true);
          const { data } = await axios.post('/api/export/generate', {
            filename: 'ocr-ar',
            format: 'pdf',
            content: mergedText,
            font: selectedFont || undefined
          });
          setGenerating(false);
          const { filename, mime, base64 } = data || {};
          if (!base64) throw new Error('No PDF data');
          const byteChars = atob(base64);
          const bytes = new Uint8Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
          const blob = new Blob([bytes], { type: mime || 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = filename || 'ocr-ar.pdf'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
          return;
        } else {
          await exportPdfClient(mergedText, selectedFont);
          return;
        }
      }
      const { data } = await axios.post('/api/export/generate', {
        filename: 'ocr-ar',
        format,
        content: mergedText,
        font: selectedFont || undefined
      });
      const { filename, mime, base64 } = data;
      if (!base64) throw new Error('No file data');
      const byteChars = atob(base64);
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error(e);
      alert('فشل التصدير: ' + (e?.message || ''));
      setGenerating(false);
    }
  };

  // Generate PDF on the client; primary: pdfmake (RTL), fallback: html2pdf/print
  async function exportPdfClient(content: string, fontPath: string) {
    const base = (import.meta as any).env?.VITE_API_BASE || axios.defaults.baseURL || '';
    const absFontUrl = base ? `${base}${fontPath}` : fontPath;

    // Load font explicitly so it's ready for html2canvas
    try {
      const ff = new FontFace('UserFont', `url(${absFontUrl})`);
      await ff.load();
      (document as any).fonts.add(ff);
      await (document as any).fonts.ready;
    } catch {}

    // Primary: pdfmake
    try {
      const pdfMake: any = await loadPdfMake();
      const fontB64 = await fetchBase64(absFontUrl);
      pdfMake.vfs = pdfMake.vfs || {};
      pdfMake.vfs['UserFont.ttf'] = fontB64;
      pdfMake.fonts = { UserFont: { normal: 'UserFont.ttf', bold: 'UserFont.ttf', italics: 'UserFont.ttf', bolditalics: 'UserFont.ttf' } };

      const blocks = content
        .split(/\n{2,}/)
        .map(p => p.trim())
        .filter(Boolean);

      const nodes: any[] = [];
      for (const b of blocks) {
        const single = b.replace(/\n+/g, ' ').trim();
        if (/^##\s+/.test(single)) {
          nodes.push({ text: single.replace(/^##\s+/, ''), fontSize: 18, bold: true, alignment: 'right', margin: [0, 6, 0, 4], rtl: true });
        } else if (/^#\s+/.test(single)) {
          nodes.push({ text: single.replace(/^#\s+/, ''), fontSize: 22, bold: true, alignment: 'right', margin: [0, 10, 0, 6], rtl: true });
        } else {
          nodes.push({ text: single, fontSize: 14, alignment: 'justify', margin: [0, 2, 0, 0], rtl: true });
        }
      }
      if (!nodes.length && content.trim()) {
        nodes.push({ text: content.trim().replace(/\n+/g, ' '), fontSize: 14, alignment: 'justify', margin: [0,2,0,0], rtl: true });
      }

      const doc: any = {
        pageSize: 'A4',
        pageMargins: [28, 28, 28, 28],
        defaultStyle: { font: 'UserFont', fontSize: 14, alignment: 'right' },
        content: nodes,
        rtl: true
      };
      const pdf = pdfMake.createPdf(doc);
      pdf.getBlob((blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ocr-ar.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      });
      return;
    } catch {}

    // Final fallback: native print window (never empty)
    await exportPdfViaPrint(`<div dir=\"rtl\" style=\"direction:rtl;text-align:right;font-size:16px;line-height:1.9\">${content.replace(/\n/g,'<br/>')}</div>`, absFontUrl);
  }

  function loadHtml2Pdf(): Promise<any> { return Promise.reject('disabled'); }
  function loadPdfMake(): Promise<any> {
    return new Promise((resolve, reject) => {
      const w = window as any;
      if (w.pdfMake) return resolve(w.pdfMake);
      let loaded = 0;
      const whenReady = () => {
        const inst = (window as any).pdfMake;
        if (inst && inst.createPdf) resolve(inst);
      };
      const s1 = document.createElement('script');
      s1.src = 'https://cdn.jsdelivr.net/npm/pdfmake@0.2.10/build/pdfmake.min.js';
      const s2 = document.createElement('script');
      s2.src = 'https://cdn.jsdelivr.net/npm/pdfmake@0.2.10/build/vfs_fonts.js';
      s1.onload = () => { loaded++; setTimeout(whenReady, 50); };
      s2.onload = () => { loaded++; setTimeout(whenReady, 50); };
      s1.onerror = reject; s2.onerror = reject;
      document.head.appendChild(s1);
      document.head.appendChild(s2);
    });
  }
  async function fetchBase64(url: string): Promise<string> {
    const res = await fetch(url, { mode: 'cors' });
    const buf = await res.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  async function exportPdfViaPrint(inner: string, fontUrl: string) {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.open();
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
      <style>
        @page { size: A4; margin: 20mm; }
        @font-face { font-family: 'UserFont'; src: url(${fontUrl}) format('truetype'); font-weight: normal; font-style: normal; font-display: swap; }
        html, body { direction: rtl; text-align: right; font-family: 'UserFont', 'Amiri', 'Cairo', serif; }
        h1{font-size:24px;font-weight:700;margin:0 0 12px 0}
        h2{font-size:18px;font-weight:700;margin:12px 0}
        p{font-size:16px;line-height:1.9;margin:8px 0;text-align:justify;text-align-last:right}
      </style>
    </head><body>${inner}</body></html>`);
    w.document.close();
    try {
      // Wait a bit for fonts to load before printing
      await new Promise(r => setTimeout(r, 500));
      w.focus();
      w.print();
    } catch {}
  }

  const [dark, setDark] = useState<boolean>(() => localStorage.getItem('theme') === 'dark');
  const [scrolled, setScrolled] = useState(false);
  
  useEffect(() => {
    const clsLight = 'theme-light';
    const clsDark = 'theme-dark';
    document.body.classList.remove(dark ? clsLight : clsDark);
    document.body.classList.add(dark ? clsDark : clsLight);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <header className={`sticky top-0 z-10 transition-all duration-300 ${scrolled ? 'header-blur' : ''}`}>
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">OCR العربية</h1>
          <div className="flex items-center gap-3">
            <button onClick={() => setDark(v => !v)} className="p-2 rounded glass hover:scale-110 transition-transform">
              {dark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
            </button>
            <select value={provider} onChange={e => setProvider(e.target.value as any)} className="glass rounded-lg px-3 py-1">
              <option value="gemini">Gemini</option>
              <option value="mistral">Mistral</option>
            </select>
            <button onClick={() => setFontModal(true)} className="text-sm px-3 py-2 rounded glass">تغيير الخط</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto flex-1 px-4 py-8">
        {generating && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
            <div className="glass rounded-xl p-6 text-center">
              <div className="mb-3 text-lg">جاري تجهيز ملف PDF…</div>
              <div className="w-64 h-2 bg-neutral-300/40 rounded overflow-hidden"><div className="h-full bg-blue-600 animate-pulse" /></div>
            </div>
          </div>
        )}
        <section onDrop={onDrop} onDragOver={onDragOver} className="rounded-2xl p-8 text-center glass border-2 border-dashed border-[var(--card-border)]">
          <div className="flex flex-col items-center gap-4">
            <UploadIcon className="w-12 h-12 text-neutral-500" />
            <p className="text-lg">اسحب وأفلت الصور أو ملفات PDF هنا</p>
            <div className="flex items-center gap-2">
              <button onClick={handlePick} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--text)] text-[var(--bg)] hover:opacity-90">
                <UploadIcon className="w-4 h-4" />
                تصفح الملفات
              </button>
              <input ref={inputRef} type="file" accept="image/*,.pdf" multiple onChange={onFileChange} className="hidden" />
              <button onClick={onUpload} disabled={loading || !files.length} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white disabled:opacity-50">
                <OCRIcon className="w-4 h-4" />
                {loading ? 'جاري المعالجة…' : 'ابدأ OCR'}
              </button>
            </div>
            {!!files.length && <p className="text-sm text-neutral-600">{files.length} ملف مختار</p>}
          </div>
        </section>

        {!!results.length && (
          <section className="mt-8 grid md:grid-cols-2 gap-6">
            <div className="glass rounded-xl p-4">
              <h2 className="font-semibold mb-2">النتائج</h2>
              <ul className="space-y-3">
                {results.map((r, idx) => (
                  <li key={idx} className="glass rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{r.filename}</span>
                      <span className="text-xs text-neutral-500">{r.provider} / {r.model}</span>
                    </div>
                    <pre className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{r.text}</pre>
                  </li>
                ))}
              </ul>
            </div>
            <div className="glass rounded-xl p-4">
              <h2 className="font-semibold mb-2">تصدير</h2>
              <div className="flex items-center gap-2 mb-3">
                <select value={format} onChange={e => setFormat(e.target.value as any)} className="glass rounded-lg px-3 py-1">
                  <option value="txt">.txt</option>
                  <option value="docx">.docx</option>
                  <option value="pdf">.pdf</option>
                  <option value="epub">Kindle (.epub)</option>
                </select>
                                 <button onClick={exportFile} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                   <DownloadIcon className="w-4 h-4" />
                   تنزيل
                 </button>
                 {selectedFont && <span className="text-xs text-neutral-500">الخط: {selectedFont.split('/').pop()}</span>}
              </div>
              <h3 className="font-medium">معاينة مدمجة</h3>
              <pre className="mt-2 whitespace-pre-wrap text-sm leading-relaxed max-h-[400px] overflow-auto">{mergedText}</pre>
            </div>
          </section>
        )}
      </main>

      <footer className="text-center text-sm py-6">
        <div className="flex items-center justify-center gap-3">
          <span style={{ color: 'var(--text)' }}>Build by ZYADEV</span>
          <a href="https://github.com/ZYADEV/Arabic_OCR" target="_blank" className="hover:text-blue-500 transition-colors" style={{ color: 'var(--text)' }}>
            <GitHubIcon className="w-6 h-6" />
          </a>
        </div>
      </footer>
 

      {fontModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="glass rounded-xl w-full max-w-3xl p-6 max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">اختر الخط للتطبيق ولجميع الملفات</h3>
              <button onClick={() => setFontModal(false)} className="px-4 py-2 rounded modal-btn-neutral">إغلاق</button>
            </div>
            <p className="text-sm text-neutral-600 mb-4">النص التجريبي: <span className="font-medium">سبحان الله وبحمده سبحان الله العظيم</span></p>
            <div className="grid md:grid-cols-2 gap-4">
              {fonts
                .flatMap(f => (f.variants.length ? f.variants : [f.regular]).filter(Boolean).map(v => ({ family: f.family, path: v! })))
                .map((fv, idx) => {
                  // Use Google Fonts for preview with appropriate weights/styles
                  const fileName = fv.path.split('/').pop() || '';
                  const isAmiri = fv.family === 'Amiri';
                  const isCairo = fv.family === 'Cairo';
                  
                  let previewStyle = {};
                  let fontWeight = '400';
                  let fontStyle = 'normal';
                  
                  // Parse weight and style from filename
                  if (fileName.includes('Bold')) fontWeight = '700';
                  else if (fileName.includes('Light')) fontWeight = '300';
                  else if (fileName.includes('Medium')) fontWeight = '500';
                  else if (fileName.includes('SemiBold')) fontWeight = '600';
                  else if (fileName.includes('ExtraBold')) fontWeight = '800';
                  else if (fileName.includes('Black')) fontWeight = '900';
                  
                  if (fileName.includes('Italic')) fontStyle = 'italic';
                  
                  if (isAmiri) {
                    previewStyle = { 
                      fontFamily: '"Amiri", serif',
                      fontWeight,
                      fontStyle
                    };
                  } else if (isCairo) {
                    previewStyle = { 
                      fontFamily: '"Cairo", sans-serif',
                      fontWeight,
                      fontStyle
                    };
                  } else {
                    previewStyle = { fontFamily: 'serif', fontWeight, fontStyle };
                  }
                  
                  return (
                    <button
                      key={fv.path}
                      onClick={() => { applyUiFont(fv.path); setFontModal(false); }}
                      className={`font-card rounded-lg p-3 text-right hover:border-blue-500 transition ${selectedFont === fv.path ? 'border-blue-600 ring-2 ring-blue-300' : ''}`}
                    >
                  <div className="text-xs text-neutral-500 mb-2 ltr:text-left rtl:text-right">{fv.family}</div>
                      <div style={previewStyle}>{'سبحان الله وبحمده سبحان الله العظيم'}</div>
                      <div className="mt-2 text-[10px] break-all text-neutral-400">{fileName}</div>
                </button>
                  );
                })}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setFontModal(false)} className="px-4 py-2 rounded modal-btn-neutral">إلغاء</button>
              <button disabled={!selectedFont} onClick={() => { setFontModal(false); }} className="px-4 py-2 rounded modal-btn-primary disabled:opacity-50">تأكيد</button>
            </div>
          </div>
        </div>
      )}

      {/* Mistral Corner Modal */}
      {provider === 'mistral' && (
        <div className="fixed bottom-4 right-4 z-40 animate-fadeUp">
          <div className="glass rounded-2xl p-4 min-w-[200px]">
            <div className="flex flex-col items-center gap-3">
              <h1 className="text-2xl font-bold">هدية من</h1>
              <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 p-1">
                <img 
                  src={logo}
                  alt="Logo" 
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
              <div className="flex items-center gap-3">
                <a 
                  href="https://x.com/python_ar" 
                  target="_blank" 
                  className="p-2 rounded-full glass hover:scale-110 transition-transform"
                >
                  <TwitterIcon className="w-5 h-5" />
                </a>
                <a 
                  href="https://t.me/python4arabs" 
                  target="_blank" 
                  className="p-2 rounded-full glass hover:scale-110 transition-transform"
                >
                  <TelegramIcon className="w-5 h-5" />
                </a>
                <a 
                  href="https://www.youtube.com/@PythonArab" 
                  target="_blank" 
                  className="p-2 rounded-full glass hover:scale-110 transition-transform"
                >
                  <YouTubeIcon className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
