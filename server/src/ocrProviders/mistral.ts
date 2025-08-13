import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';

export type OCRResult = { filename: string; text: string; model: string; provider: 'mistral'; };

// Implements flow from cookbook: upload file -> get signed URL -> OCR process -> aggregate markdown
export async function processWithMistral(input: { filePath: string; filename: string; ext: string; }): Promise<OCRResult> {
  const apiKey = process.env.MISTRAL_API_KEY;
  const model = process.env.MISTRAL_MODEL || 'mistral-ocr-latest';
  if (!apiKey) throw new Error('Missing MISTRAL_API_KEY');

  const extLower = input.ext.toLowerCase();
  const isPdf = extLower === '.pdf';
  let documentField: any;
  if (isPdf) {
    // PDF: upload then signed URL
    const fileBuf = await fs.readFile(input.filePath);
    const uploadForm = new FormData();
    uploadForm.append('file', fileBuf, { filename: input.filename, contentType: guessMime(input.ext) });
    uploadForm.append('purpose', 'ocr');
    let fileId: string | undefined;
    try {
      const uploadResp = await axios.post('https://api.mistral.ai/v1/files', uploadForm, {
        headers: { Authorization: `Bearer ${apiKey}`, ...uploadForm.getHeaders() },
        timeout: 120000
      });
      fileId = uploadResp.data?.id;
    } catch (e: any) {
      throw new Error(`Upload failed: ${e?.response?.status} ${JSON.stringify(e?.response?.data || {})}`);
    }
    if (!fileId) throw new Error('Upload failed (no file id)');
    let signedUrl: string | undefined;
    try {
      const signedResp = await axios.get(`https://api.mistral.ai/v1/files/${fileId}/signed-url?expiry=1`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 60000
      });
      signedUrl = signedResp.data?.url;
    } catch (e: any) {
      throw new Error(`Signed URL failed: ${e?.response?.status} ${JSON.stringify(e?.response?.data || {})}`);
    }
    if (!signedUrl) throw new Error('Signed URL retrieval failed');
    documentField = { document_url: signedUrl };
  } else {
    // Image: inline as data URL
    const fileBuf = await fs.readFile(input.filePath);
    const base64 = fileBuf.toString('base64');
    const mime = guessMime(input.ext);
    const dataUrl = `data:${mime};base64,${base64}`;
    documentField = { image_url: dataUrl };
  }

  const includeImages = (process.env.MISTRAL_INCLUDE_IMAGE_BASE64 || '').toLowerCase() === 'true';
  let ocrData: any;
  try {
    const body = {
      document: documentField,
      model,
      include_image_base64: includeImages
    };
    const ocrResp = await axios.post('https://api.mistral.ai/v1/ocr', body, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 180000
    });
    ocrData = ocrResp.data;
  } catch (e: any) {
    const status = e?.response?.status;
    const snippet = JSON.stringify(e?.response?.data || {}).slice(0, 500);
    throw new Error(`Mistral OCR request failed (${status}): ${snippet}`);
  }

  const pages = ocrData?.pages || [];
  if (!Array.isArray(pages) || !pages.length) throw new Error('No pages returned from Mistral');
  const markdown = pages.map((p: any) => p?.markdown || '').join('\n\n');
  if (!markdown.trim()) throw new Error('Empty OCR markdown');
  if (process.env.MISTRAL_DEBUG) {
    console.log('[mistral] pages returned:', pages.length);
  }
  return { filename: input.filename, text: markdown, model, provider: 'mistral' };
}

function guessMime(ext: string) {
  switch (ext) {
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.webp': return 'image/webp';
    case '.pdf': return 'application/pdf';
    default: return 'application/octet-stream';
  }
}
