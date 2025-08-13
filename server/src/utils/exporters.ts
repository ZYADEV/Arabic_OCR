import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { AlignmentType, Document, Packer, Paragraph, TextRun } from 'docx';
import Epub from 'epub-gen';
import JSZip from 'jszip';
import { v4 as uuidv4 } from 'uuid';

export type ExportResult = { filename: string; mime: string; base64: string };

export async function exportTxt(basename: string, content: string): Promise<ExportResult> {
  const filename = `${basename}-${uuidv4()}.txt`;
  // Add RTL mark at beginning for proper text direction in text editors
  const rtlContent = '\u202E' + content + '\u202C';
  return { filename, mime: 'text/plain; charset=utf-8', base64: Buffer.from(rtlContent, 'utf8').toString('base64') };
}

export async function exportDocx(
  basename: string,
  content: string,
  opts: { fontFamily?: string } = {}
): Promise<ExportResult> {
  const filename = `${basename}-${uuidv4()}.docx`;
  
  // Parse content to identify headers and apply appropriate formatting
  const lines = content.split('\n').filter(line => line.trim());
  const paragraphs = lines.map(line => {
    const trimmed = line.trim();
    let fontSize = 28; // 14pt in half-points
    let bold = false;
    
    // Identify headers by pattern and apply sizing
    if (trimmed.includes('الفصل') || trimmed.includes('الجزء') || trimmed.includes('الباب')) {
      fontSize = 40; // 20pt - Headlines
      bold = true;
    } else if (trimmed.length < 50 && (trimmed.includes(':') || /^[^\s]/.test(trimmed))) {
      fontSize = 32; // 16pt - Sub-headlines  
      bold = true;
    }
    
    return new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ 
        text: trimmed, 
        font: opts.fontFamily || 'Amiri',
        size: fontSize,
        bold
      })]
    });
  });
  
  const doc = new Document({ sections: [{ children: paragraphs }] });
  const buffer = await Packer.toBuffer(doc);
  return {
    filename,
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    base64: Buffer.from(buffer).toString('base64')
  };
}

