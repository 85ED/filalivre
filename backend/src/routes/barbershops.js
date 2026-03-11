import { Router } from 'express';
import BarbershopController from '../controllers/BarbershopController.js';
import { authMiddleware, roleMiddleware } from '../middlewares/auth.js';

const router = Router();

// Public routes
router.get('/public-price', BarbershopController.getPublicPrice);
router.get('/', BarbershopController.getAll);
router.get('/id/:id', BarbershopController.getById);
router.get('/slug/:slug', BarbershopController.getBySlug);
router.get('/:id/status', BarbershopController.getStatus);
router.get('/:id/reports', BarbershopController.getReports);
router.get('/:id/reports/barber/:barberId', BarbershopController.getBarberReport);
router.get('/:id/subscription', BarbershopController.getSubscription);

// Platform owner routes
router.get('/platform/stats', authMiddleware, roleMiddleware(['platform_owner']), BarbershopController.getPlatformStats);
router.patch('/public-price', authMiddleware, roleMiddleware(['platform_owner']), BarbershopController.updatePublicPrice);

// Protected routes
router.post('/', authMiddleware, roleMiddleware(['platform_owner', 'owner']), BarbershopController.create);
router.patch('/:id', authMiddleware, roleMiddleware(['platform_owner', 'owner', 'admin']), BarbershopController.update);
router.delete('/:id', authMiddleware, roleMiddleware(['platform_owner', 'owner']), BarbershopController.delete);

export default router;
