import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

// WhatsApp service URL - production Railway URL as fallback
process.env.WHATSAPP_SERVICE_URL =
  process.env.WHATSAPP_SERVICE_URL ||
  'https://filalivre-whatsapp-production.up.railway.app';
