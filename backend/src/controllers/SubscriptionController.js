import StripeService from '../services/StripeService.js';
import Barbershop from '../models/Barbershop.js';
import SubscriptionPlan from '../models/SubscriptionPlan.js';

export class SubscriptionController {
  // POST /api/subscription/checkout — creates Stripe checkout session
  static async createCheckout(req, res, next) {
    try {
      if (!StripeService.isConfigured()) {
        return res.status(503).json({ error: 'Stripe não configurado. Configure STRIPE_SECRET_KEY.' });
      }

      const { planId } = req.body;
      const barbershopId = req.user?.barbershopId || req.body.barbershopId;

      if (!barbershopId || !planId) {
        return res.status(400).json({ error: 'barbershopId e planId são obrigatórios' });
      }

      const [barbershop, plan] = await Promise.all([
        Barbershop.findById(barbershopId),
        SubscriptionPlan.findById(planId),
      ]);

      if (!barbershop) return res.status(404).json({ error: 'Estabelecimento não encontrado' });
      if (!plan || !plan.active) return res.status(404).json({ error: 'Plano não encontrado ou inativo' });

      // Create or reuse Stripe customer
      let customerId = barbershop.stripe_customer_id;
      if (!customerId) {
        const customer = await StripeService.createCustomer({
          email: barbershop.email || req.user?.email,
          name: barbershop.owner_name || barbershop.name,
          barbershopId,
        });
        customerId = customer.id;
        await Barbershop.update(barbershopId, { stripe_customer_id: customerId });
      }

      const baseUrl = process.env.APP_URL || 'http://localhost:5173';
      const session = await StripeService.createCheckoutSession({
        customerId,
        planPriceCents: plan.price_cents,
        planName: plan.name,
        planInterval: plan.interval,
        barbershopId,
        successUrl: `${baseUrl}/assinatura?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${baseUrl}/assinatura`,
      });

      res.json({ checkout_url: session.url });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/subscription/portal — creates Stripe billing portal session
  static async getPortalSession(req, res, next) {
    try {
      if (!StripeService.isConfigured()) {
        return res.status(503).json({ error: 'Stripe não configurado' });
      }

      const barbershopId = req.user?.barbershopId;
      if (!barbershopId) return res.status(400).json({ error: 'barbershopId obrigatório' });

      const barbershop = await Barbershop.findById(barbershopId);
      if (!barbershop?.stripe_customer_id) {
        return res.status(400).json({ error: 'Nenhuma assinatura Stripe encontrada' });
      }

      const baseUrl = process.env.APP_URL || 'http://localhost:5173';
      const session = await StripeService.createPortalSession({
        customerId: barbershop.stripe_customer_id,
        returnUrl: `${baseUrl}/assinatura`,
      });

      res.json({ portal_url: session.url });
    } catch (error) {
      next(error);
    }
  }
}

export default SubscriptionController;
