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

  static async create(barbershopId, name, { photo_url, role, active, user_id } = {}) {
    const [result] = await pool.query(
      'INSERT INTO barbers (barbershop_id, user_id, name, photo_url, role, active, status) VALUES (?, ?, ?, ?, ?, ?, "available")',
      [barbershopId, user_id || null, name, photo_url || null, role || null, active !== undefined ? active : true]
    );
    return result.insertId;
  }

  static async findByUserId(userId) {
    const [rows] = await pool.query('SELECT * FROM barbers WHERE user_id = ?', [userId]);
    return rows[0] || null;
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
    const { name, status, current_client_id, photo_url, role, active } = data;
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
    if (photo_url !== undefined) {
      fields.push('photo_url = ?');
      values.push(photo_url);
    }
    if (role !== undefined) {
      fields.push('role = ?');
      values.push(role);
    }
    if (active !== undefined) {
      fields.push('active = ?');
      values.push(active);
    }
    if (data.user_id !== undefined) {
      fields.push('user_id = ?');
      values.push(data.user_id);
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

  static async countActiveByBarbershop(barbershopId) {
    const [rows] = await pool.query(
      'SELECT COUNT(*) as count FROM barbers WHERE barbershop_id = ? AND active = true',
      [barbershopId]
    );
    return rows[0].count;
  }
}

export default Barber;
