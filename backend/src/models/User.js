import pool from '../config/database.js';

export class User {
  static async findById(id) {
    const [rows] = await pool.query('SELECT id, name, email, role, barbershop_id, created_at FROM users WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async findByEmail(email) {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0] || null;
  }

  static async create(data) {
    const { name, email, password_hash, role, barbershop_id } = data;
    const [result] = await pool.query(
      'INSERT INTO users (barbershop_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [barbershop_id, name, email, password_hash, role]
    );
    return result.insertId;
  }

  static async update(id, data) {
    const { name, email, role, barbershop_id } = data;
    const fields = [];
    const values = [];

    if (name !== undefined) {
      fields.push('name = ?');
      values.push(name);
    }
    if (email !== undefined) {
      fields.push('email = ?');
      values.push(email);
    }
    if (role !== undefined) {
      fields.push('role = ?');
      values.push(role);
    }
    if (barbershop_id !== undefined) {
      fields.push('barbershop_id = ?');
      values.push(barbershop_id);
    }

    if (fields.length === 0) return false;

    values.push(id);
    const [result] = await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async findByBarbershop(barbershopId, role = null) {
    let query = 'SELECT id, name, email, role, barbershop_id FROM users WHERE barbershop_id = ?';
    const values = [barbershopId];

    if (role) {
      query += ' AND role = ?';
      values.push(role);
    }

    const [rows] = await pool.query(query, values);
    return rows;
  }

  static async findAll(limit = 50, offset = 0) {
    const [rows] = await pool.query(
      'SELECT id, name, email, role, barbershop_id FROM users LIMIT ? OFFSET ?',
      [limit, offset]
    );
    return rows;
  }
}

export default User;
