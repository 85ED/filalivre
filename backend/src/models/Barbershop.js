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
    const { name, slug } = data;
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
}

export default Barbershop;
