// Simple test script to verify PDF export functionality
const { exportPdf } = require('./dist/utils/exporters');

async function testPdfExport() {
  console.log('Testing PDF export functionality...');
  
  const testContent = `اختبار النص العربي

هذا نص تجريبي باللغة العربية لاختبار وظيفة تصدير PDF. يحتوي على عدة فقرات لاختبار التخطيط والتنسيق الصحيح.

الفصل الأول: مقدمة

هذا النص يجب أن يظهر بشكل صحيح في ملف PDF مع دعم كامل للغة العربية واتجاه النص من اليمين إلى اليسار.

تجربة النص الطويل: هذا نص طويل لاختبار كيفية التعامل مع النصوص الطويلة والفقرات المتعددة في ملف PDF المُصدَّر. يجب أن يكون التنسيق صحيحاً وأن يظهر النص بشكل واضح ومقروء.`;

  try {
    const result = await exportPdf('test-arabic', testContent);
    
    if (result && result.base64 && result.filename && result.mime) {
      console.log('✅ PDF export test successful!');
      console.log(`Filename: ${result.filename}`);
      console.log(`MIME type: ${result.mime}`);
      console.log(`Base64 length: ${result.base64.length}`);
      return true;
    } else {
      console.error('❌ PDF export returned invalid result:', result);
      return false;
    }
  } catch (error) {
    console.error('❌ PDF export test failed:', error);
    return false;
  }
}

// Run the test
testPdfExport().then(success => {
  console.log(success ? '🎉 All tests passed!' : '💥 Tests failed!');
  process.exit(success ? 0 : 1);
});
