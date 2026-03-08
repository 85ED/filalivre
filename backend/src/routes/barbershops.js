import { Router } from 'express';
import BarbershopController from '../controllers/BarbershopController.js';
import { authMiddleware, roleMiddleware } from '../middlewares/auth.js';

const router = Router();

// Public routes
router.get('/', BarbershopController.getAll);
router.get('/id/:id', BarbershopController.getById);
router.get('/slug/:slug', BarbershopController.getBySlug);
router.get('/:id/status', BarbershopController.getStatus);
router.get('/:id/reports', BarbershopController.getReports);
router.get('/:id/reports/barber/:barberId', BarbershopController.getBarberReport);

// Protected routes
router.post('/', authMiddleware, roleMiddleware(['owner']), BarbershopController.create);
router.patch('/:id', authMiddleware, roleMiddleware(['owner', 'admin']), BarbershopController.update);
router.delete('/:id', authMiddleware, roleMiddleware(['owner']), BarbershopController.delete);

export default router;
