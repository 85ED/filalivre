import pool from '../config/database.js';
import { sendMessage, isSessionActive } from '../services/WhatsAppService.js';

export async function checkQueueAlerts() {
  try {
    const [clients] = await pool.query(
      `SELECT * FROM queue
       WHERE status = 'waiting'
       AND position <= 3
       AND alert_sent = false
       AND phone IS NOT NULL
       AND phone != ''`
    );

    for (const client of clients) {
      const sessionName = 'barbershop_' + client.barbershop_id;

      if (!isSessionActive(sessionName)) {
        continue;
      }

      try {
        const message = `Olá ${client.name}! Faltam apenas 3 atendimentos para sua vez. Dirija-se à barbearia.`;

        await sendMessage(sessionName, client.phone, message);

        await pool.query(
          'UPDATE queue SET alert_sent = true WHERE id = ?',
          [client.id]
        );

        console.log(`[QueueAlert] WhatsApp enviado para ${client.name} (${client.phone})`);
      } catch (err) {
        console.error(`[QueueAlert] Erro ao enviar WhatsApp para ${client.name}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[QueueAlert] Erro ao verificar alertas:', err.message);
  }
}
