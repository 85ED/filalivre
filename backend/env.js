import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

// WhatsApp service URL - production Railway URL as fallback
process.env.WHATSAPP_SERVICE_URL =
  process.env.WHATSAPP_SERVICE_URL ||
  'https://filalivre-whatsapp-production.up.railway.app';

// WhatsApp Credits Packages — used by Stripe for checkout
export const WHATSAPP_CREDIT_PACKAGES = [
  {
    quantity: '100',
    name: '100 Notificações',
    description: '~1 semana de uso (15 notificações/dia)',
    price: 1000, // R$10 em centavos
    currency: 'brl',
  },
  {
    quantity: '250',
    name: '250 Notificações',
    description: '~3 semanas de uso (35 notificações/dia)',
    price: 2000, // R$20 em centavos
    currency: 'brl',
  },
  {
    quantity: '700',
    name: '700 Notificações',
    description: '~2 meses de uso (90 notificações/dia)',
    price: 5000, // R$50 em centavos
    currency: 'brl',
  },
];
