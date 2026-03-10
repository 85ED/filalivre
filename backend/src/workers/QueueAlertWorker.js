import pool from '../config/database.js';
import { sendMessage, isSessionActive } from '../services/WhatsAppService.js';

export async function checkQueueAlerts() {
  try {
    // Buscar clientes com telefone, esperando, que ainda não receberam alerta
    const [candidates] = await pool.query(
      `SELECT * FROM queue
       WHERE status = 'waiting'
       AND alert_sent = false
       AND phone IS NOT NULL
       AND phone != ''`
    );

    for (const client of candidates) {
      // Contar quantas pessoas estão à frente (waiting, mesma barbearia, position menor)
      const [ahead] = await pool.query(
        `SELECT COUNT(*) as cnt FROM queue
         WHERE barbershop_id = ?
         AND status = 'waiting'
         AND position < ?`,
        [client.barbershop_id, client.position]
      );

      const peopleAhead = ahead[0].cnt;

      // Alertar quando exatamente 3 pessoas (ou menos) estão à frente
      if (peopleAhead > 3) continue;

      const sessionName = 'barbershop_' + client.barbershop_id;

      if (!isSessionActive(sessionName)) {
        continue;
      }

      try {
        const message = peopleAhead === 0
          ? `Olá ${client.name}! Você é o próximo. Dirija-se ao atendimento.`
          : `Olá ${client.name}! Faltam apenas ${peopleAhead} pessoa${peopleAhead > 1 ? 's' : ''} para sua vez. Prepare-se!`;

        await sendMessage(sessionName, client.phone, message);

        await pool.query(
          'UPDATE queue SET alert_sent = true WHERE id = ?',
          [client.id]
        );

        console.log(`[QueueAlert] WhatsApp enviado para ${client.name} (${client.phone}) - ${peopleAhead} à frente`);
      } catch (err) {
        console.error(`[QueueAlert] Erro ao enviar WhatsApp para ${client.name}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[QueueAlert] Erro ao verificar alertas:', err.message);
  }
}
