import pool from '../config/database.js';

export class Barber {
  static async findById(id) {
    const [rows] = await pool.query('SELECT * FROM barbers WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async findByBarbershop(barbershopId) {
    const [rows] = await pool.query(
      'SELECT * FROM barbers WHERE barbershop_id = ? ORDER BY name',
      [barbershopId]
    );
    return rows;
  }

  static async findAvailableByBarbershop(barbershopId) {
    const [rows] = await pool.query(
      'SELECT * FROM barbers WHERE barbershop_id = ? AND status = "available" ORDER BY name',
      [barbershopId]
    );
    return rows;
  }

  static async create(barbershopId, name) {
    const [result] = await pool.query(
      'INSERT INTO barbers (barbershop_id, name, status) VALUES (?, ?, "available")',
      [barbershopId, name]
    );
    return result.insertId;
  }

  static async updateStatus(id, status) {
    const [result] = await pool.query(
      'UPDATE barbers SET status = ? WHERE id = ?',
      [status, id]
    );
    return result.affectedRows > 0;
  }

  static async setCurrentClient(barberId, clientQueueId) {
    const [result] = await pool.query(
      'UPDATE barbers SET current_client_id = ? WHERE id = ?',
      [clientQueueId || null, barberId]
    );
    return result.affectedRows > 0;
  }

  static async update(id, data) {
    const { name, status, current_client_id } = data;
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
    if (current_client_id !== undefined) {
      fields.push('current_client_id = ?');
      values.push(current_client_id);
    }

    if (fields.length === 0) return false;

    values.push(id);
    const [result] = await pool.query(
      `UPDATE barbers SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.query('DELETE FROM barbers WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async countByBarbershop(barbershopId) {
    const [rows] = await pool.query(
      'SELECT COUNT(*) as count FROM barbers WHERE barbershop_id = ?',
      [barbershopId]
    );
    return rows[0].count;
  }
}

export default Barber;
