import StripeService from '../services/StripeService.js';
import Barbershop from '../models/Barbershop.js';
import Barber from '../models/Barber.js';

export class SubscriptionController {
  // POST /api/subscription/checkout — creates Stripe checkout session (per-seat)
  static async createCheckout(req, res, next) {
    try {
      if (!StripeService.isConfigured()) {
        return res.status(503).json({ error: 'Stripe não configurado. Configure STRIPE_SECRET_KEY.' });
      }

      const barbershopId = req.user?.barbershopId || req.body.barbershopId;
      if (!barbershopId) {
        return res.status(400).json({ error: 'barbershopId é obrigatório' });
      }

      const barbershop = await Barbershop.findById(barbershopId);
      if (!barbershop) return res.status(404).json({ error: 'Estabelecimento não encontrado' });

      // Count active professionals as seats
      const seatQuantity = await Barber.countActiveByBarbershop(barbershopId);
      if (seatQuantity === 0) {
        return res.status(400).json({ error: 'Cadastre pelo menos um profissional ativo antes de assinar.' });
      }

      const seatPriceCents = barbershop.seat_price_cents || 3500;

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
        seatPriceCents,
        seatQuantity,
        barbershopId,
        metadata: {
          user_id: req.user?.id,
          empresa_id: barbershopId,
        },
        successUrl: `${baseUrl}/assinatura?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${baseUrl}/assinatura`,
      });

      res.json({ checkout_url: session.url });
    } catch (error) {
      console.error('[Checkout] Error:', error?.message, error?.raw?.message);
      res.status(500).json({
        error: 'Erro ao criar sessão de checkout',
        message: error?.message || 'Erro desconhecido',
      });
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

  // GET /api/subscription/seat-info — returns seat info for the barbershop
  static async getSeatInfo(req, res, next) {
    try {
      const barbershopId = req.user?.barbershopId;
      if (!barbershopId) return res.status(400).json({ error: 'barbershopId obrigatório' });

      const barbershop = await Barbershop.findById(barbershopId);
      if (!barbershop) return res.status(404).json({ error: 'Estabelecimento não encontrado' });

      const activeCount = await Barber.countActiveByBarbershop(barbershopId);
      const seatPriceCents = barbershop.seat_price_cents || 3500;

      res.json({
        activeCount,
        seatPriceCents,
        totalCents: seatPriceCents * activeCount,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default SubscriptionController;
