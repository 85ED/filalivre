import pool from '../config/database.js';

export class Service {
  static async findById(id) {
    const [rows] = await pool.query('SELECT * FROM services WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async findByBarbershop(barbershopId) {
    const [rows] = await pool.query(
      'SELECT * FROM services WHERE barbershop_id = ? ORDER BY name',
      [barbershopId]
    );
    return rows;
  }

  static async create(data) {
    const { barbershop_id, name, description, duration_minutes, price } = data;
    const [result] = await pool.query(
      `INSERT INTO services (barbershop_id, name, description, duration_minutes, price)
       VALUES (?, ?, ?, ?, ?)`,
      [barbershop_id, name, description || null, duration_minutes || 30, price]
    );
    return result.insertId;
  }

  static async update(id, data) {
    const { name, description, duration_minutes, price } = data;
    const fields = [];
    const values = [];

    if (name !== undefined) {
      fields.push('name = ?');
      values.push(name);
    }
    if (description !== undefined) {
      fields.push('description = ?');
      values.push(description);
    }
    if (duration_minutes !== undefined) {
      fields.push('duration_minutes = ?');
      values.push(duration_minutes);
    }
    if (price !== undefined) {
      fields.push('price = ?');
      values.push(price);
    }

    if (fields.length === 0) return false;

    values.push(id);
    const [result] = await pool.query(
      `UPDATE services SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.query('DELETE FROM services WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
}

export default Service;