interface PdfOptions { fontPath?: string }
export async function exportPdf(basename: string, content: string, opts: PdfOptions = {}): Promise<ExportResult> {
  const filename = `${basename}-${uuidv4()}.pdf`;

  // Prefer HTML → PDF through Chromium for correct Arabic shaping and RTL layout
  const tryHtmlToPdf = async (): Promise<Buffer | null> => {
    try {
      // Use puppeteer-core + @sparticuz/chromium on serverless (Vercel),
      // and full puppeteer locally.
      const isServerless = Boolean(process.env.VERCEL || process.env.AWS_REGION || process.env.LAMBDA_TASK_ROOT);
      // Use runtime ESM import to avoid CJS require on ESM-only packages
      const chromium = isServerless ? (await (eval('import'))('@sparticuz/chromium')).default : null;
      const puppeteer = isServerless
        ? (await (eval('import'))('puppeteer-core')).default
        : (await (eval('import'))('puppeteer')).default;
      const fontPath = opts.fontPath;
      
      console.log(`[pdf] Using font path: ${fontPath}`);
      
      // Embed the font as base64 to guarantee availability regardless of file URL quirks
      let fontCss = '';
      if (fontPath) {
        try {
          const fsNative = await import('fs');
          const b64 = fsNative.readFileSync(fontPath).toString('base64');
          fontCss = `@font-face{font-family:"UserFont";src:url(data:font/ttf;base64,${b64}) format('truetype');font-weight:normal;font-style:normal;font-display:swap;}`;
        } catch (e) {
          console.warn('[pdf] Could not embed font, will fallback to Amiri/Cairo', e);
        }
      }
      
      // Build paragraphs by splitting on blank lines, and unwrap single newlines to avoid ragged lines
      const blocks = content.split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
      const styledContent = blocks.map(block => {
        const text = block.replace(/\n+/g, ' ').trim();
        // Identify headers and apply appropriate styling (PDF-specific sizes)
        if (text.includes('الفصل') || text.includes('الجزء') || text.includes('الباب')) {
          return `<h1 style="font-size:24px;font-weight:bold;margin:24px 0 18px 0;line-height:1.4;">${text}</h1>`;
        } else if (text.length < 80 && (text.includes(':') || /^[^\s]/.test(text))) {
          return `<h2 style="font-size:18px;font-weight:bold;margin:18px 0 12px 0;line-height:1.4;">${text}</h2>`;
        } else {
          return `<p style="font-size:16px;margin:10px 0;line-height:1.9;text-align:justify;text-align-last:right;">${text}</p>`;
        }
      }).join('');
      
      const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
        <style>
          ${fontCss}
          html,body{margin:0;padding:0;direction:rtl}
          body{
            text-align:right;
            font-family:${fontPath ? `'UserFont',` : ''}'Amiri','Cairo',serif;
            font-weight:normal;
          }
          h1,h2,h3,p{
            text-align:right;
            direction:rtl;
            font-family:${fontPath ? `'UserFont',` : ''}'Amiri','Cairo',serif;
            text-justify: inter-word;
          }
          @page{size:A4;margin:48px}
        </style>
      </head><body>${styledContent}</body></html>`;
      
      console.log(`[pdf] Generated HTML preview:`, html.substring(0, 500) + '...');
      
      const launchOptions: any = isServerless
        ? {
            args: [...(chromium?.args || []), '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
            defaultViewport: chromium?.defaultViewport,
            executablePath: await chromium!.executablePath(),
            headless: true,
          }
        : {
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
          };
      const browser = await (puppeteer as any).launch(launchOptions);
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      // Wait for fonts to load
      await page.evaluateHandle('document.fonts.ready');
      
      const pdfBuf: Buffer = await page.pdf({ 
        format: 'A4', 
        printBackground: true,
        preferCSSPageSize: true
      });
      await browser.close();
      return pdfBuf;
    } catch (e) {
      console.warn('[pdf] Puppeteer failed, falling back to pdf-lib:', e);
      return null;
    }
  };

  const htmlPdf = await tryHtmlToPdf();
  if (htmlPdf) {
    return { filename, mime: 'application/pdf', base64: Buffer.from(htmlPdf).toString('base64') };
  }

  // Fallback: pdf-lib (no complex shaping, basic RTL support only)
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit as any);
  const fontSize = 12;
  const marginX = 48;
  const marginY = 48;
  let embeddedFont: any = null;
  const fontPath = opts.fontPath || process.env.ARABIC_TTF_PATH;
  if (fontPath) {
    try {
      const fsNative = await import('fs');
      const bytes = fsNative.readFileSync(fontPath);
      embeddedFont = await pdfDoc.embedFont(bytes, { subset: true });
    } catch (e) {
      console.warn('[pdf] Arabic font load failed, continuing with fallback shaping:', e);
    }
  }
  let page = pdfDoc.addPage();
  let { width, height } = page.getSize();
  const maxLineWidth = width - marginX * 2;
  const sanitized = content.replace(/^#\s.+$/gm, '').replace(/\n{3,}/g, '\n\n');
  const linesRaw = sanitized.split('\n');
  const wrapped: string[] = [];
  const measure = (t: string) => (embeddedFont ? embeddedFont.widthOfTextAtSize(t, fontSize) : t.length * fontSize * 0.55);
  for (const raw of linesRaw) {
    if (!raw.trim()) {
      wrapped.push('');
      continue;
    }
    if (measure(raw) <= maxLineWidth) {
      wrapped.push(raw);
      continue;
    }
    let current = '';
    for (const word of raw.split(/\s+/)) {
      const next = current ? current + ' ' + word : word;
      if (measure(next) <= maxLineWidth) current = next;
      else {
        if (current) wrapped.push(current);
        current = word;
      }
    }
    if (current) wrapped.push(current);
  }
  let y = height - marginY;
  for (const line of wrapped) {
    if (y < marginY) {
      page = pdfDoc.addPage();
      ({ width, height } = page.getSize());
      y = height - marginY;
    }
    const hasArabic = /[\u0600-\u06FF]/.test(line);
    const text = hasArabic ? line.split('').reverse().join('') : line;
    const lineWidth = embeddedFont ? embeddedFont.widthOfTextAtSize(text, fontSize) : text.length * fontSize * 0.55;
    const x = hasArabic ? width - marginX - lineWidth : marginX;
    try {
      page.drawText(text, { x, y, size: fontSize, font: embeddedFont ?? undefined, color: rgb(0, 0, 0) });
    } catch (e) {
      console.warn('[pdf] drawText error, skipping line:', e);
    }
    y -= fontSize + 4;
  }
  const pdfBytes = await pdfDoc.save();
  return { filename, mime: 'application/pdf', base64: Buffer.from(pdfBytes).toString('base64') };
}

export async function exportEpub(
  basename: string,
  content: string,
  opts: { fontPath?: string } = {}
): Promise<ExportResult> {
  const filename = `${basename}-${uuidv4()}.epub`;
  const tmpFile = `${process.cwd()}/tmp-${uuidv4()}.epub`;

  const fsNative = await import('fs');
  
  // Base CSS with proper RTL styling and font sizes, justify paragraphs fully
  let css = `
    html, body { direction: rtl; text-align: right; font-family: 'Amiri', 'Cairo', serif !important; margin: 20px; -webkit-text-size-adjust: 100%; }
    h1 { font-size: 20px; font-weight: bold; margin: 20px 0 15px 0; line-height: 1.4; text-align: right; }
    h2 { font-size: 16px; font-weight: bold; margin: 15px 0 10px 0; line-height: 1.4; text-align: right; }
    p { font-size: 14px; margin: 8px 0; line-height: 1.9; text-align: justify; text-align-last: right; }
    * { direction: rtl; font-family: 'Amiri', 'Cairo', serif !important; }
  `;
  
  // Add custom font if provided
  console.log(`[epub] Font path provided: ${opts.fontPath}`);
  if (opts.fontPath) {
    console.log(`[epub] Font path exists: ${fsNative.existsSync(opts.fontPath)}`);
    if (fsNative.existsSync(opts.fontPath)) {
      try {
        const b64 = fsNative.readFileSync(opts.fontPath).toString('base64');
        console.log(`[epub] Font embedded successfully, base64 length: ${b64.length}`);
        
        // Use multiple font formats for better EPUB reader compatibility
        css = `@font-face{
          font-family:'UserFont';
          src:url(data:font/truetype;base64,${b64}) format('truetype'),
              url(data:application/font-woff;base64,${b64}) format('woff'),
              url(data:font/opentype;base64,${b64}) format('opentype');
          font-weight:normal;
          font-style:normal;
          font-display:swap;
        }
        @font-face{
          font-family:'ArabicFont';
          src:url(data:font/truetype;base64,${b64}) format('truetype');
          font-weight:normal;
          font-style:normal;
        }
        html, body { 
          direction: rtl; 
          text-align: right; 
          font-family: 'UserFont', 'ArabicFont', 'Amiri', serif; 
          margin: 20px; 
        }
        h1 { 
          font-size: 20px; 
          font-weight: bold; 
          margin: 20px 0 15px 0; 
          line-height: 1.4; 
          text-align: right; 
          font-family: 'UserFont', 'ArabicFont', 'Amiri', serif; 
        }
        h2 { 
          font-size: 16px; 
          font-weight: bold; 
          margin: 15px 0 10px 0; 
          line-height: 1.4; 
          text-align: right; 
          font-family: 'UserFont', 'ArabicFont', 'Amiri', serif; 
        }
        p { 
          font-size: 14px; 
          margin: 8px 0; 
          line-height: 1.9; 
          text-align: justify; 
          text-align-last: right; 
          font-family: 'UserFont', 'ArabicFont', 'Amiri', serif; 
        }
        * { 
          direction: rtl; 
          font-family: 'UserFont', 'ArabicFont', 'Amiri', serif; 
        }`;
      } catch (e) {
        console.error('[epub] Failed to read font file:', e);
      }
    }
  }
  
  // Parse content and apply proper HTML structure
  // Build paragraphs by splitting on blank lines and unwrapping single newlines
  const blocks = content.split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
  const styledContent = blocks.map(block => {
    const text = block.replace(/\n+/g, ' ').trim();
    
    // Identify headers and apply appropriate styling with inline styles for EPUB readers
    const fontStack = opts.fontPath ? "'UserFont', 'Amiri', serif" : "'Amiri', serif";
    if (text.includes('الفصل') || text.includes('الجزء') || text.includes('الباب')) {
      return `<h1 style="font-family: ${fontStack}; font-size: 20px; font-weight: bold; text-align: right; direction: rtl;">${text}</h1>`;
    } else if (text.length < 80 && (text.includes(':') || /^[^\s]/.test(text))) {
      return `<h2 style="font-family: ${fontStack}; font-size: 16px; font-weight: bold; text-align: right; direction: rtl;">${text}</h2>`;
    } else {
      return `<p style="font-family: ${fontStack}; font-size: 14px; text-align: justify; text-align-last: right; direction: rtl; line-height: 1.9;">${text}</p>`;
    }
  }).filter(Boolean).join('\n');
  
  const html = `<div dir="rtl" style="direction:rtl;text-align:right;font-family:${opts.fontPath ? 'UserFont, ArabicFont, ' : ''}Amiri, serif;">${styledContent}</div>`;
  
  // For better EPUB font support, let's use a different approach
  let option: any;
  
  if (opts.fontPath && fsNative.existsSync(opts.fontPath)) {
    // Create EPUB with font file reference in manifest
    const fontFileName = `fonts/${fsNative.readFileSync(opts.fontPath).toString('base64').substring(0, 8)}.ttf`;
    const pathMod = await import('path');
    const fontBase = pathMod.basename(opts.fontPath);
    const fontDir = pathMod.dirname(opts.fontPath);
    const files = fsNative.readdirSync(fontDir).filter(f => f.toLowerCase().endsWith('.ttf'));
    const byName = (name: string) => files.find(f => f.toLowerCase().includes(name.toLowerCase()));
    const regular = byName('regular') || byName('roman') || files.find(f => !/bold|italic|oblique/i.test(f));
    const bold = byName('bold');
    const italic = byName('italic');
    const fontsList = [opts.fontPath].concat(
      [regular, bold, italic].filter(Boolean).map(f => pathMod.join(fontDir, f as string))
    );
    option = {
      title: ((content.split(/\n+/).find(l => /(الفصل|الجزء|الباب)/.test(l)) || content.split(/\n+/).find(l => l.trim()) || 'كتاب')).trim(),
      author: 'OCR Arabic App',
      content: [{ title: 'المحتوى', data: html }],
      css: `
        @font-face {
          font-family: 'UserFont';
          src: url('${fontFileName}') format('truetype'),
               url('fonts/${fontBase}') format('truetype'),
               url('./fonts/${fontBase}') format('truetype'),
               url('${fontBase}') format('truetype');
          font-weight: normal;
          font-style: normal;
        }
        html, body { 
          direction: rtl; 
          text-align: right; 
          font-family: 'UserFont', 'Amiri', serif !important; 
          margin: 20px; 
          -webkit-text-size-adjust: 100%;
        }
        h1, h2, h3, p, div, span { 
          font-family: 'UserFont', 'Amiri', serif !important; 
          direction: rtl;
        }
      `,
      fonts: Array.from(new Set(fontsList)),
      output: tmpFile,
      verbose: false
    };
  } else {
    option = {
      title: ((content.split(/\n+/).find(l => /(الفصل|الجزء|الباب)/.test(l)) || content.split(/\n+/).find(l => l.trim()) || 'كتاب')).trim(),
      author: 'OCR Arabic App',
      content: [{ title: 'المحتوى', data: html }],
      css,
      output: tmpFile,
      verbose: false
    };
  }
  
  console.log(`[epub] Creating EPUB with option:`, JSON.stringify(option, null, 2).substring(0, 500) + '...');
  
  try {
    await new Promise<void>((resolve, reject) => {
      new (Epub as any)(option).promise.then(resolve).catch(reject);
    });
    const buf = fsNative.readFileSync(tmpFile);
    try { fsNative.unlinkSync(tmpFile); } catch {}
    return { filename, mime: 'application/epub+zip', base64: Buffer.from(buf).toString('base64') };
  } catch (err) {
    console.warn('[epub] epub-gen failed, trying manual ZIP packaging');
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' } as any);
    zip.file('META-INF/container.xml', `<?xml version="1.0"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n  <rootfiles>\n    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>\n  </rootfiles>\n</container>`);
    const opf = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<package xmlns=\"http://www.idpf.org/2007/opf\" unique-identifier=\"BookId\" version=\"3.0\">\n  <metadata xmlns:dc=\"http://purl.org/dc/elements/1.1/\">\n    <dc:identifier id=\"BookId\">${uuidv4()}</dc:identifier>\n    <dc:title>${option.title}</dc:title>\n    <dc:language>ar</dc:language>\n  </metadata>\n  <manifest>\n    <item id=\"content\" href=\"content.xhtml\" media-type=\"application/xhtml+xml\"/>\n    <item id=\"css\" href=\"stylesheet.css\" media-type=\"text/css\"/>\n    ${opts.fontPath ? '<item id=\"font\" href=\"fonts/font.ttf\" media-type=\"font/ttf\"/>' : ''}\n  </manifest>\n  <spine>\n    <itemref idref=\"content\"/>\n  </spine>\n</package>`;
    zip.file('OEBPS/content.opf', opf);
    zip.file('OEBPS/stylesheet.css', css);
    const xhtml = `<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<!DOCTYPE html>\n<html xmlns=\"http://www.w3.org/1999/xhtml\" xml:lang=\"ar\" lang=\"ar\" dir=\"rtl\"><head><meta charset=\"utf-8\"/><link rel=\"stylesheet\" type=\"text/css\" href=\"stylesheet.css\"/></head><body>${html}</body></html>`;
    zip.file('OEBPS/content.xhtml', xhtml);
    if (opts.fontPath) {
      const f = await fsNative.promises.readFile(opts.fontPath);
      zip.file('OEBPS/fonts/font.ttf', f);
    }
    const outBuf: Buffer = await zip.generateAsync({ type: 'nodebuffer' } as any) as unknown as Buffer;
    return { filename, mime: 'application/epub+zip', base64: outBuf.toString('base64') };
  }
}
