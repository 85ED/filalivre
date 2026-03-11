import './env.js';
import express from 'express';
import cors from 'cors';
import { errorHandler, notFoundHandler, authMiddleware, roleMiddleware } from './src/middlewares/auth.js';
import authRoutes from './src/routes/auth.js';
import queueRoutes from './src/routes/queue.js';
import barberRoutes from './src/routes/barbers.js';
import barbershopRoutes from './src/routes/barbershops.js';
import SubscriptionController from './src/controllers/SubscriptionController.js';
import StripeWebhookController from './src/controllers/StripeWebhookController.js';
import { runMigrations } from './src/seeds/migrate.js';
import { seedPlatformOwner } from './src/seeds/platformOwner.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
const allowedOrigins = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (allowedOrigins.includes('*') || !origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
}));

// Stripe webhook needs raw body — must be before express.json()
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), StripeWebhookController.handle);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/barbers', barberRoutes);
app.use('/api/barbershops', barbershopRoutes);

// Subscription (Stripe) — per-seat model
app.post('/api/subscription/checkout', authMiddleware, roleMiddleware(['admin', 'owner']), SubscriptionController.createCheckout);
app.post('/api/subscription/portal', authMiddleware, roleMiddleware(['admin', 'owner']), SubscriptionController.getPortalSession);
app.get('/api/subscription/seat-info', authMiddleware, roleMiddleware(['admin', 'owner']), SubscriptionController.getSeatInfo);

// WhatsApp — proxy requests to filalivre-whatsapp microservice
const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:3003';
app.use('/api/whatsapp', async (req, res) => {
  try {
    // Strip /api/whatsapp prefix from the path (use baseUrl which contains the prefix)
    // req.originalUrl might have query params, so we subtract the prefix more carefully
    // Example: /api/whatsapp/status/1 → /status/1
    const relativePath = req.originalUrl.replace(/^\/api\/whatsapp/, '') || '/';
    const targetUrl = `${WHATSAPP_SERVICE_URL}${relativePath}`;
    console.log(`[WhatsApp Proxy] ${req.method} ${req.path} → ${targetUrl}`);
    const fetchOptions = { 
      method: req.method, 
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000 // 15s timeout (increased from 10s)
    };
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }
    console.log(`[WhatsApp Proxy] [DEBUG] Fazendo fetch para: ${targetUrl}`);
    const response = await fetch(targetUrl, fetchOptions);
    console.log(`[WhatsApp Proxy] [DEBUG] Resposta recebida: ${response.status}`);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    const errorType = err.code || err.name || 'UNKNOWN';
    const errorMsg = err.message || 'Unknown error';
    console.error(`[WhatsApp Proxy] [ERROR] Tipo: ${errorType}`);
    console.error(`[WhatsApp Proxy] [ERROR] Mensagem: ${errorMsg}`);
    console.error(`[WhatsApp Proxy] [ERROR] Stack:`, err.stack);
    console.error(`[WhatsApp Proxy] [ERROR] Tentando conectar a: ${WHATSAPP_SERVICE_URL}`);
    res.status(503).json({ 
      error: 'Serviço WhatsApp indisponível',
      details: process.env.NODE_ENV === 'development' ? {
        errorType,
        errorMsg,
        targetUrl: WHATSAPP_SERVICE_URL
      } : undefined
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// Run migrations and seed on startup
async function bootstrap() {
  try {
    await runMigrations();
    await seedPlatformOwner();
  } catch (err) {
    console.error('[Bootstrap] Error:', err.message);
  }
}

// Start server
const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`
╔════════════════════════════════════════╗
║  FilaLivre Backend Server Started      ║
║  Port: ${PORT}                         
║  Environment: ${process.env.NODE_ENV || 'development'}
║  CORS Origin: ${process.env.CORS_ORIGIN || 'any'}
╚════════════════════════════════════════╝
  `);
  await bootstrap();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
