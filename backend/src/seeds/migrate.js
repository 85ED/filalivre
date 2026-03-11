import '../../env.js';
import pool from '../config/database.js';

export async function runMigrations() {
  try {
    // Ensure migrations tracking table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Define migrations to apply inline (safe, idempotent checks)
    const migrations = [
      {
        name: '004_platform_owner_and_trial',
        queries: [
          // Check and add platform_owner to role enum
          async (conn) => {
            try {
              await conn.query(`ALTER TABLE users MODIFY COLUMN role ENUM('platform_owner', 'owner', 'admin', 'barber') NOT NULL`);
            } catch (e) { /* already modified */ }
          },
          // Allow NULL barbershop_id
          async (conn) => {
            try {
              await conn.query(`ALTER TABLE users MODIFY COLUMN barbershop_id INT NULL`);
            } catch (e) { /* already modified */ }
          },
          // Add skip_count
          async (conn) => {
            try {
              const [cols] = await conn.query(`SHOW COLUMNS FROM queue LIKE 'skip_count'`);
              if (cols.length === 0) {
                await conn.query(`ALTER TABLE queue ADD COLUMN skip_count INT DEFAULT 0`);
              }
            } catch (e) { /* ignore */ }
          },
          // Add service_start_time
          async (conn) => {
            try {
              const [cols] = await conn.query(`SHOW COLUMNS FROM queue LIKE 'service_start_time'`);
              if (cols.length === 0) {
                await conn.query(`ALTER TABLE queue ADD COLUMN service_start_time TIMESTAMP NULL`);
              }
            } catch (e) { /* ignore */ }
          },
          // Add finished_at
          async (conn) => {
            try {
              const [cols] = await conn.query(`SHOW COLUMNS FROM queue LIKE 'finished_at'`);
              if (cols.length === 0) {
                await conn.query(`ALTER TABLE queue ADD COLUMN finished_at TIMESTAMP NULL`);
              }
            } catch (e) { /* ignore */ }
          },
          // Add updated_at
          async (conn) => {
            try {
              const [cols] = await conn.query(`SHOW COLUMNS FROM queue LIKE 'updated_at'`);
              if (cols.length === 0) {
                await conn.query(`ALTER TABLE queue ADD COLUMN updated_at TIMESTAMP NULL`);
              }
            } catch (e) { /* ignore */ }
          },
          // Add trial_expires_at to barbershops
          async (conn) => {
            try {
              const [cols] = await conn.query(`SHOW COLUMNS FROM barbershops LIKE 'trial_expires_at'`);
              if (cols.length === 0) {
                await conn.query(`ALTER TABLE barbershops ADD COLUMN trial_expires_at TIMESTAMP NULL`);
              }
            } catch (e) { /* ignore */ }
          },
          // Add current_client_id to barbers if missing
          async (conn) => {
            try {
              const [cols] = await conn.query(`SHOW COLUMNS FROM barbers LIKE 'current_client_id'`);
              if (cols.length === 0) {
                await conn.query(`ALTER TABLE barbers ADD COLUMN current_client_id INT NULL`);
              }
            } catch (e) { /* ignore */ }
          },
        ],
      },
    ];

    // Migration 005: subscription fields on barbershops
    migrations.push({
      name: '005_subscription_fields',
      queries: [
        async (conn) => {
          try {
            const [cols] = await conn.query(`SHOW COLUMNS FROM barbershops LIKE 'subscription_status'`);
            if (cols.length === 0) {
              await conn.query(`ALTER TABLE barbershops ADD COLUMN subscription_status ENUM('trial','active','cancelled','expired') DEFAULT 'trial'`);
            }
          } catch (e) { /* ignore */ }
        },
        async (conn) => {
          try {
            const [cols] = await conn.query(`SHOW COLUMNS FROM barbershops LIKE 'owner_name'`);
            if (cols.length === 0) {
              await conn.query(`ALTER TABLE barbershops ADD COLUMN owner_name VARCHAR(120) NULL`);
            }
          } catch (e) { /* ignore */ }
        },
        async (conn) => {
          try {
            const [cols] = await conn.query(`SHOW COLUMNS FROM barbershops LIKE 'email'`);
            if (cols.length === 0) {
              await conn.query(`ALTER TABLE barbershops ADD COLUMN email VARCHAR(120) NULL`);
            }
          } catch (e) { /* ignore */ }
        },
        async (conn) => {
          try {
            const [cols] = await conn.query(`SHOW COLUMNS FROM barbershops LIKE 'phone'`);
            if (cols.length === 0) {
              await conn.query(`ALTER TABLE barbershops ADD COLUMN phone VARCHAR(20) NULL`);
            }
          } catch (e) { /* ignore */ }
        },
        // Backfill existing rows that have trial_expires_at but no subscription_status
        async (conn) => {
          try {
            await conn.query(`UPDATE barbershops SET subscription_status = 'trial' WHERE trial_expires_at IS NOT NULL AND subscription_status IS NULL`);
          } catch (e) { /* ignore */ }
        },
      ],
    });

    // Migration 006: barber photo_url, role, active
    migrations.push({
      name: '006_barber_photo_role_active',
      queries: [
        async (conn) => {
          try {
            const [cols] = await conn.query(`SHOW COLUMNS FROM barbers LIKE 'photo_url'`);
            if (cols.length === 0) {
              await conn.query(`ALTER TABLE barbers ADD COLUMN photo_url VARCHAR(500) NULL AFTER name`);
            }
          } catch (e) { /* ignore */ }
        },
        async (conn) => {
          try {
            const [cols] = await conn.query(`SHOW COLUMNS FROM barbers LIKE 'role'`);
            if (cols.length === 0) {
              await conn.query(`ALTER TABLE barbers ADD COLUMN role VARCHAR(60) NULL AFTER photo_url`);
            }
          } catch (e) { /* ignore */ }
        },
        async (conn) => {
          try {
            const [cols] = await conn.query(`SHOW COLUMNS FROM barbers LIKE 'active'`);
            if (cols.length === 0) {
              await conn.query(`ALTER TABLE barbers ADD COLUMN active BOOLEAN DEFAULT TRUE AFTER role`);
            }
          } catch (e) { /* ignore */ }
        },
      ],
    });

    // Migration 007: user_id on barbers
    migrations.push({
      name: '007_add_user_id_to_barbers',
      queries: [
        async (conn) => {
          try {
            const [cols] = await conn.query(`SHOW COLUMNS FROM barbers LIKE 'user_id'`);
            if (cols.length === 0) {
              await conn.query(`ALTER TABLE barbers ADD COLUMN user_id INT NULL`);
              await conn.query(`ALTER TABLE barbers ADD INDEX idx_barbers_user_id (user_id)`);
            }
          } catch (e) { /* ignore */ }
        },
      ],
    });

    // Migration 008: subscription_plans table + stripe columns on barbershops
    migrations.push({
      name: '008_subscription_plans',
      queries: [
        async (conn) => {
          try {
            await conn.query(`
              CREATE TABLE IF NOT EXISTS subscription_plans (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(120) NOT NULL,
                price_cents INT NOT NULL,
                \`interval\` ENUM('monthly', 'yearly') NOT NULL DEFAULT 'monthly',
                features JSON NULL,
                stripe_price_id VARCHAR(100) NULL,
                active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
              )
            `);
          } catch (e) { /* ignore */ }
        },
        async (conn) => {
          try {
            const [cols] = await conn.query(`SHOW COLUMNS FROM barbershops LIKE 'stripe_customer_id'`);
            if (cols.length === 0) {
              await conn.query(`ALTER TABLE barbershops ADD COLUMN stripe_customer_id VARCHAR(100) NULL`);
            }
          } catch (e) { /* ignore */ }
        },
        async (conn) => {
          try {
            const [cols] = await conn.query(`SHOW COLUMNS FROM barbershops LIKE 'stripe_subscription_id'`);
            if (cols.length === 0) {
              await conn.query(`ALTER TABLE barbershops ADD COLUMN stripe_subscription_id VARCHAR(100) NULL`);
            }
          } catch (e) { /* ignore */ }
        },
        async (conn) => {
          try {
            const [cols] = await conn.query(`SHOW COLUMNS FROM barbershops LIKE 'plan_id'`);
            if (cols.length === 0) {
              await conn.query(`ALTER TABLE barbershops ADD COLUMN plan_id INT NULL`);
            }
          } catch (e) { /* ignore */ }
        },
      ],
    });

    // Migration 009: per-seat subscription model (remove plans, add seat_price_cents)
    migrations.push({
      name: '009_per_seat_subscription',
      queries: [
        async (conn) => {
          try {
            const [cols] = await conn.query(`SHOW COLUMNS FROM barbershops LIKE 'seat_price_cents'`);
            if (cols.length === 0) {
              await conn.query(`ALTER TABLE barbershops ADD COLUMN seat_price_cents INT NOT NULL DEFAULT 3500`);
            }
          } catch (e) { /* ignore */ }
        },
        async (conn) => {
          try {
            const [cols] = await conn.query(`SHOW COLUMNS FROM barbershops LIKE 'plan_id'`);
            if (cols.length > 0) {
              await conn.query(`ALTER TABLE barbershops DROP COLUMN plan_id`);
            }
          } catch (e) { /* ignore */ }
        },
        async (conn) => {
          try {
            await conn.query(`DROP TABLE IF EXISTS subscription_plans`);
          } catch (e) { /* ignore */ }
        },
      ],
    });

    // Migration 010: image_url for barbershops
    migrations.push({
      name: '010_barbershop_image_url',
      queries: [
        async (conn) => {
          try {
            const [cols] = await conn.query(`SHOW COLUMNS FROM barbershops LIKE 'image_url'`);
            if (cols.length === 0) {
              await conn.query(`ALTER TABLE barbershops ADD COLUMN image_url VARCHAR(500) NULL`);
            }
          } catch (e) { /* ignore */ }
        },
      ],
    });

    // Migration 011: platform_settings table
    migrations.push({
      name: '011_platform_settings',
      queries: [
        async (conn) => {
          await conn.query(`
            CREATE TABLE IF NOT EXISTS platform_settings (
              setting_key VARCHAR(100) PRIMARY KEY,
              setting_value TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
          `);
        },
        async (conn) => {
          await conn.query(`
            INSERT INTO platform_settings (setting_key, setting_value)
            VALUES ('public_seat_price_cents', '3500')
            ON DUPLICATE KEY UPDATE setting_value = setting_value
          `);
        },
      ],
    });

    // Migration 012: password reset columns on users
    migrations.push({
      name: '012_password_reset',
      queries: [
        async (conn) => {
          try {
            const [cols] = await conn.query(`SHOW COLUMNS FROM users LIKE 'reset_token'`);
            if (cols.length === 0) {
              await conn.query(`ALTER TABLE users ADD COLUMN reset_token VARCHAR(64) NULL`);
            }
          } catch (e) { /* ignore */ }
        },
        async (conn) => {
          try {
            const [cols] = await conn.query(`SHOW COLUMNS FROM users LIKE 'reset_token_expires_at'`);
            if (cols.length === 0) {
              await conn.query(`ALTER TABLE users ADD COLUMN reset_token_expires_at TIMESTAMP NULL`);
            }
          } catch (e) { /* ignore */ }
        },
        async (conn) => {
          try {
            await conn.query(`CREATE INDEX idx_users_reset_token ON users(reset_token)`);
          } catch (e) { /* ignore - index may already exist */ }
        },
      ],
    });

    // Migration 013: increase image_url column size for longer URLs
    migrations.push({
      name: '013_increase_image_url_size',
      queries: [
        async (conn) => {
          try {
            await conn.query(`ALTER TABLE barbershops MODIFY COLUMN image_url VARCHAR(2000) NULL`);
          } catch (e) { /* ignore */ }
        },
      ],
    });

    for (const migration of migrations) {
      const [applied] = await pool.query('SELECT * FROM _migrations WHERE name = ?', [migration.name]);
      if (applied.length > 0) continue;

      console.log(`[Migration] Applying: ${migration.name}`);
      for (const queryFn of migration.queries) {
        await queryFn(pool);
      }
      await pool.query('INSERT INTO _migrations (name) VALUES (?)', [migration.name]);
      console.log(`[Migration] Applied: ${migration.name}`);
    }
  } catch (error) {
    console.error('[Migration] Error:', error.message);
  }
}
