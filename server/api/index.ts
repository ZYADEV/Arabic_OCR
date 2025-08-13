// Vercel server project entry – bridges to the existing Express app
import app from '../src/index';
// Hint bundler to include ESM-only deps used via dynamic import in exporters
try { require.resolve('@sparticuz/chromium'); } catch {}
try { require.resolve('puppeteer-core'); } catch {}
export const config = { api: { bodyParser: false } };
export default app;
