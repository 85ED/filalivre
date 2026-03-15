import StripeService from '../services/StripeService.js';
import Barbershop from '../models/Barbershop.js';
import pool from '../config/database.js';
import WhatsAppUsageService from '../services/WhatsAppUsageService.js';

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
  // Handle WhatsApp Credits Purchase
  if (session.metadata?.type === 'whatsapp_credits') {
    await handleWhatsAppCreditsPurchase(session);
    return;
  }

  // Handle Subscription Checkout
  const barbershopId = session.metadata?.barbershop_id;
  const subId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id;

  if (!barbershopId || !subId) return;

  const id = parseInt(barbershopId);
  const ok = await Barbershop.update(id, {
    stripe_subscription_id: subId,
    subscription_status: 'active',
    status_assinatura: 'ativa',
    ativo: 1,
  });
  console.log(`[Stripe][checkout.session.completed] event=checkout.session.completed subscription_id=${subId} empresa_id=${barbershopId} result=${ok ? 'updated' : 'no_change'}`);
}

/**
 * Processa compra bem-sucedida de créditos WhatsApp
 */
async function handleWhatsAppCreditsPurchase(session) {
  try {
    const barbershopId = parseInt(session.metadata?.barbershop_id);
    const packageQuantity = parseInt(session.metadata?.package_quantity);
    const sessionId = session.id;

    if (!barbershopId || !packageQuantity) {
      console.error('[Stripe Webhook] Invalid WhatsApp credits metadata:', session.metadata);
      return;
    }

    console.log(
      `[Stripe Webhook] Processing WhatsApp credits - Barbershop: ${barbershopId}, Package: ${packageQuantity}`
    );

    // Verificar se já foi processado
    const [existing] = await pool.query(
      `SELECT id
       FROM whatsapp_credits_log
       WHERE stripe_transaction_id = ?
         AND tipo_movimento = 'compra'
       LIMIT 1`,
      [sessionId]
    );

    if (existing && existing.length > 0) {
      console.log(`[Stripe Webhook] WhatsApp credits already credited for session ${sessionId}`);
      return;
    }

    await WhatsAppUsageService.addCredits(barbershopId, packageQuantity, sessionId);

    console.log(
      `[Stripe Webhook] Successfully added ${packageQuantity} WhatsApp credits to barbershop ${barbershopId}`
    );
  } catch (error) {
    console.error('[Stripe Webhook] handleWhatsAppCreditsPurchase error:', error);
    throw error;
  }
}

async function handlePaymentSucceeded(invoice) {
  const subscriptionId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.subscription?.id;
  if (!subscriptionId) return;

  const attemptCount = Number(invoice.attempt_count || 0);
  const paidAt = invoice.status_transitions?.paid_at
    ? new Date(invoice.status_transitions.paid_at * 1000)
    : new Date();

  const [rows] = await pool.query(
    'SELECT id FROM barbershops WHERE stripe_subscription_id = ? LIMIT 1',
    [subscriptionId]
  );

  let barbershopId = rows?.[0]?.id;
  if (!barbershopId) {
    try {
      const sub = await StripeService.retrieveSubscription(subscriptionId);
      const metaId = parseInt(sub?.metadata?.barbershop_id);
      if (metaId) barbershopId = metaId;
    } catch (e) {
      // ignore
    }
  }

  if (!barbershopId) {
    console.log(`[Stripe][invoice.payment_succeeded] event=invoice.payment_succeeded subscription_id=${subscriptionId} empresa_id=unknown attempt_count=${attemptCount} result=barbershop_not_found`);
    return;
  }

  const ok = await Barbershop.update(barbershopId, {
    subscription_status: 'active',
    status_assinatura: 'ativa',
    ativo: 1,
    data_ultimo_pagamento: paidAt,
    stripe_invoice_id: invoice.id,
    tentativas_pagamento: 0,
    proxima_tentativa_pagamento: null,
  });

  console.log(`[Stripe][invoice.payment_succeeded] event=invoice.payment_succeeded subscription_id=${subscriptionId} empresa_id=${barbershopId} attempt_count=${attemptCount} result=${ok ? 'updated' : 'no_change'}`);
}

