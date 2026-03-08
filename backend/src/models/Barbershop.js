import pool from '../config/database.js';

export class Barbershop {
  static async findById(id) {
    const [rows] = await pool.query('SELECT * FROM barbershops WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async findBySlug(slug) {
    const [rows] = await pool.query('SELECT * FROM barbershops WHERE slug = ?', [slug]);
    return rows[0] || null;
  }

  static async create(data) {
    const { name, slug } = data;
    const [result] = await pool.query(
      'INSERT INTO barbershops (name, slug) VALUES (?, ?)',
      [name, slug]
    );
    return result.insertId;
  }

  static async findAll(limit = 50, offset = 0) {
    const [rows] = await pool.query(
      'SELECT * FROM barbershops LIMIT ? OFFSET ?',
      [limit, offset]
    );
    return rows;
  }

  static async update(id, data) {
    const { name, slug, owner_name, email, phone, subscription_status, trial_expires_at } = data;
    const fields = [];
    const values = [];

    if (name !== undefined) {
      fields.push('name = ?');
      values.push(name);
    }
    if (slug !== undefined) {
      fields.push('slug = ?');
      values.push(slug);
    }
    if (owner_name !== undefined) {
      fields.push('owner_name = ?');
      values.push(owner_name);
    }
    if (email !== undefined) {
      fields.push('email = ?');
      values.push(email);
    }
    if (phone !== undefined) {
      fields.push('phone = ?');
      values.push(phone);
    }
    if (subscription_status !== undefined) {
      fields.push('subscription_status = ?');
      values.push(subscription_status);
    }
    if (trial_expires_at !== undefined) {
      fields.push('trial_expires_at = ?');
      values.push(trial_expires_at);
    }

    if (fields.length === 0) return false;

    values.push(id);
    const [result] = await pool.query(
      `UPDATE barbershops SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.query('DELETE FROM barbershops WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async count() {
    const [rows] = await pool.query('SELECT COUNT(*) as count FROM barbershops');
    return rows[0].count;
  }

  static async getPlatformStats() {
    const [totals] = await pool.query(`
      SELECT 
        COUNT(*) as total_establishments,
        SUM(CASE WHEN subscription_status = 'active' THEN 1 ELSE 0 END) as active_subscriptions,
        SUM(CASE WHEN subscription_status = 'trial' AND trial_expires_at > NOW() THEN 1 ELSE 0 END) as active_trials,
        SUM(CASE WHEN subscription_status = 'trial' AND trial_expires_at <= NOW() THEN 1 ELSE 0 END) as expired_trials
      FROM barbershops
    `);
    const [dailyServices] = await pool.query(`
      SELECT COUNT(*) as count FROM queue 
      WHERE status = 'finished' AND DATE(created_at) = CURDATE()
    `);
    return {
      totalEstablishments: totals[0].total_establishments,
      activeSubscriptions: totals[0].active_subscriptions,
      activeTrials: totals[0].active_trials,
      expiredTrials: totals[0].expired_trials,
      dailyServicesToday: dailyServices[0].count,
    };
  }
}

export default Barbershop;
