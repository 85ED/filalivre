import './env.js';
import pool from './src/config/database.js';

const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:3003';
const CHECK_INTERVAL = parseInt(process.env.WORKER_INTERVAL || '5000', 10);

console.log(`
╔══════════════════════════════════════════╗
║  FilaLivre Queue Worker                  ║
║  WhatsApp URL: ${WHATSAPP_SERVICE_URL}
║  Interval: ${CHECK_INTERVAL}ms
╚══════════════════════════════════════════╝
`);

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
      `SELECT * FROM queue
       WHERE status = 'waiting'
       AND alert_sent = false
       AND phone IS NOT NULL
       AND phone != ''`
    );

    for (const client of candidates) {
      const [ahead] = await pool.query(
        `SELECT COUNT(*) as cnt FROM queue
         WHERE barbershop_id = ?
         AND status = 'waiting'
         AND position < ?`,
        [client.barbershop_id, client.position]
      );

      const peopleAhead = ahead[0].cnt;
      if (peopleAhead > 3) continue;

      // Check if WhatsApp session is active via HTTP
      const sessionActive = await checkWhatsAppStatus(client.barbershop_id);
      if (!sessionActive) continue;

      try {
        const message = peopleAhead === 0
          ? `Olá ${client.name}! Você é o próximo. Dirija-se ao atendimento.`
          : `Olá ${client.name}! Faltam apenas ${peopleAhead} pessoa${peopleAhead > 1 ? 's' : ''} para sua vez. Prepare-se!`;

        await sendWhatsAppMessage(client.barbershop_id, client.phone, message);

        await pool.query(
          'UPDATE queue SET alert_sent = true WHERE id = ?',
          [client.id]
        );

        console.log(`[Worker] WhatsApp enviado para ${client.name} (${client.phone}) - ${peopleAhead} à frente`);
      } catch (err) {
        console.error(`[Worker] Erro ao enviar WhatsApp para ${client.name}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[Worker] Erro ao verificar alertas:', err.message);
  }
}

async function startWorker() {
  while (true) {
    try {
      await checkQueueAlerts();
    } catch (err) {
      console.error('[Worker] Error:', err.message);
    }
    await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL));
  }
}

startWorker();