async function handlePaymentFailed(invoice) {
  const subscriptionId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.subscription?.id;
  if (!subscriptionId) return;

  const attemptCount = Number(invoice.attempt_count || 0);
  const nextAttemptAt = invoice.next_payment_attempt
    ? new Date(invoice.next_payment_attempt * 1000)
    : null;

  const [rows] = await pool.query(
    'SELECT id, email, owner_name, name FROM barbershops WHERE stripe_subscription_id = ? LIMIT 1',
    [subscriptionId]
  );

  let barbershop = rows?.[0];
  if (!barbershop) {
    try {
      const sub = await StripeService.retrieveSubscription(subscriptionId);
      const metaId = parseInt(sub?.metadata?.barbershop_id);
      if (metaId) {
        const [fallback] = await pool.query(
          'SELECT id, email, owner_name, name FROM barbershops WHERE id = ? LIMIT 1',
          [metaId]
        );
        barbershop = fallback?.[0];
      }
    } catch (e) {
      // ignore
    }
  }

  if (!barbershop?.id) {
    console.log(`[Stripe][invoice.payment_failed] event=invoice.payment_failed subscription_id=${subscriptionId} empresa_id=unknown attempt_count=${attemptCount} next_payment_attempt=${nextAttemptAt ? nextAttemptAt.toISOString() : 'null'} result=barbershop_not_found`);
    return;
  }

  if (attemptCount < 3) {
    // manter conta ativa e avisar usuário
    const ok = await Barbershop.update(barbershop.id, {
      subscription_status: 'active',
      status_assinatura: 'ativa',
      ativo: 1,
      tentativas_pagamento: attemptCount,
      proxima_tentativa_pagamento: nextAttemptAt,
    });

    notifyPaymentFailure(barbershop, { attemptCount, nextAttemptAt }).catch(() => {});

    console.log(`[Stripe][invoice.payment_failed] event=invoice.payment_failed subscription_id=${subscriptionId} empresa_id=${barbershop.id} attempt_count=${attemptCount} next_payment_attempt=${nextAttemptAt ? nextAttemptAt.toISOString() : 'null'} result=${ok ? 'warned_active' : 'warned_active_no_change'}`);
    return;
  }

  // attempt_count >= 3 => bloquear
  const ok = await Barbershop.update(barbershop.id, {
    subscription_status: 'expired',
    status_assinatura: 'pendente_bloqueado',
    ativo: 0,
    tentativas_pagamento: attemptCount,
    proxima_tentativa_pagamento: nextAttemptAt,
  });

  console.log(`[Stripe][invoice.payment_failed] event=invoice.payment_failed subscription_id=${subscriptionId} empresa_id=${barbershop.id} attempt_count=${attemptCount} next_payment_attempt=${nextAttemptAt ? nextAttemptAt.toISOString() : 'null'} result=${ok ? 'blocked' : 'blocked_no_change'}`);
}

async function handleSubscriptionUpdated(subscription) {
  const barbershopId = subscription.metadata?.barbershop_id;
  if (!barbershopId) return;

  const id = parseInt(barbershopId);
  const stripeStatus = subscription.status;
  const subscriptionStatusMap = {
    active: 'active',
    trialing: 'trial',
    past_due: 'expired',
    unpaid: 'expired',
    canceled: 'cancelled',
    incomplete_expired: 'expired',
  };
  const statusAssinaturaMap = {
    active: 'ativa',
    trialing: 'ativa',
    past_due: 'ativa',
    unpaid: 'pendente_bloqueado',
    canceled: 'cancelada',
    incomplete_expired: 'pendente_bloqueado',
  };
  const ativoMap = {
    active: 1,
    trialing: 1,
    past_due: 1,
    unpaid: 0,
    canceled: 0,
    incomplete_expired: 0,
  };

  const ok = await Barbershop.update(id, {
    subscription_status: subscriptionStatusMap[stripeStatus] || 'expired',
    status_assinatura: statusAssinaturaMap[stripeStatus] || 'pendente_bloqueado',
    ativo: ativoMap[stripeStatus] ?? 0,
    stripe_subscription_id: subscription.id,
  });
  console.log(`[Stripe][customer.subscription.updated] event=customer.subscription.updated subscription_id=${subscription.id} empresa_id=${id} result=${ok ? 'updated' : 'no_change'} stripe_status=${stripeStatus}`);
}

async function handleSubscriptionDeleted(subscription) {
  const barbershopId = subscription.metadata?.barbershop_id;
  if (!barbershopId) return;

  const id = parseInt(barbershopId);
  const ok = await Barbershop.update(id, {
    subscription_status: 'cancelled',
    status_assinatura: 'cancelada',
    ativo: 0,
    stripe_subscription_id: null,
  });
  console.log(`[Stripe][customer.subscription.deleted] event=customer.subscription.deleted subscription_id=${subscription.id} empresa_id=${id} result=${ok ? 'updated' : 'no_change'}`);
}

async function notifyPaymentFailure(barbershop, { attemptCount, nextAttemptAt }) {
  const email = barbershop.email;
  if (!email || !process.env.SENDGRID_API_KEY) return;

  const sgMail = (await import('@sendgrid/mail')).default;
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const next = nextAttemptAt ? new Date(nextAttemptAt).toLocaleString('pt-BR') : 'em breve';
  const subject = `FilaLivre — Falha no pagamento (tentativa ${attemptCount})`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="margin:0 0 12px;">Falha no pagamento da assinatura</h2>
      <p style="margin:0 0 8px;">Identificamos uma falha no pagamento da sua assinatura.</p>
      <p style="margin:0 0 8px;"><strong>Tentativa:</strong> ${attemptCount} (de 3)</p>
      <p style="margin:0 0 8px;"><strong>Próxima tentativa:</strong> ${next}</p>
      <p style="margin:16px 0 0;">Você pode atualizar seu método de pagamento no portal de cobrança.</p>
    </div>
  `;

  await sgMail.send({
    to: email,
    from: 'no-reply@filalivre.app.br',
    subject,
    html,
  });
}

export default StripeWebhookController;
