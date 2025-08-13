import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { AlignmentType, Document, Packer, Paragraph, TextRun } from 'docx';
import Epub from 'epub-gen';
import JSZip from 'jszip';
import { shapeArabicText, sanitizeArabicText } from './arabicShaper';
import { v4 as uuidv4 } from 'uuid';
import { generatePdfWithChromium } from './pdfGenerator';
import { generateSimplePdf } from './simplePdf';

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

  // Try the alternative Chromium-based PDF generation first
  console.log('[pdf] Attempting Chromium-based PDF generation...');
  const chromiumPdf = await generatePdfWithChromium(content, opts.fontPath);
  
  if (chromiumPdf) {
    console.log('[pdf] Chromium PDF generation successful');
    return { filename, mime: 'application/pdf', base64: Buffer.from(chromiumPdf).toString('base64') };
  }

  console.log('[pdf] Chromium PDF generation failed, trying simple PDF generation...');
  const simplePdf = await generateSimplePdf(content, opts.fontPath);
  
  if (simplePdf) {
    console.log('[pdf] Simple PDF generation successful');
    return { filename, mime: 'application/pdf', base64: Buffer.from(simplePdf).toString('base64') };
  }

  console.log('[pdf] All Chromium approaches failed, falling back to pdf-lib...');

  // Fallback: pdf-lib with manual Arabic shaping and full justification
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit as any);
  const fontSize = 16;
  const lineGap = 6;
  const marginX = 56;
  const marginY = 56;
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

  const measure = (t: string) => (embeddedFont ? embeddedFont.widthOfTextAtSize(t, fontSize) : t.length * fontSize * 0.55);

  const paragraphs = sanitizeArabicText(content)
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => shapeArabicText(p));

  let page = pdfDoc.addPage();
  let { width, height } = page.getSize();
  const maxLineWidth = width - marginX * 2;
  let y = height - marginY;

  const drawRtlJustified = (lineWords: string[], isLast: boolean) => {
    const words = lineWords;
    const widths = words.map(w => measure(w));
    const textWidth = widths.reduce((a, b) => a + b, 0);
    const gaps = Math.max(words.length - 1, 1);
    const baseGap = embeddedFont ? embeddedFont.widthOfTextAtSize(' ', fontSize) : fontSize * 0.4;
    let extra = 0;
    if (!isLast && gaps > 0) {
      const remaining = Math.max(maxLineWidth - (textWidth + baseGap * gaps), 0);
      extra = remaining / gaps;
    }
    // Right-aligned start
    let xCursor = width - marginX - (isLast ? textWidth + baseGap * gaps : maxLineWidth);
    // Draw each word from right to left
    for (let i = 0; i < words.length; i++) {
      const idx = i; // words are already shaped RTL; draw in order but place from right by incrementing x
      const w = words[idx];
      const wWidth = widths[idx];
      page.drawText(w, { x: xCursor, y, size: fontSize, font: embeddedFont ?? undefined, color: rgb(0, 0, 0) });
      xCursor += wWidth + baseGap + extra;
    }
  };

  for (const para of paragraphs) {
    // Break paragraph into words (keep punctuation attached)
    const tokens = para.split(/\s+/).filter(Boolean);
    let line: string[] = [];
    let lineWidth = 0;
    for (const token of tokens) {
      const w = token;
      const wWidth = measure(w);
      const spaceWidth = embeddedFont ? embeddedFont.widthOfTextAtSize(' ', fontSize) : fontSize * 0.4;
      const additional = line.length ? spaceWidth : 0;
      if (lineWidth + additional + wWidth <= maxLineWidth) {
        line.push(w);
        lineWidth += additional + wWidth;
      } else {
        if (y < marginY) {
          page = pdfDoc.addPage();
          ({ width, height } = page.getSize());
          y = height - marginY;
        }
        drawRtlJustified(line, false);
        y -= fontSize + lineGap;
        line = [w];
        lineWidth = wWidth;
      }
    }
    // Draw last line right-aligned (not justified)
    if (line.length) {
      if (y < marginY) {
        page = pdfDoc.addPage();
        ({ width, height } = page.getSize());
        y = height - marginY;
      }
      drawRtlJustified(line, true);
      y -= fontSize + lineGap;
    }
    // Paragraph spacing
    y -= lineGap;
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
