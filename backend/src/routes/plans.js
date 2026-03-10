import { Router } from 'express';
import SubscriptionPlan from '../models/SubscriptionPlan.js';
import { authMiddleware, roleMiddleware } from '../middlewares/auth.js';

const router = Router();

// Public: list active plans (for subscription page)
router.get('/', async (req, res, next) => {
  try {
    const plans = await SubscriptionPlan.findActive();
    res.json({ plans });
  } catch (error) {
    next(error);
  }
});

// Platform owner: list ALL plans (including inactive)
router.get('/all', authMiddleware, roleMiddleware(['platform_owner']), async (req, res, next) => {
  try {
    const plans = await SubscriptionPlan.findAll();
    res.json({ plans });
  } catch (error) {
    next(error);
  }
});

// Platform owner: create plan
router.post('/', authMiddleware, roleMiddleware(['platform_owner']), async (req, res, next) => {
  try {
    const { name, price_cents, interval, features, stripe_price_id } = req.body;
    if (!name || !price_cents) {
      return res.status(400).json({ error: 'Nome e preço são obrigatórios' });
    }
    const id = await SubscriptionPlan.create({ name, price_cents, interval, features, stripe_price_id });
    const plan = await SubscriptionPlan.findById(id);
    res.status(201).json(plan);
  } catch (error) {
    next(error);
  }
});

// Platform owner: update plan
router.patch('/:id', authMiddleware, roleMiddleware(['platform_owner']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const plan = await SubscriptionPlan.findById(parseInt(id));
    if (!plan) return res.status(404).json({ error: 'Plano não encontrado' });
    await SubscriptionPlan.update(parseInt(id), req.body);
    const updated = await SubscriptionPlan.findById(parseInt(id));
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Platform owner: delete plan
router.delete('/:id', authMiddleware, roleMiddleware(['platform_owner']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const plan = await SubscriptionPlan.findById(parseInt(id));
    if (!plan) return res.status(404).json({ error: 'Plano não encontrado' });
    await SubscriptionPlan.delete(parseInt(id));
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
