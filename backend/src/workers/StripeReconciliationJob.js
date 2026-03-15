import StripeService from '../services/StripeService.js';
import Barbershop from '../models/Barbershop.js';
import pool from '../config/database.js';

function mapSubscriptionToDb(subscription) {
  const stripeStatus = subscription?.status;

  // Defaults: be conservative (don’t block on uncertain states)
  let subscription_status = 'expired';
  let status_assinatura = 'pendente_bloqueado';
  let ativo = 0;

  if (stripeStatus === 'active') {
    subscription_status = 'active';
    status_assinatura = 'ativa';
    ativo = 1;
  } else if (stripeStatus === 'trialing') {
    subscription_status = 'trial';
    status_assinatura = 'ativa';
    ativo = 1;
  } else if (stripeStatus === 'past_due') {
    // Spec: keep account active and warn; reconciliation should not block users here
    subscription_status = 'active';
    status_assinatura = 'ativa';
    ativo = 1;
  } else if (stripeStatus === 'unpaid') {
    subscription_status = 'expired';
    status_assinatura = 'pendente_bloqueado';
    ativo = 0;
  } else if (stripeStatus === 'canceled') {
    subscription_status = 'cancelled';
    status_assinatura = 'cancelada';
    ativo = 0;
  } else if (stripeStatus === 'incomplete_expired') {
    subscription_status = 'expired';
    status_assinatura = 'pendente_bloqueado';
    ativo = 0;
  }

  return { subscription_status, status_assinatura, ativo };
}

async function resolveBarbershopId(subscription) {
  const metaId = parseInt(subscription?.metadata?.barbershop_id);
  if (metaId) return metaId;

  const subId = subscription?.id;
  if (!subId) return null;

  const [rows] = await pool.query(
    'SELECT id FROM barbershops WHERE stripe_subscription_id = ? LIMIT 1',
    [subId]
  );
  return rows?.[0]?.id || null;
}

export async function reconcileStripeOnce({ pageLimit = 100 } = {}) {
  if (!StripeService.isConfigured()) {
    console.log('[Stripe Recon] Stripe not configured — skipping');
    return { ok: true, skipped: true };
  }

  let startingAfter;
  let processed = 0;
  let updated = 0;
  let notFound = 0;

  while (true) {
    const page = await StripeService.listSubscriptions({
      status: 'all',
      limit: pageLimit,
      startingAfter,
    });

    const subs = page?.data || [];
    if (subs.length === 0) break;

    for (const sub of subs) {
      processed++;
      const barbershopId = await resolveBarbershopId(sub);
      if (!barbershopId) {
        notFound++;
        console.log(`[Stripe Recon] subscription_id=${sub.id} empresa_id=unknown result=barbershop_not_found status=${sub.status}`);
        continue;
      }

      const mapped = mapSubscriptionToDb(sub);
      const ok = await Barbershop.update(barbershopId, {
        stripe_subscription_id: sub.id,
        subscription_status: mapped.subscription_status,
        status_assinatura: mapped.status_assinatura,
        ativo: mapped.ativo,
      });

      if (ok) updated++;
      console.log(`[Stripe Recon] subscription_id=${sub.id} empresa_id=${barbershopId} result=${ok ? 'updated' : 'no_change'} status=${sub.status}`);
    }

    startingAfter = subs[subs.length - 1].id;
    if (!page?.has_more) break;
  }

  console.log(`[Stripe Recon] summary processed=${processed} updated=${updated} notFound=${notFound}`);
  return { ok: true, processed, updated, notFound };
}

export function startStripeReconciliationScheduler() {
  const hour = parseInt(process.env.STRIPE_RECONCILIATION_HOUR || '3', 10);
  const intervalMs = parseInt(process.env.STRIPE_RECONCILIATION_INTERVAL_MS || String(15 * 60 * 1000), 10);
  const runOnStart = process.env.STRIPE_RECONCILIATION_RUN_ON_START === '1';

  let running = false;
  let lastRunDate = null;

  const shouldRunNow = () => {
    const now = new Date();
    const yyyyMmDd = now.toISOString().slice(0, 10);
    if (lastRunDate === yyyyMmDd) return false;
    return now.getHours() === hour;
  };

  const tick = async () => {
    if (running) return;
    if (!shouldRunNow()) return;

    running = true;
    const startedAt = Date.now();
    try {
      console.log('[Stripe Recon] running daily reconciliation...');
      await reconcileStripeOnce();
      lastRunDate = new Date().toISOString().slice(0, 10);
      const ms = Date.now() - startedAt;
      console.log(`[Stripe Recon] completed in ${ms}ms`);
    } catch (err) {
      console.error('[Stripe Recon] error:', err?.message || err);
    } finally {
      running = false;
    }
  };

  if (runOnStart) {
    tick().catch(() => {});
  }

  setInterval(tick, intervalMs);
  console.log(`[Stripe Recon] scheduler enabled interval=${intervalMs}ms hour=${hour}`);
}
