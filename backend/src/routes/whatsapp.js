import { Router } from 'express';
import WhatsAppController from '../controllers/WhatsAppController.js';

const router = Router();

router.post('/connect/:barbershopId', WhatsAppController.connect);
router.post('/disconnect/:barbershopId', WhatsAppController.disconnect);
router.get('/status/:barbershopId', WhatsAppController.status);
router.get('/qr/:barbershopId', WhatsAppController.qr);

export default router;
