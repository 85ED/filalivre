import StripeService from '../services/StripeService.js';
import Barbershop from '../models/Barbershop.js';
import pool from '../config/database.js';

export class StripeWebhookController {
  static async handle(req, res) {
    if (!StripeService.isConfigured()) {
      return res.status(503).json({ error: 'Stripe not configured' });
    }

    const sig = req.headers['stripe-signature'];
    let event;
    try {
      event = StripeService.constructEvent(req.body, sig);
    } catch (err) {
      console.error('[Stripe Webhook] Signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutCompleted(event.data.object);
          break;
        case 'invoice.payment_succeeded':
          await handlePaymentSucceeded(event.data.object);
          break;
        case 'invoice.payment_failed':
          await handlePaymentFailed(event.data.object);
          break;
        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object);
          break;
        default:
          console.log(`[Stripe Webhook] Unhandled event: ${event.type}`);
      }
    } catch (err) {
      console.error(`[Stripe Webhook] Error handling ${event.type}:`, err.message);
    }

    res.json({ received: true });
  }
}

async function handleCheckoutCompleted(session) {
  const barbershopId = session.metadata?.barbershop_id;
  const subId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id;

  if (!barbershopId || !subId) return;

  await Barbershop.update(parseInt(barbershopId), {
    stripe_subscription_id: subId,
    subscription_status: 'active',
  });
  console.log(`[Stripe] Checkout completed: barbershop ${barbershopId}`);
}

async function handlePaymentSucceeded(invoice) {
  if (!invoice.subscription) return;
  const [rows] = await pool.query(
    'SELECT id FROM barbershops WHERE stripe_subscription_id = ? LIMIT 1',
    [invoice.subscription]
  );
  if (rows.length > 0) {
    await Barbershop.update(rows[0].id, { subscription_status: 'active' });
    console.log(`[Stripe] Payment succeeded: barbershop ${rows[0].id}`);
  }
}

async function handlePaymentFailed(invoice) {
  if (!invoice.subscription) return;
  const [rows] = await pool.query(
    'SELECT id FROM barbershops WHERE stripe_subscription_id = ? LIMIT 1',
    [invoice.subscription]
  );
  if (rows.length > 0) {
    await Barbershop.update(rows[0].id, { subscription_status: 'expired' });
    console.log(`[Stripe] Payment failed: barbershop ${rows[0].id}`);
  }
}

async function handleSubscriptionUpdated(subscription) {
  const barbershopId = subscription.metadata?.barbershop_id;
  if (!barbershopId) return;

  const statusMap = { active: 'active', past_due: 'expired', unpaid: 'expired', canceled: 'cancelled' };
  await Barbershop.update(parseInt(barbershopId), {
    subscription_status: statusMap[subscription.status] || 'expired',
  });
  console.log(`[Stripe] Subscription updated: barbershop ${barbershopId} → ${subscription.status}`);
}

async function handleSubscriptionDeleted(subscription) {
  const barbershopId = subscription.metadata?.barbershop_id;
  if (!barbershopId) return;

  await Barbershop.update(parseInt(barbershopId), {
    subscription_status: 'cancelled',
    stripe_subscription_id: null,
  });
  console.log(`[Stripe] Subscription deleted: barbershop ${barbershopId}`);
}

export default StripeWebhookController;
