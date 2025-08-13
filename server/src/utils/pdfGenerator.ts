// Alternative PDF generator that works around puppeteer-core/ws issues on Vercel
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

export async function generatePdfWithChromium(content: string, fontPath?: string): Promise<Buffer | null> {
  try {
    const isVercel = Boolean(process.env.VERCEL);
    
    if (!isVercel) {
      // Local development - use regular puppeteer
      const puppeteer = await import('puppeteer');
      return await generateWithPuppeteer(puppeteer.default, content, fontPath);
    }
    
    // Vercel serverless - use a retry mechanism for better reliability
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[pdf-alt] Attempt ${attempt}/2 for serverless PDF generation`);
        
        // Import chromium
        const chromium = await import('@sparticuz/chromium' as any);
        const chromiumInstance = (chromium as any).default || chromium;
        const pathMod = await import('path');
        const fsMod = await import('fs');
        try {
          // Ensure correct modes for serverless
          (chromiumInstance as any).setHeadlessMode = true;
          (chromiumInstance as any).setGraphicsMode = false;
        } catch {}
        
        console.log('[pdf-alt] Chromium imported successfully');
        
        // Import puppeteer-core
        const puppeteerCore = await import('puppeteer-core');
        const puppeteer = (puppeteerCore as any).default || puppeteerCore;
        
        console.log('[pdf-alt] Attempting browser launch with chromium...');
        
        // Prefer a packaged chromium binary inside node_modules to avoid dynamic extraction to /tmp
        let execPath = await chromiumInstance.executablePath();
        try {
          const req = require as any;
          const pkgRoot = pathMod.dirname(req.resolve('@sparticuz/chromium/package.json'));
          const packed = pathMod.join(pkgRoot, 'bin', 'chromium');
          if (fsMod.existsSync(packed)) execPath = packed;
        } catch {}

        const browser = await puppeteer.launch({
          args: [
            ...chromiumInstance.args,
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--single-process',
            '--no-zygote',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
          ],
          defaultViewport: chromiumInstance.defaultViewport,
          executablePath: execPath,
          headless: (chromiumInstance as any).headless ?? 'new',
          ignoreDefaultArgs: ['--disable-extensions'],
          // Try to avoid connection issues
          pipe: false,
          timeout: 30000,
          protocolTimeout: 30000,
        });
        
        console.log('[pdf-alt] Browser launched successfully, generating PDF...');
        
        // Use a timeout wrapper for PDF generation
        const pdfPromise = generatePdfContent(browser, content, fontPath);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('PDF generation timeout')), 25000);
        });
        
        const result = await Promise.race([pdfPromise, timeoutPromise]);
        
        await browser.close();
        console.log('[pdf-alt] PDF generated successfully');
        return result;
        
      } catch (error) {
        lastError = error as Error;
        console.log(`[pdf-alt] Attempt ${attempt} failed:`, error);
        
        if (attempt < 2) {
          // Wait a bit before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    console.log('[pdf-alt] All attempts failed, last error:', lastError);
    return null; // Fall back to pdf-lib
    
  } catch (error) {
    console.log('[pdf-alt] PDF generation completely failed:', error);
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
  let page: any = null;
  
  try {
    // Embed the font as base64 if provided
    let fontCss = '';
    if (fontPath) {
      try {
        const fs = await import('fs');
        const b64 = fs.readFileSync(fontPath).toString('base64');
        fontCss = `@font-face{font-family:"UserFont";src:url(data:font/ttf;base64,${b64}) format('truetype');font-weight:normal;font-style:normal;font-display:swap;}`;
        console.log('[pdf-alt] Font embedded successfully');
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
    
    console.log('[pdf-alt] Creating new page...');
    page = await browser.newPage();
    
    // Set a smaller viewport for serverless
    await page.setViewport({ width: 1024, height: 768 });
    
    console.log('[pdf-alt] Setting page content...');
    await page.setContent(html, { 
      waitUntil: 'networkidle0', 
      timeout: 20000 
    });
    
    console.log('[pdf-alt] Waiting for fonts to load...');
    await page.evaluateHandle('document.fonts.ready');
    
    console.log('[pdf-alt] Generating PDF...');
    const pdfBuf = await page.pdf({ 
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      timeout: 20000
    });
    
    console.log(`[pdf-alt] PDF generated successfully, size: ${pdfBuf.length} bytes`);
    return pdfBuf;
    
  } catch (error) {
    console.error('[pdf-alt] Error in generatePdfContent:', error);
    throw error;
  } finally {
    if (page) {
      try {
        await page.close();
        console.log('[pdf-alt] Page closed');
      } catch (closeError) {
        console.warn('[pdf-alt] Error closing page:', closeError);
      }
    }
  }
}
