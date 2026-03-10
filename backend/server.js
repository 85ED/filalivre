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

const WHATSAPP_ENABLED = process.env.WHATSAPP_ENABLED === 'true';

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

// WhatsApp routes and worker (requires Chrome/Puppeteer - disabled in minimal containers)
if (WHATSAPP_ENABLED) {
  const whatsappRoutes = (await import('./src/routes/whatsapp.js')).default;
  const { checkQueueAlerts } = await import('./src/workers/QueueAlertWorker.js');
  app.use('/api/whatsapp', whatsappRoutes);
  setInterval(checkQueueAlerts, 5000);
  console.log('[WhatsApp] Enabled');
} else {
  app.use('/api/whatsapp', (req, res) => {
    res.status(503).json({ error: 'WhatsApp não está habilitado neste servidor' });
  });
  console.log('[WhatsApp] Disabled (set WHATSAPP_ENABLED=true to enable)');
}

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
