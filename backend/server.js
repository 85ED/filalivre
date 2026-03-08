import './env.js';
import express from 'express';
import cors from 'cors';
import { errorHandler, notFoundHandler } from './src/middlewares/auth.js';
import authRoutes from './src/routes/auth.js';
import queueRoutes from './src/routes/queue.js';
import barberRoutes from './src/routes/barbers.js';
import barbershopRoutes from './src/routes/barbershops.js';
import whatsappRoutes from './src/routes/whatsapp.js';
import { checkQueueAlerts } from './src/workers/QueueAlertWorker.js';
import { runMigrations } from './src/seeds/migrate.js';
import { seedPlatformOwner } from './src/seeds/platformOwner.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
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
app.use('/api/whatsapp', whatsappRoutes);

// Queue alert worker - verifica a cada 5s e envia WhatsApp
setInterval(checkQueueAlerts, 5000);

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
const server = app.listen(PORT, async () => {
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
