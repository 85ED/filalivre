import { Router } from 'express';
import BarberController from '../controllers/BarberController.js';
import { authMiddleware, roleMiddleware } from '../middlewares/auth.js';

const router = Router();

// Protected routes
router.post('/', authMiddleware, roleMiddleware(['admin', 'owner']), BarberController.create);
router.get('/barbershop/:barbershopId', BarberController.getByBarbershop);
router.get('/available/:barbershopId', BarberController.getAvailable);
router.patch('/status', BarberController.updateStatus);
router.get('/:barberId', BarberController.getById);
router.patch('/:barberId', authMiddleware, roleMiddleware(['admin', 'owner']), BarberController.update);
router.delete('/:barberId', authMiddleware, roleMiddleware(['admin', 'owner']), BarberController.delete);

export default router;
