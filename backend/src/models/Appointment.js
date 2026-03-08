import pool from '../config/database.js';

export class Appointment {
  static async findById(id) {
    const [rows] = await pool.query('SELECT * FROM appointments WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async findByBarbershop(barbershopId, date = null) {
    let query = 'SELECT * FROM appointments WHERE barbershop_id = ?';
    const values = [barbershopId];

    if (date) {
      query += ' AND scheduled_date = ?';
      values.push(date);
    }

    query += ' ORDER BY scheduled_date, scheduled_time';

    const [rows] = await pool.query(query, values);
    return rows;
  }

  static async findByBarberAndDate(barberId, date) {
    const [rows] = await pool.query(
      `SELECT * FROM appointments 
       WHERE barber_id = ? AND scheduled_date = ?
       ORDER BY scheduled_time`,
      [barberId, date]
    );
    return rows;
  }

  static async create(data) {
    const { barbershop_id, barber_id, client_name, phone, service_id, scheduled_date, scheduled_time, notes } = data;
    const [result] = await pool.query(
      `INSERT INTO appointments (barbershop_id, barber_id, client_name, phone, service_id, scheduled_date, scheduled_time, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')`,
      [barbershop_id, barber_id, client_name, phone || null, service_id || null, scheduled_date, scheduled_time, notes || null]
    );
    return result.insertId;
  }

  static async updateStatus(id, status) {
    const [result] = await pool.query(
      'UPDATE appointments SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, id]
    );
    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.query('DELETE FROM appointments WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async update(id, data) {
    const { client_name, phone, service_id, scheduled_date, scheduled_time, notes, status } = data;
    const fields = [];
    const values = [];

    if (client_name !== undefined) {
      fields.push('client_name = ?');
      values.push(client_name);
    }
    if (phone !== undefined) {
      fields.push('phone = ?');
      values.push(phone);
    }
    if (service_id !== undefined) {
      fields.push('service_id = ?');
      values.push(service_id);
    }
    if (scheduled_date !== undefined) {
      fields.push('scheduled_date = ?');
      values.push(scheduled_date);
    }
    if (scheduled_time !== undefined) {
      fields.push('scheduled_time = ?');
      values.push(scheduled_time);
    }
    if (notes !== undefined) {
      fields.push('notes = ?');
      values.push(notes);
    }
    if (status !== undefined) {
      fields.push('status = ?');
      values.push(status);
    }

    if (fields.length === 0) return false;

    fields.push('updated_at = NOW()');
    values.push(id);

    const [result] = await pool.query(
      `UPDATE appointments SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    return result.affectedRows > 0;
  }
}

export default Appointment;
