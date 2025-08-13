# OCR العربية | Arabic OCR App

🚀 **High-end Arabic OCR application with futuristic UI/UX design**

A modern, production-ready Arabic OCR application built with React, TypeScript, and Express. Features advanced Arabic text recognition using Google Gemini and Mistral AI, with support for multiple export formats and beautiful glassmorphism design.

---

## ✨ Features | المميزات

### 🔍 OCR Capabilities
- **Multi-provider OCR**: Google Gemini & Mistral AI
- **Arabic text recognition**: Optimized for Arabic script
- **Multi-format support**: Images (JPG, PNG) and PDF files
- **Batch processing**: Upload multiple files at once

### 📄 Export Formats
- **TXT**: Plain text with RTL support
- **DOCX**: Microsoft Word with Arabic formatting
- **PDF**: High-quality PDFs with embedded fonts
- **EPUB**: Kindle-compatible ebooks

### 🎨 UI/UX Design
- **Glassmorphism**: Modern transparent design
- **Dark/Light modes**: Automatic theme switching
- **RTL support**: Proper Arabic text direction
- **Responsive**: Works on all devices
- **Font selection**: Cairo & Amiri Arabic fonts
- **Interactive icons**: Futuristic SVG icons

### 🔧 Technical Features
- **Production ready**: Optimized for Vercel deployment
- **Font embedding**: Custom fonts in all exports
- **Text justification**: Proper Arabic line spacing
- **Modern stack**: React 18, TypeScript, Tailwind CSS

---

## 🛠️ Tech Stack | التقنيات المستخدمة

### Frontend
- **React 18** with TypeScript
- **Vite** for build optimization
- **Tailwind CSS** for styling
- **Glassmorphism** design system

### Backend
- **Express.js** with TypeScript
- **Multer** for file uploads
- **Puppeteer** for PDF generation
- **DocX & EPUB-gen** for document creation

### AI Providers
- **Google Gemini** AI for OCR
- **Mistral AI** for alternative OCR

---

## 🚀 Quick Start | البدء السريع

### Prerequisites | المتطلبات
```bash
Node.js 18+ and npm
```

### Installation | التثبيت
```bash
# Clone the repository
git clone https://github.com/yourusername/ocr-arabic-app.git
cd ocr-arabic-app

# Install dependencies
npm run setup

# Start development
npm run dev
```

### Environment Variables | متغيرات البيئة
Create `.env` files in both `client` and `server` directories:

**server/.env**
```env
# AI API Keys
GEMINI_API_KEY=your_gemini_api_key
MISTRAL_API_KEY=your_mistral_api_key

# Server Configuration
PORT=5174
NODE_ENV=development
```

**client/.env**
```env
VITE_API_BASE=http://localhost:5174
```

---

## 📦 Deployment | النشر

### Vercel Deployment
1. **Connect your GitHub repository** to Vercel
2. **Set environment variables** in Vercel dashboard:
   - `GEMINI_API_KEY`
   - `MISTRAL_API_KEY`
3. **Deploy** - Vercel will automatically build and deploy

### Manual Build
```bash
# Build for production
npm run build

# Start production server
npm start
```

---

## 🎯 Usage | الاستخدام

### 1. Upload Files | رفع الملفات
- Drag and drop images or PDFs
- Or click "تصفح الملفات" to select files
- Support for multiple file upload

### 2. Select OCR Provider | اختيار مزود OCR
- **Gemini**: Google's advanced AI model
- **Mistral**: Alternative AI provider
- Switch between providers in the header

### 3. Process Files | معالجة الملفات
- Click "ابدأ OCR" to start processing
- View results in the results panel
- Preview extracted Arabic text

### 4. Choose Font | اختيار الخط
- Click "تغيير الخط" to open font modal
- Preview fonts with Arabic sample text
- Select from Cairo or Amiri font families

### 5. Export | التصدير
- Choose export format (TXT, DOCX, PDF, EPUB)
- Click "تنزيل" to download
- Files include selected font and RTL formatting

---

## 🎨 Design System | نظام التصميم

### Theme Colors | ألوان المظهر
- **Light Mode**: Background `#EBEBEB`, Text `#141414`
- **Dark Mode**: Background `#141414`, Text `#EBEBEB`
- **Glassmorphism**: Transparent cards with backdrop blur

### Typography | الخطوط
- **Cairo**: Modern Arabic sans-serif font
- **Amiri**: Traditional Arabic serif font
- **Multiple weights**: Regular, Bold, Light, Medium

### Icons | الأيقونات
- **Futuristic SVG icons**: Custom-designed
- **Interactive states**: Hover effects and animations
- **Social media icons**: Twitter, Telegram, YouTube, GitHub

---

## 🔧 API Reference | مرجع API

### OCR Endpoints
```javascript
// Upload files for OCR
POST /api/ocr/upload
Content-Type: multipart/form-data
Headers: { 'x-ocr-provider': 'gemini' | 'mistral' }

// Export processed text
POST /api/export/generate
Body: {
  filename: string,
  format: 'txt' | 'docx' | 'pdf' | 'epub',
  content: string,
  font?: string
}
```

### Font Management
```javascript
// Get available fonts
GET /api/fonts
Response: { fonts: Array<FontFamily> }
```

## 🙏 Acknowledgments | الشكر والتقدير

- 🐦 Twitter: [@python_ar](https://twitter.com/python_ar)
- 📱 Telegram: [@python4arabs](https://t.me/python4arabs)
- 🎥 YouTube: [@PythonArab](https://www.youtube.com/@PythonArab)


<div align="center">

**Made with ❤️ for the Python Arabic Community**

**صُنع بـ ❤️ لمجتمع بايثون العربي**

</div>