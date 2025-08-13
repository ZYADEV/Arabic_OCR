// Alternative PDF generator that works around puppeteer-core/ws issues on Vercel
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

export async function generatePdfWithChromium(content: string, fontPath?: string): Promise<Buffer | null> {
  try {
    // Only try chromium/puppeteer in very specific conditions to avoid ws issues
    const isVercel = Boolean(process.env.VERCEL);
    
    if (!isVercel) {
      // Local development - use regular puppeteer
      const puppeteer = await import('puppeteer');
      return await generateWithPuppeteer(puppeteer.default, content, fontPath);
    }
    
    // Vercel serverless - try chromium with puppeteer-core but with specific ws handling
    try {
      // Import chromium first
      const chromium = await import('@sparticuz/chromium' as any);
      const chromiumInstance = chromium.default || chromium;
      
      console.log('[pdf-alt] Chromium imported successfully');
      
      // Try to pre-load the ws module to work around the wrapper.mjs issue
      try {
        await import('ws' as any);
        console.log('[pdf-alt] ws module pre-loaded successfully');
      } catch (wsError) {
        console.log('[pdf-alt] ws pre-load failed (this may be ok):', wsError);
      }
      
      // Try to work around the ws issue by using a specific puppeteer version
      const puppeteerCore = await import('puppeteer-core');
      const puppeteer = puppeteerCore.default || puppeteerCore;
      
      console.log('[pdf-alt] Attempting browser launch with chromium...');
      
      const browser = await puppeteer.launch({
        args: [...(chromiumInstance.args || []), '--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: chromiumInstance.defaultViewport,
        executablePath: await chromiumInstance.executablePath(),
        headless: true,
        ignoreDefaultArgs: ['--disable-extensions'],
        // Try to avoid WebSocket issues
        pipe: true,
      });
      
      const result = await generatePdfContent(browser, content, fontPath);
      await browser.close();
      return result;
      
    } catch (puppeteerError) {
      console.log('[pdf-alt] Puppeteer-core failed:', puppeteerError);
      
      // If the error is specifically about the ws wrapper, try a different approach
      const errorMessage = (puppeteerError as Error).message || '';
      if (errorMessage.includes('wrapper.mjs') || errorMessage.includes('ws')) {
        console.log('[pdf-alt] Detected ws wrapper issue, trying alternative approach...');
        
        // Try using a different connection method that doesn't rely on ws
        try {
          const chromium = await import('@sparticuz/chromium' as any);
          const chromiumInstance = chromium.default || chromium;
          
          // Generate PDF using chromium directly without puppeteer-core WebSocket transport
          console.log('[pdf-alt] Trying direct chromium approach...');
          
          // Fall back to pdf-lib as this approach is getting too complex
          return null;
          
        } catch (directError) {
          console.log('[pdf-alt] Direct chromium approach failed:', directError);
          return null;
        }
      }
      
      return null; // Fall back to pdf-lib
    }
    
  } catch (error) {
    console.log('[pdf-alt] Alternative PDF generation failed:', error);
    return null;
  }
}

async function generateWithPuppeteer(puppeteer: any, content: string, fontPath?: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  const result = await generatePdfContent(browser, content, fontPath);
  await browser.close();
  return result;
}

async function generatePdfContent(browser: any, content: string, fontPath?: string): Promise<Buffer> {
  // Embed the font as base64 if provided
  let fontCss = '';
  if (fontPath) {
    try {
      const fs = await import('fs');
      const b64 = fs.readFileSync(fontPath).toString('base64');
      fontCss = `@font-face{font-family:"UserFont";src:url(data:font/ttf;base64,${b64}) format('truetype');font-weight:normal;font-style:normal;font-display:swap;}`;
    } catch (e) {
      console.warn('[pdf-alt] Could not embed font:', e);
    }
  }
  
  // Build styled HTML content
  const blocks = content.split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
  const styledContent = blocks.map(block => {
    const text = block.replace(/\n+/g, ' ').trim();
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
  
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.evaluateHandle('document.fonts.ready');
  
  const pdfBuf = await page.pdf({ 
    format: 'A4', 
    printBackground: true,
    preferCSSPageSize: true
  });
  
  return pdfBuf;
}
