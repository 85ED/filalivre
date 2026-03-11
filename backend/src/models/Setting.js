import pool from '../config/database.js';

export class Setting {
  static async upsert(key, value) {
    const [result] = await pool.query(
      `INSERT INTO platform_settings (setting_key, setting_value) 
       VALUES (?, ?) 
       ON DUPLICATE KEY UPDATE setting_value = ?`,
      [key, String(value), String(value)]
    );
    return result;
  }

  static async findByKey(key) {
    const [rows] = await pool.query(
      'SELECT * FROM platform_settings WHERE setting_key = ?',
      [key]
    );
    return rows[0] || null;
  }

  static async getAll() {
    const [rows] = await pool.query(
      'SELECT * FROM platform_settings'
    );
    return rows;
  }

  static async deleteByKey(key) {
    const [result] = await pool.query(
      'DELETE FROM platform_settings WHERE setting_key = ?',
      [key]
    );
    return result.affectedRows > 0;
  }
}

export default Setting;
