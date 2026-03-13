import { Router } from 'express';
import QueueController from '../controllers/QueueController.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = Router();

// Public routes (can be protected based on deployment strategy)
router.post('/join', QueueController.join);
router.get('/recover', QueueController.recover); // Must be before /:barbershopId to avoid conflict
router.get('/:barbershopId', QueueController.getQueue);
router.post('/call-next', QueueController.callNext);
router.post('/accept', QueueController.acceptClient);
router.post('/finish', QueueController.finishClient);
router.post('/remove', QueueController.remove);
router.post('/skip', QueueController.skip);
router.get('/monitor/:barbershopId', QueueController.monitor);
router.get('/history/:barbershopId', QueueController.history);

export default router;
