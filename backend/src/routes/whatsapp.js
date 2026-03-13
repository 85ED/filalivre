import express from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import WhatsAppController from '../controllers/WhatsAppController.js';

const router = express.Router();

// Session management endpoints
router.post('/start/:barbershopId', WhatsAppController.start);
router.post('/connect/:barbershopId', WhatsAppController.connect);
router.post('/disconnect/:barbershopId', WhatsAppController.disconnect);
router.get('/status/:barbershopId', WhatsAppController.status);
router.get('/qr/:barbershopId', WhatsAppController.qr);

// Usage and credits endpoints (require authentication)
router.get('/usage', authMiddleware, WhatsAppController.getUsage);
router.post('/buy-credits', authMiddleware, WhatsAppController.buyCredits);

export default router;

