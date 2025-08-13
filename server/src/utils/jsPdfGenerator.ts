// Alternative PDF generator using jsPDF for better serverless compatibility
const jsPDF = require('jspdf').jsPDF;

export async function generatePdfWithJsPdf(content: string): Promise<Buffer | null> {
  try {
    console.log('[jspdf] Starting jsPDF-based PDF generation...');
    
    // Create a new PDF document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    // Set up Arabic text handling
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxLineWidth = pageWidth - (margin * 2);
    
    // Set font size and line height
    const fontSize = 12;
    const lineHeight = 7;
    doc.setFontSize(fontSize);
    
    // Split content into lines
    const lines = content.split('\n');
    let y = margin;
    
    for (const line of lines) {
      // Check if we need a new page
      if (y > 280) { // A4 height is ~297mm, leaving margin
        doc.addPage();
        y = margin;
      }
      
      if (line.trim() === '') {
        y += lineHeight;
        continue;
      }
      
      // For Arabic text, we need to handle RTL
      const text = line.trim();
      
      // Check if text contains Arabic characters
      const hasArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDCF\uFDF0-\uFDFF\uFE70-\uFEFF]/.test(text);
      
      if (hasArabic) {
        // For Arabic text, align to the right
        const lines = doc.splitTextToSize(text, maxLineWidth);
        for (const textLine of lines) {
          if (y > 280) {
            doc.addPage();
            y = margin;
          }
          doc.text(textLine, pageWidth - margin, y, { align: 'right' });
          y += lineHeight;
        }
      } else {
        // For non-Arabic text, use normal left alignment
        const lines = doc.splitTextToSize(text, maxLineWidth);
        for (const textLine of lines) {
          if (y > 280) {
            doc.addPage();
            y = margin;
          }
          doc.text(textLine, margin, y);
          y += lineHeight;
        }
      }
    }
    
    // Convert to buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    console.log(`[jspdf] PDF generated successfully, size: ${pdfBuffer.length} bytes`);
    
    return pdfBuffer;
    
  } catch (error) {
    console.log('[jspdf] jsPDF generation failed:', error);
    return null;
  }
}
