// jsPDF fallback with manual Arabic shaping & font embedding
// NOTE: jsPDF doesn't perform complex script shaping (Arabic joining, bidi). We implement a lightweight contextual joiner.
const jsPDF = require('jspdf').jsPDF;
import fs from 'fs';

// Basic joining form maps (subset sufficient for most Arabic text)
interface Forms { isolated: string; initial: string; medial: string; final: string }
// Characters that connect on both sides
const ARABIC_FORMS: Record<string, Forms> = {
  '\u0628': { isolated: '\uFE8F', final: '\uFE90', initial: '\uFE91', medial: '\uFE92' }, // ب
  '\u062A': { isolated: '\uFE95', final: '\uFE96', initial: '\uFE97', medial: '\uFE98' }, // ت
  '\u062B': { isolated: '\uFE99', final: '\uFE9A', initial: '\uFE9B', medial: '\uFE9C' }, // ث
  '\u062C': { isolated: '\uFE9D', final: '\uFE9E', initial: '\uFE9F', medial: '\uFEA0' }, // ج
  '\u062D': { isolated: '\uFEA1', final: '\uFEA2', initial: '\uFEA3', medial: '\uFEA4' }, // ح
  '\u062E': { isolated: '\uFEA5', final: '\uFEA6', initial: '\uFEA7', medial: '\uFEA8' }, // خ
  '\u062F': { isolated: '\uFEA9', final: '\uFEAA', initial: '\uFEA9', medial: '\uFEAA' }, // د (non-connecting next)
  '\u0630': { isolated: '\uFEAB', final: '\uFEAC', initial: '\uFEAB', medial: '\uFEAC' }, // ذ
  '\u0631': { isolated: '\uFEAD', final: '\uFEAE', initial: '\uFEAD', medial: '\uFEAE' }, // ر
  '\u0632': { isolated: '\uFEAF', final: '\uFEB0', initial: '\uFEAF', medial: '\uFEB0' }, // ز
  '\u0633': { isolated: '\uFEB1', final: '\uFEB2', initial: '\uFEB3', medial: '\uFEB4' }, // س
  '\u0634': { isolated: '\uFEB5', final: '\uFEB6', initial: '\uFEB7', medial: '\uFEB8' }, // ش
  '\u0635': { isolated: '\uFEB9', final: '\uFEBA', initial: '\uFEBB', medial: '\uFEBC' }, // ص
  '\u0636': { isolated: '\uFEBD', final: '\uFEBE', initial: '\uFEBF', medial: '\uFEC0' }, // ض
  '\u0637': { isolated: '\uFEC1', final: '\uFEC2', initial: '\uFEC3', medial: '\uFEC4' }, // ط
  '\u0638': { isolated: '\uFEC5', final: '\uFEC6', initial: '\uFEC7', medial: '\uFEC8' }, // ظ
  '\u0639': { isolated: '\uFEC9', final: '\uFECA', initial: '\uFECB', medial: '\uFECC' }, // ع
  '\u063A': { isolated: '\uFECD', final: '\uFECE', initial: '\uFECF', medial: '\uFED0' }, // غ
  '\u0641': { isolated: '\uFED1', final: '\uFED2', initial: '\uFED3', medial: '\uFED4' }, // ف
  '\u0642': { isolated: '\uFED5', final: '\uFED6', initial: '\uFED7', medial: '\uFED8' }, // ق
  '\u0643': { isolated: '\uFED9', final: '\uFEDA', initial: '\uFEDB', medial: '\uFEDC' }, // ك
  '\u0644': { isolated: '\uFEDD', final: '\uFEDE', initial: '\uFEDF', medial: '\uFEE0' }, // ل
  '\u0645': { isolated: '\uFEE1', final: '\uFEE2', initial: '\uFEE3', medial: '\uFEE4' }, // م
  '\u0646': { isolated: '\uFEE5', final: '\uFEE6', initial: '\uFEE7', medial: '\uFEE8' }, // ن
  '\u0647': { isolated: '\uFEE9', final: '\uFEEA', initial: '\uFEEB', medial: '\uFEEC' }, // ه
  '\u0648': { isolated: '\uFEED', final: '\uFEEE', initial: '\uFEED', medial: '\uFEEE' }, // و
  '\u064A': { isolated: '\uFEF1', final: '\uFEF2', initial: '\uFEF3', medial: '\uFEF4' }, // ي
  '\u0629': { isolated: '\uFE93', final: '\uFE94', initial: '\uFE93', medial: '\uFE94' }, // ة
  '\u0627': { isolated: '\uFE8D', final: '\uFE8E', initial: '\uFE8D', medial: '\uFE8E' }, // ا
  '\u0623': { isolated: '\uFE83', final: '\uFE84', initial: '\uFE83', medial: '\uFE84' }, // أ
  '\u0625': { isolated: '\uFE87', final: '\uFE88', initial: '\uFE87', medial: '\uFE88' }, // إ
  '\u0622': { isolated: '\uFE81', final: '\uFE82', initial: '\uFE81', medial: '\uFE82' }, // آ
};

