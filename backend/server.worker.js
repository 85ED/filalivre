import './env.js';
import pool from './src/config/database.js';

const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:3003';
const CHECK_INTERVAL = parseInt(process.env.WORKER_INTERVAL || '5000', 10);
const DEBUG = process.env.WORKER_DEBUG === '1';

console.log(`
╔══════════════════════════════════════════╗
║  FilaLivre Queue Worker                  ║
║  WhatsApp URL: ${WHATSAPP_SERVICE_URL}
║  Interval: ${CHECK_INTERVAL}ms
╚══════════════════════════════════════════╝
`);

function maskPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 4) return '*'.repeat(digits.length);
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

async function sendWhatsAppMessage(barbershopId, phone, message) {
  const response = await fetch(`${WHATSAPP_SERVICE_URL}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ barbershopId, phone, message }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

async function checkWhatsAppStatus(barbershopId) {
  try {
    const response = await fetch(`${WHATSAPP_SERVICE_URL}/status/${barbershopId}`);
    if (!response.ok) return false;
    const data = await response.json();
    return data.active === true;
  } catch {
    return false;
  }
}

async function checkQueueAlerts() {
  try {
    const [candidates] = await pool.query(
      `SELECT id, name, phone, status, alert_sent, position, barbershop_id
       FROM queue
       WHERE status = 'waiting'
       AND (alert_sent = false OR alert_sent IS NULL)
       AND phone IS NOT NULL
       AND TRIM(phone) != ''`
    );

    if (DEBUG) {
      console.log(`[Worker] Candidates found: ${candidates.length}`);
    }

    let sentCount = 0;
    let skippedPosition = 0;
    let skippedInactive = 0;
    let skippedBadPosition = 0;
    let errorCount = 0;

    for (const client of candidates) {
      if (!client.position || Number(client.position) <= 0) {
        skippedBadPosition++;
        if (DEBUG) {
          console.log(
            `[Worker] Skip: invalid position for ${client.name} (id=${client.id}, position=${client.position})`
          );
        }
        continue;
      }

      // Regra: enviar apenas para o cliente na posição 3
      if (Number(client.position) !== 3) {
        skippedPosition++;
        continue;
      }

      const [ahead] = await pool.query(
        `SELECT COUNT(*) as cnt FROM queue
         WHERE barbershop_id = ?
         AND status = 'waiting'
         AND position < ?`,
        [client.barbershop_id, client.position]
      );

      const peopleAhead = ahead[0].cnt;

      // Check if WhatsApp session is active via HTTP
      const sessionActive = await checkWhatsAppStatus(client.barbershop_id);
      if (!sessionActive) {
        skippedInactive++;
        if (DEBUG) {
          console.log(
            `[Worker] Skip: WhatsApp inactive for barbershop_id=${client.barbershop_id} (client=${client.name}, id=${client.id})`
          );
        }
        continue;
      }

      // Claim atômico para evitar múltiplos envios em paralelo (ex.: 2 workers/2 pods)
      // Só 1 worker conseguirá marcar alert_sent=true para este id.
      const [claim] = await pool.query(
        `UPDATE queue
         SET alert_sent = true
         WHERE id = ?
           AND status = 'waiting'
           AND (alert_sent = false OR alert_sent IS NULL)`,
        [client.id]
      );

      if (!claim?.affectedRows) {
        if (DEBUG) {
          console.log(`[Worker] Skip: already claimed/sent (id=${client.id})`);
        }
        continue;
      }

      try {
        const message = peopleAhead === 0
          ? `Olá ${client.name}! Você é o próximo. Dirija-se ao atendimento.`
          : `Olá ${client.name}! Faltam apenas ${peopleAhead} pessoa${peopleAhead > 1 ? 's' : ''} para sua vez. Prepare-se!`;

        await sendWhatsAppMessage(client.barbershop_id, client.phone, message);

        sentCount++;
        console.log(
          `[Worker] WhatsApp enviado para ${client.name} (${maskPhone(client.phone)}) - ${peopleAhead} à frente`
        );
      } catch (err) {
        errorCount++;
        console.error(`[Worker] Erro ao enviar WhatsApp para ${client.name}:`, err.message);

        // Se falhar o envio, desfaz o claim para tentar novamente no próximo ciclo
        try {
          await pool.query(
            `UPDATE queue
             SET alert_sent = false
             WHERE id = ?`,
            [client.id]
          );
        } catch (rollbackErr) {
          console.error('[Worker] Erro ao desfazer claim (alert_sent):', rollbackErr?.message || rollbackErr);
        }
      }
    }

    console.log(
      `[Worker] Summary: candidates=${candidates.length} sent=${sentCount} skippedPosition=${skippedPosition} skippedInactive=${skippedInactive} skippedBadPosition=${skippedBadPosition} errors=${errorCount}`
    );
  } catch (err) {
    console.error('[Worker] Erro ao verificar alertas:', err.message);
  }
}

async function startWorker() {
  console.log('[Worker] Worker started');

  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    const startedAt = Date.now();
    try {
      console.log('[Worker] Checking queues...');
      await checkQueueAlerts();
      const ms = Date.now() - startedAt;
      console.log(`[Worker] Cycle completed in ${ms}ms`);
    } catch (err) {
      console.error('[Worker] Worker error:', err?.message || err);
    } finally {
      running = false;
    }
  };

  // Executa imediatamente e depois entra no loop
  await tick();
  setInterval(tick, CHECK_INTERVAL);
}

process.on('unhandledRejection', (reason) => {
  console.error('[Worker] UnhandledRejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Worker] UncaughtException:', err);
});

process.on('SIGTERM', async () => {
  console.log('[Worker] SIGTERM received, shutting down...');
  try {
    await pool.end();
  } catch (err) {
    console.error('[Worker] Error closing DB pool:', err?.message || err);
  }
  process.exit(0);
});

startWorker();
