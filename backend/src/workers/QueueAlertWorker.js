import pool from '../config/database.js';
import { sendMessage, isSessionActive, isSessionReady } from '../services/WhatsAppService.js';

export async function checkQueueAlerts() {
  try {
    // Buscar clientes com telefone, esperando, que ainda não receberam alerta de posição 3
    const [candidates] = await pool.query(
      `SELECT
          q.*,
          1 + (
            SELECT COUNT(*)
            FROM queue q2
            WHERE q2.barbershop_id = q.barbershop_id
              AND q2.status = 'waiting'
              AND (
                q2.position < q.position
                OR (q2.position = q.position AND q2.id < q.id)
              )
          ) AS current_position
       FROM queue q
       WHERE q.status = 'waiting'
         AND COALESCE(q.position3_notified, 0) = 0
         AND q.phone IS NOT NULL
         AND TRIM(q.phone) != ''`
    );

    for (const client of candidates) {
      // Alertar somente quando o cliente se torna posição 3
      if (Number(client.current_position) !== 3) continue;

      const peopleAhead = Number(client.current_position) - 1;

      const sessionName = 'barbershop_' + client.barbershop_id;

      if (!isSessionActive(sessionName) || !(await isSessionReady(sessionName))) {
        continue;
      }

      try {
        // Claim atômico antes do envio
        const [claim] = await pool.query(
          `UPDATE queue
           SET position3_notified = 1
           WHERE id IN (
             SELECT id FROM (
               SELECT q.id
               FROM queue q
               WHERE q.id = ?
                 AND q.status = 'waiting'
                 AND COALESCE(q.position3_notified, 0) = 0
                 AND 1 + (
                   SELECT COUNT(*)
                   FROM queue q2
                   WHERE q2.barbershop_id = q.barbershop_id
                     AND q2.status = 'waiting'
                     AND (
                       q2.position < q.position
                       OR (q2.position = q.position AND q2.id < q.id)
                     )
                 ) = 3
             ) AS eligible
           )`,
          [client.id]
        );

        if (!claim?.affectedRows) continue;

        const message = peopleAhead === 0
          ? `Olá ${client.name}! Você é o próximo. Dirija-se ao atendimento.`
          : `Olá ${client.name}! Faltam apenas ${peopleAhead} pessoa${peopleAhead > 1 ? 's' : ''} para sua vez. Prepare-se!`;

        await sendMessage(sessionName, client.phone, message);

        console.log(`[QueueAlert] WhatsApp enviado para ${client.name} (${client.phone}) - ${peopleAhead} à frente`);
      } catch (err) {
        console.error(`[QueueAlert] Erro ao enviar WhatsApp para ${client.name}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[QueueAlert] Erro ao verificar alertas:', err.message);
  }
}
