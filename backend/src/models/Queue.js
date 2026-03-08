import pool from '../config/database.js';
import crypto from 'crypto';

export class Queue {
  // Gera token único para cliente
  static generateToken() {
    return crypto.randomBytes(24).toString('hex');
  }

  static async findById(id) {
    const [rows] = await pool.query('SELECT * FROM queue WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async findByToken(token) {
    const [rows] = await pool.query(
      `SELECT * FROM queue 
       WHERE queue_token = ? 
       AND token_expires_at > NOW()`,
      [token]
    );
    return rows[0] || null;
  }

  static async findByBarbershop(barbershopId) {
    const [rows] = await pool.query(
      `SELECT * FROM queue 
       WHERE barbershop_id = ? AND status IN ('waiting', 'called', 'serving')
       ORDER BY position ASC`,
      [barbershopId]
    );
    return rows;
  }

  static async findWaitingInBarbershop(barbershopId) {
    const [rows] = await pool.query(
      `SELECT * FROM queue 
       WHERE barbershop_id = ? AND status = 'waiting'
       ORDER BY position ASC`,
      [barbershopId]
    );
    return rows;
  }

  static async findActiveByName(barbershopId, name) {
    const [rows] = await pool.query(
      `SELECT * FROM queue 
       WHERE barbershop_id = ? 
       AND name = ? 
       AND status IN ('waiting', 'called', 'serving')
       LIMIT 1`,
      [barbershopId, name.trim()]
    );
    return rows[0] || null;
  }

  // Criar entrada na fila com token
  static async create(data) {
    const { barbershop_id, name, phone, client_ip, barber_id } = data;

    // Validação básica
    if (!name || typeof name !== 'string') {
      throw new Error('Nome inválido');
    }

    const trimmedName = name.trim();
    if (trimmedName.length === 0 || trimmedName.length > 100) {
      throw new Error('Nome deve ter entre 1 e 100 caracteres');
    }

    // Verifica se cliente já está na fila (por nome)
    const existing = await this.findActiveByName(barbershop_id, trimmedName);
    if (existing) {
      const error = new Error('Você já está na fila');
      error.code = 'DUPLICATE_ENTRY';
      error.queueId = existing.id;
      error.queueToken = existing.queue_token;
      throw error;
    }

    // Get next position
    const [maxPosition] = await pool.query(
      `SELECT COALESCE(MAX(position), 0) as max_pos FROM queue 
       WHERE barbershop_id = ? AND status IN ('waiting', 'called', 'serving')`,
      [barbershop_id]
    );

    const nextPosition = (maxPosition[0].max_pos || 0) + 1;
    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 horas

    const [result] = await pool.query(
      `INSERT INTO queue (barbershop_id, name, phone, barber_id, status, position, queue_token, token_expires_at, created_by_ip)
       VALUES (?, ?, ?, ?, 'waiting', ?, ?, ?, ?)`,
      [barbershop_id, trimmedName, phone || null, barber_id || null, nextPosition, token, expiresAt, client_ip || null]
    );

    return {
      id: result.insertId,
      token,
      position: nextPosition,
      status: 'waiting',
    };
  }

  static async updateStatus(id, status) {
    const validStatuses = ['waiting', 'called', 'serving', 'finished', 'cancelled', 'no_show'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Status inválido: ${status}`);
    }

    const [result] = await pool.query(
      'UPDATE queue SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, id]
    );
    return result.affectedRows > 0;
  }

  // Chamar próximo com LOCK para evitar race condition
  // Regra: 1º fila do barbeiro, 2º fila geral
  static async callNext(barbershopId, barberId) {
    const connection = await pool.getConnection();
    try {
      // Inicia transação
      await connection.beginTransaction();

      // 1. Primeiro busca cliente que escolheu este barbeiro
      let [clients] = await connection.query(
        `SELECT id FROM queue 
         WHERE barbershop_id = ? AND barber_id = ? AND status = 'waiting'
         ORDER BY position ASC LIMIT 1
         FOR UPDATE`,
        [barbershopId, barberId]
      );

      // 2. Se não encontrou, busca da fila geral (sem barbeiro específico)
      if (!clients.length) {
        [clients] = await connection.query(
          `SELECT id FROM queue 
           WHERE barbershop_id = ? AND barber_id IS NULL AND status = 'waiting'
           ORDER BY position ASC LIMIT 1
           FOR UPDATE`,
          [barbershopId]
        );
      }

      if (!clients.length) {
        await connection.commit();
        return null;
      }

      const clientId = clients[0].id;

      // Atualiza status para serving e atribui ao barbeiro
      await connection.query(
        `UPDATE queue 
         SET status = 'serving', barber_id = ?, updated_at = NOW()
         WHERE id = ?`,
        [barberId, clientId]
      );

      await connection.commit();
      return clientId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async assignBarberToClient(clientQueueId, barberId) {
    const [result] = await pool.query(
      `UPDATE queue 
       SET status = 'serving', barber_id = ?, updated_at = NOW()
       WHERE id = ?`,
      [barberId, clientQueueId]
    );
    return result.affectedRows > 0;
  }

  static async remove(id) {
    const [result] = await pool.query(
      `UPDATE queue SET status = 'removed', updated_at = NOW() WHERE id = ?`,
      [id]
    );
    return result.affectedRows > 0;
  }

  static async update(id, data) {
    const { name, status, barber_id } = data;
    const fields = [];
    const values = [];

    if (name !== undefined) {
      fields.push('name = ?');
      values.push(name);
    }
    if (status !== undefined) {
      fields.push('status = ?');
      values.push(status);
    }
    if (barber_id !== undefined) {
      fields.push('barber_id = ?');
      values.push(barber_id);
    }

    if (fields.length === 0) return false;

    fields.push('updated_at = NOW()');
    values.push(id);

    const [result] = await pool.query(
      `UPDATE queue SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    return result.affectedRows > 0;
  }

  static async countWaitingByBarbershop(barbershopId) {
    const [rows] = await pool.query(
      `SELECT COUNT(*) as count FROM queue 
       WHERE barbershop_id = ? AND status = 'waiting'`,
      [barbershopId]
    );
    return rows[0].count;
  }

  static async getQueueStats(barbershopId) {
    const [stats] = await pool.query(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) as waiting,
         SUM(CASE WHEN status = 'serving' THEN 1 ELSE 0 END) as serving,
         SUM(CASE WHEN status = 'called' THEN 1 ELSE 0 END) as called
       FROM queue 
       WHERE barbershop_id = ? AND status IN ('waiting', 'called', 'serving')`,
      [barbershopId]
    );
    return stats[0];
  }

  static async getQueueHistory(barbershopId, limit = 100) {
    const [rows] = await pool.query(
      `SELECT * FROM queue 
       WHERE barbershop_id = ? 
       ORDER BY finished_at DESC 
       LIMIT ?`,
      [barbershopId, limit]
    );
    return rows;
  }

  static async delete(id) {
    const [result] = await pool.query('DELETE FROM queue WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  // Marca como no_show clientes que não foram atendidos em 5 minutos
  static async markNoShowIfTimedOut(barbershopId) {
    const [result] = await pool.query(
      `UPDATE queue 
       SET status = 'no_show', updated_at = NOW()
       WHERE barbershop_id = ? 
       AND status = 'called'
       AND TIMESTAMPDIFF(MINUTE, updated_at, NOW()) >= 5`,
      [barbershopId]
    );
    return result.affectedRows;
  }

  // Remove tokens expirados
  static async cleanupExpiredTokens() {
    const [result] = await pool.query(
      `DELETE FROM queue 
       WHERE queue_token IS NOT NULL 
       AND token_expires_at < NOW()
       AND status = 'waiting'`
    );
    return result.affectedRows;
  }

  // ===== REPORTS =====

  static async getCountByPeriod(barbershopId, startDate, endDate) {
    const [rows] = await pool.query(
      `SELECT COUNT(*) as total FROM queue
       WHERE barbershop_id = ? AND status = 'finished'
       AND created_at >= ? AND created_at < ?`,
      [barbershopId, startDate, endDate]
    );
    return rows[0].total;
  }

  static async getAvgServiceTime(barbershopId, startDate, endDate) {
    const [rows] = await pool.query(
      `SELECT AVG(TIMESTAMPDIFF(MINUTE, updated_at, finished_at)) as avg_time FROM queue
       WHERE barbershop_id = ? AND status = 'finished'
       AND finished_at IS NOT NULL
       AND created_at >= ? AND created_at < ?`,
      [barbershopId, startDate, endDate]
    );
    return Math.round(rows[0].avg_time || 0);
  }

  static async getCountByBarber(barbershopId, startDate, endDate) {
    const [rows] = await pool.query(
      `SELECT q.barber_id, b.name as barber_name, COUNT(*) as total
       FROM queue q
       LEFT JOIN barbers b ON q.barber_id = b.id
       WHERE q.barbershop_id = ? AND q.status = 'finished'
       AND q.barber_id IS NOT NULL
       AND q.created_at >= ? AND q.created_at < ?
       GROUP BY q.barber_id, b.name
       ORDER BY total DESC`,
      [barbershopId, startDate, endDate]
    );
    return rows;
  }

  static async getBarberClients(barbershopId, barberId, startDate, endDate) {
    const [rows] = await pool.query(
      `SELECT id, name, phone, status, created_at, updated_at, finished_at
       FROM queue
       WHERE barbershop_id = ? AND barber_id = ? AND status = 'finished'
       AND created_at >= ? AND created_at < ?
       ORDER BY created_at DESC`,
      [barbershopId, barberId, startDate, endDate]
    );
    return rows;
  }

  static async getDailyCountsByMonth(barbershopId, year, month) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endMonth = month === 12 ? 1 : month + 1;
    const endYear = month === 12 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

    const [rows] = await pool.query(
      `SELECT DAY(created_at) as day, COUNT(*) as total
       FROM queue
       WHERE barbershop_id = ? AND status = 'finished'
       AND created_at >= ? AND created_at < ?
       GROUP BY DAY(created_at)
       ORDER BY day ASC`,
      [barbershopId, startDate, endDate]
    );
    return rows;
  }
}

export default Queue;
