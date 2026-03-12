import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
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

  static async createCheckoutSession({ customerId, customerEmail, seatPriceCents, seatQuantity, barbershopId, successUrl, cancelUrl }) {
    if (!stripe) throw new Error('Stripe não configurado');
    const params = {
      mode: 'subscription',
      locale: 'pt-BR',
      line_items: [{
        price_data: {
          currency: 'brl',
          product_data: { name: 'FilaLivre — Por Profissional' },
          unit_amount: seatPriceCents,
          recurring: { interval: 'month' },
        },
        quantity: seatQuantity,
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { 
        type: 'subscription',
        barbershop_id: String(barbershopId) 
      },
      subscription_data: { 
        metadata: { 
          type: 'subscription',
          barbershop_id: String(barbershopId) 
        } 
      },
    };
    if (customerId) params.customer = customerId;
    else if (customerEmail) params.customer_email = customerEmail;
    return stripe.checkout.sessions.create(params);
  }

  static async createWhatsAppCreditsSession({ barbershopId, packageQuantity, successUrl, cancelUrl }) {
    if (!stripe) throw new Error('Stripe não configurado');
    
    // Importar pacotes de créditos WhatsApp
    const { WHATSAPP_CREDIT_PACKAGES } = await import('../../env.js');
    
    // Validar pacote
    const selectedPackage = WHATSAPP_CREDIT_PACKAGES.find(
      (p) => p.quantity === packageQuantity.toString()
    );
    if (!selectedPackage) {
      throw new Error(
        `Invalid package: ${packageQuantity}. Available: ${WHATSAPP_CREDIT_PACKAGES.map((p) => p.quantity).join(', ')}`
      );
    }

    // Criar sessão Stripe de pagamento único (one-time payment)
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      locale: 'pt-BR',
      line_items: [
        {
          price_data: {
            currency: selectedPackage.currency,
            product_data: {
              name: selectedPackage.name,
              description: selectedPackage.description,
            },
            unit_amount: selectedPackage.price,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      // Guardar informações para usar no webhook
      metadata: {
        type: 'whatsapp_credits',
        barbershop_id: barbershopId.toString(),
        package_quantity: packageQuantity.toString(),
      },
    });

    return {
      sessionId: session.id,
      url: session.url,
    };
  }

  static async updateSubscriptionQuantity(subscriptionId, newQuantity) {
    if (!stripe) throw new Error('Stripe não configurado');
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (!subscription || !subscription.items?.data?.length) return null;
    return stripe.subscriptions.update(subscriptionId, {
      items: [{
        id: subscription.items.data[0].id,
        quantity: newQuantity,
      }],
      proration_behavior: 'create_prorations',
    });
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
