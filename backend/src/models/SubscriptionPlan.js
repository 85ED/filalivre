import pool from '../config/database.js';

export class SubscriptionPlan {
  static async findAll() {
    const [rows] = await pool.query('SELECT * FROM subscription_plans ORDER BY price_cents ASC');
    return rows;
  }

  static async findActive() {
    const [rows] = await pool.query('SELECT * FROM subscription_plans WHERE active = TRUE ORDER BY price_cents ASC');
    return rows;
  }

  static async findById(id) {
    const [rows] = await pool.query('SELECT * FROM subscription_plans WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async create(data) {
    const { name, price_cents, interval, features, stripe_price_id } = data;
    const [result] = await pool.query(
      'INSERT INTO subscription_plans (name, price_cents, `interval`, features, stripe_price_id) VALUES (?, ?, ?, ?, ?)',
      [name, price_cents, interval || 'monthly', features ? JSON.stringify(features) : null, stripe_price_id || null]
    );
    return result.insertId;
  }

  static async update(id, data) {
    const fields = [];
    const values = [];

    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.price_cents !== undefined) { fields.push('price_cents = ?'); values.push(data.price_cents); }
    if (data.interval !== undefined) { fields.push('`interval` = ?'); values.push(data.interval); }
    if (data.features !== undefined) { fields.push('features = ?'); values.push(JSON.stringify(data.features)); }
    if (data.stripe_price_id !== undefined) { fields.push('stripe_price_id = ?'); values.push(data.stripe_price_id); }
    if (data.active !== undefined) { fields.push('active = ?'); values.push(data.active); }

    if (fields.length === 0) return;

    values.push(id);
    await pool.query(`UPDATE subscription_plans SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  static async delete(id) {
    await pool.query('DELETE FROM subscription_plans WHERE id = ?', [id]);
  }
}

export default SubscriptionPlan;
