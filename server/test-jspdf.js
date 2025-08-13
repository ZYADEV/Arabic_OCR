// Test jsPDF functionality
const { generatePdfWithJsPdf } = require('./dist/utils/jsPdfGenerator');

async function testJsPdfGeneration() {
  console.log('Testing jsPDF generation...');
  
  const testContent = `اختبار النص العربي

هذا نص تجريبي باللغة العربية لاختبار وظيفة تصدير PDF باستخدام jsPDF.

الفصل الأول: مقدمة

هذا النص يجب أن يظهر بشكل صحيح في ملف PDF مع دعم للغة العربية.

نص مختلط: This is mixed Arabic والانجليزية content to test both directions.`;

  try {
    const result = await generatePdfWithJsPdf(testContent);
    
    if (result && result.length > 0) {
      console.log('✅ jsPDF generation successful!');
      console.log(`PDF size: ${result.length} bytes`);
      return true;
    } else {
      console.error('❌ jsPDF generation returned empty result');
      return false;
    }
  } catch (error) {
    console.error('❌ jsPDF generation failed:', error);
    return false;
  }
}

// Run the test
testJsPdfGeneration().then(success => {
  console.log(success ? '🎉 jsPDF test passed!' : '💥 jsPDF test failed!');
  process.exit(success ? 0 : 1);
});
