import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18' })
  : null;

export class StripeService {
  static isConfigured() {
    return !!stripe;
  }

  static async createCustomer({ email, name, barbershopId }) {
    if (!stripe) throw new Error('Stripe não configurado');
    return stripe.customers.create({
      email,
      name,
      metadata: { barbershop_id: String(barbershopId), source: 'filalivre' },
    });
  }

  static async createCheckoutSession({ customerId, customerEmail, planPriceCents, planName, planInterval, barbershopId, successUrl, cancelUrl }) {
    if (!stripe) throw new Error('Stripe não configurado');
    const params = {
      mode: 'subscription',
      payment_method_types: ['card'],
      locale: 'pt-BR',
      line_items: [{
        price_data: {
          currency: 'brl',
          product_data: { name: `FilaLivre — ${planName}` },
          unit_amount: planPriceCents,
          recurring: { interval: planInterval === 'yearly' ? 'year' : 'month' },
        },
        quantity: 1,
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { barbershop_id: String(barbershopId), plan_name: planName },
      subscription_data: { metadata: { barbershop_id: String(barbershopId) } },
    };
    if (customerId) params.customer = customerId;
    else if (customerEmail) params.customer_email = customerEmail;
    return stripe.checkout.sessions.create(params);
  }

  static async createPortalSession({ customerId, returnUrl }) {
    if (!stripe) throw new Error('Stripe não configurado');
    return stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }

  static constructEvent(rawBody, signature) {
    if (!stripe) throw new Error('Stripe não configurado');
    const secrets = [
      process.env.STRIPE_WEBHOOK_SECRET,
      process.env.STRIPE_WEBHOOK_SECRET_MIN,
    ].filter(Boolean);

    let event;
    let lastErr;
    for (const secret of secrets) {
      try {
        event = stripe.webhooks.constructEvent(rawBody, signature, secret);
        break;
      } catch (err) {
        lastErr = err;
      }
    }
    if (!event) throw lastErr || new Error('Webhook signature verification failed');
    return event;
  }
}

export default StripeService;
