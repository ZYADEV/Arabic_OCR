// Simple PDF generator using minimal puppeteer setup for Vercel
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

export async function generateSimplePdf(content: string, fontPath?: string): Promise<Buffer | null> {
  try {
    console.log('[simple-pdf] Starting simple PDF generation...');
    
    // Check if we're in Vercel
    const isVercel = Boolean(process.env.VERCEL);
    
    if (isVercel) {
      // In Vercel, try a very minimal approach
      try {
        const chromium = await import('@sparticuz/chromium' as any);
        const puppeteer = await import('puppeteer-core');
        const pathMod = await import('path');
        const fsMod = await import('fs');
        
        const chromiumInstance = (chromium as any).default || chromium;
        const puppeteerInstance = (puppeteer as any).default || puppeteer;
        
        console.log('[simple-pdf] Launching browser with minimal options...');
        
        let execPath = await chromiumInstance.executablePath();
        try {
          const req = require as any;
          const pkgRoot = pathMod.dirname(req.resolve('@sparticuz/chromium/package.json'));
          const packed = pathMod.join(pkgRoot, 'bin', 'chromium');
          if (fsMod.existsSync(packed)) execPath = packed;
        } catch {}
        let libPath: string | undefined;
        try {
          const req = require as any;
          const pkgRoot = pathMod.dirname(req.resolve('@sparticuz/chromium/package.json'));
          const libDir = pathMod.join(pkgRoot, 'lib');
          if (fsMod.existsSync(libDir)) libPath = libDir;
        } catch {}

        const browser = await puppeteerInstance.launch({
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--single-process',
            '--disable-web-security',
          ],
          executablePath: execPath,
          headless: true,
          timeout: 15000,
          env: {
            ...process.env,
            HOME: '/tmp',
            TMPDIR: '/tmp',
            LD_LIBRARY_PATH: libPath ? `${libPath}:${process.env.LD_LIBRARY_PATH || ''}` : process.env.LD_LIBRARY_PATH,
            FONTCONFIG_PATH: process.env.FONTCONFIG_PATH || '/var/task/fonts',
          },
        });
        
        const page = await browser.newPage();
        
        // Create very simple HTML
        const simpleHtml = `
          <!DOCTYPE html>
          <html dir="rtl" lang="ar">
          <head>
            <meta charset="utf-8">
            <style>
              body { 
                font-family: Arial, sans-serif; 
                direction: rtl; 
                text-align: right; 
                padding: 20px;
                font-size: 16px;
                line-height: 1.6;
              }
              @page { margin: 1cm; }
            </style>
          </head>
          <body>
            <div style="white-space: pre-wrap;">${content.replace(/\n/g, '<br>')}</div>
          </body>
          </html>
        `;
        
        await page.setContent(simpleHtml);
        const pdf = await page.pdf({ format: 'A4' });
        
        await browser.close();
        console.log('[simple-pdf] Simple PDF generated successfully');
        
        return pdf;
        
      } catch (error) {
        console.log('[simple-pdf] Simple PDF generation failed:', error);
        return null;
      }
    } else {
      // Local development
      const puppeteer = await import('puppeteer');
      const puppeteerInstance = puppeteer.default || puppeteer;
      
      const browser = await puppeteerInstance.launch({ headless: true });
      const page = await browser.newPage();
      
      const html = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <style>
            body { 
              font-family: Arial, sans-serif; 
              direction: rtl; 
              text-align: right; 
              padding: 20px;
              font-size: 16px;
              line-height: 1.6;
            }
            @page { margin: 1cm; }
          </style>
        </head>
        <body>
          <div style="white-space: pre-wrap;">${content.replace(/\n/g, '<br>')}</div>
        </body>
        </html>
      `;
      
      await page.setContent(html);
      const pdf = await page.pdf({ format: 'A4' });
      
      await browser.close();
      return pdf;
    }
    
  } catch (error) {
    console.log('[simple-pdf] All simple PDF generation methods failed:', error);
    return null;
  }
}
