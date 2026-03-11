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
const WHATSAPP_FALLBACK_URLS = [
  WHATSAPP_SERVICE_URL,
  'http://filalivre-whatsapp.railway.internal:3003',
  'http://filalivre-whatsapp:3003',
];

// Diagnostic endpoint to test WhatsApp connectivity
app.get('/api/whatsapp-diagnostic', async (req, res) => {
  console.log('[Diagnostic] Testing WhatsApp connectivity...');
  const results = [];
  
  for (const url of WHATSAPP_FALLBACK_URLS) {
    try {
      const testUrl = `${url}/health`;
      console.log(`[Diagnostic] Tentando: ${testUrl}`);
      const response = await fetch(testUrl, { timeout: 3000 });
      const data = await response.json();
      results.push({
        url,
        status: 'SUCCESS',
        httpStatus: response.status,
        response: data
      });
      console.log(`[Diagnostic] ✓ Sucesso: ${url}`);
      break; // Stop on first success
    } catch (err) {
      results.push({
        url,
        status: 'FAILED',
        error: err.message,
        errorCode: err.code,
        errorName: err.name
      });
      console.error(`[Diagnostic] ✗ Falhou ${url}: ${err.code || err.name} - ${err.message}`);
    }
  }
  
  res.json({
    primary_url: WHATSAPP_SERVICE_URL,
    fallback_urls: WHATSAPP_FALLBACK_URLS,
    test_results: results,
    timestamp: new Date()
  });
});

app.use('/api/whatsapp', async (req, res) => {
  const relativePath = req.originalUrl.replace(/^\/api\/whatsapp/, '') || '/';
  
  let lastError = null;
  let successUrl = null;
  
  // Try each URL in sequence
  for (const baseUrl of WHATSAPP_FALLBACK_URLS) {
    try {
      const targetUrl = `${baseUrl}${relativePath}`;
      console.log(`[WhatsApp Proxy] [${req.method}] Tentando: ${targetUrl}`);
      
      const fetchOptions = { 
        method: req.method, 
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      };
      
      if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
        fetchOptions.body = JSON.stringify(req.body);
      }
      
      const response = await fetch(targetUrl, fetchOptions);
      const data = await response.json();
      
      successUrl = baseUrl;
      console.log(`[WhatsApp Proxy] ✓ Sucesso com ${baseUrl}: HTTP ${response.status}`);
      return res.status(response.status).json(data);
      
    } catch (err) {
      lastError = {
        url: baseUrl,
        code: err.code,
        name: err.name,
        message: err.message
      };
      console.error(`[WhatsApp Proxy] ✗ Falhou ${baseUrl}: ${err.code || err.name} - ${err.message}`);
      // Continue to next URL
    }
  }
  
  // All attempts failed
  console.error('[WhatsApp Proxy] [CRITICAL] Todas as tentativas falharam para o WhatsApp Service');
  res.status(503).json({ 
    error: 'Serviço WhatsApp indisponível',
    details: process.env.NODE_ENV === 'development' ? {
      tried_urls: WHATSAPP_FALLBACK_URLS,
      last_error: lastError,
      env_url: WHATSAPP_SERVICE_URL
    } : undefined
  });
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