// Letters that do NOT connect to the following letter
const NON_CONNECTING_AFTER = new Set(['\u0627','\u0623','\u0625','\u0622','\u062F','\u0630','\u0631','\u0632','\u0648','\u0629']);

function shapeArabicLine(raw: string): string {
  // Basic bidi: reverse the Arabic segment order if line mostly Arabic
  const chars = [...raw];
  const shaped: string[] = [];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (!ARABIC_FORMS[c]) { shaped.push(c); continue; }
    const prev = chars[i-1];
    const next = chars[i+1];
    const canJoinPrev = prev && ARABIC_FORMS[prev] && !NON_CONNECTING_AFTER.has(prev);
    const canJoinNext = next && ARABIC_FORMS[next] && !NON_CONNECTING_AFTER.has(c);
    let form: string;
    if (canJoinPrev && canJoinNext) form = ARABIC_FORMS[c].medial;
    else if (canJoinPrev && !canJoinNext) form = ARABIC_FORMS[c].final;
    else if (!canJoinPrev && canJoinNext) form = ARABIC_FORMS[c].initial;
    else form = ARABIC_FORMS[c].isolated;
    shaped.push(form);
  }
  // Reverse shaped Arabic substrings for display in simple renderers (jsPDF) to approximate RTL
  const hasArabic = /[\u0600-\u06FF]/.test(raw);
  if (hasArabic) return shaped.reverse().join('');
  return shaped.join('');
}

function splitParagraphs(text: string): string[] {
  return text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
}

export async function generatePdfWithJsPdf(content: string, fontPath?: string): Promise<Buffer | null> {
  try {
    console.log('[jspdf] Starting jsPDF-based PDF generation...');

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 15;
    const marginY = 18;
    const usableWidth = pageWidth - marginX * 2;
    let y = marginY;
    const baseFontSize = 13;
    const lineHeight = 7; // mm

    // Embed custom font if available (Amiri/Cairo). jsPDF needs addFileToVFS/addFont.
    let fontFamily = 'UserFont';
    const candidate = fontPath || process.env.ARABIC_TTF_PATH || 'fonts/Amiri/Amiri-Regular.ttf';
    try {
      if (fs.existsSync(candidate)) {
        const b64 = fs.readFileSync(candidate).toString('base64');
        doc.addFileToVFS('UserFont.ttf', b64);
        doc.addFont('UserFont.ttf', fontFamily, 'normal');
        doc.setFont(fontFamily);
        console.log('[jspdf] Embedded font at', candidate);
      } else {
        console.warn('[jspdf] Font file missing, falling back to default font (may break Arabic)');
      }
    } catch (e) {
      console.warn('[jspdf] Font embedding failed:', e);
    }

    doc.setFontSize(baseFontSize);

    const paragraphs = splitParagraphs(content);
    for (const para of paragraphs) {
      // Header detection to adjust size
      let size = baseFontSize;
      let weight = 'normal';
      if (/\b(الفصل|الجزء|الباب)\b/.test(para)) size = baseFontSize + 6, weight = 'bold';
      else if (para.length < 60) size = baseFontSize + 3, weight = 'bold';
      doc.setFont(fontFamily, weight as any);
      doc.setFontSize(size);

      const shaped = shapeArabicLine(para);
      // Wrap manually by slicing; jsPDF widthOfString doesn't understand complex forms well, so approximate
      const words = shaped.split(/\s+/);
      let current = '';
      const lines: string[] = [];
      for (const w of words) {
        const tentative = current ? w + ' ' + current : w; // build RTL (right to left) so prepend
        const width = doc.getTextWidth(tentative);
        if (width > usableWidth && current) {
          lines.push(current);
          current = w;
        } else {
          current = tentative;
        }
      }
      if (current) lines.push(current);

      for (const l of lines) {
        if (y + lineHeight > pageHeight - marginY) {
          doc.addPage();
            y = marginY;
          doc.setFont(fontFamily, weight as any);
          doc.setFontSize(size);
        }
        doc.text(l, pageWidth - marginX, y, { align: 'right' });
        y += lineHeight;
      }
      // Paragraph spacing
      y += 2;
      // Reset font size
      doc.setFont(fontFamily, 'normal');
      doc.setFontSize(baseFontSize);
    }

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    console.log(`[jspdf] PDF generated successfully, size: ${pdfBuffer.length} bytes`);
    return pdfBuffer;
  } catch (error) {
    console.log('[jspdf] jsPDF generation failed:', error);
    return null;
  }
}

// Export shaping util for reuse in pdf-lib fallback
export function shapeArabicForPdfLib(line: string): string {
  return shapeArabicLine(line);
}
