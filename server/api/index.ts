// Vercel server project entry – bridges to the existing Express app
import app from '../src/index';
export const config = { api: { bodyParser: false } };
export default app;
