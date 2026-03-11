import { Router } from 'express';
import AuthController from '../controllers/AuthController.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = Router();

// Public routes
router.post('/login', AuthController.login);
router.post('/register', AuthController.register);
router.post('/signup', AuthController.signup);
router.post('/forgot-password', AuthController.forgotPassword);
router.post('/reset-password', AuthController.resetPassword);

// Protected routes
router.get('/me', authMiddleware, AuthController.me);

export default router;
