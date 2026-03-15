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

    // Migration 014: WhatsApp notifications tracking and credits system
    migrations.push({
      name: '014_whatsapp_notifications',
      queries: [
        // Create whatsapp_usage table
        async (conn) => {
          try {
            await conn.query(`
              CREATE TABLE IF NOT EXISTS whatsapp_usage (
                id INT AUTO_INCREMENT PRIMARY KEY,
                barbershop_id INT NOT NULL,
                mes_referencia DATE NOT NULL,
                notificacoes_enviadas INT DEFAULT 0 NOT NULL,
                limite_mensal INT DEFAULT 500 NOT NULL,
                creditos_extra INT DEFAULT 0 NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (barbershop_id) REFERENCES barbershops(id) ON DELETE CASCADE,
                UNIQUE KEY unique_barbershop_mes (barbershop_id, mes_referencia),
                INDEX idx_barbershop_mes (barbershop_id, mes_referencia)
              )
            `);
          } catch (e) { /* ignore if already exists */ }
        },
        
        // Create whatsapp_credits_log table
        async (conn) => {
          try {
            await conn.query(`
              CREATE TABLE IF NOT EXISTS whatsapp_credits_log (
                id INT AUTO_INCREMENT PRIMARY KEY,
                barbershop_id INT NOT NULL,
                tipo_movimento ENUM('compra', 'uso', 'ajuste') NOT NULL,
                quantidade INT NOT NULL,
                saldo_anterior INT DEFAULT 0,
                saldo_posterior INT DEFAULT 0,
                descricao VARCHAR(255) NULL,
                stripe_transaction_id VARCHAR(100) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (barbershop_id) REFERENCES barbershops(id) ON DELETE CASCADE,
                INDEX idx_barbershop (barbershop_id),
                INDEX idx_created (created_at),
                INDEX idx_tipo (tipo_movimento)
              )
            `);
          } catch (e) { /* ignore if already exists */ }
        },
        
        // Add notificado_whatsapp column to queue table
        async (conn) => {
          try {
            const [cols] = await conn.query(`SHOW COLUMNS FROM queue LIKE 'notificado_whatsapp'`);
            if (cols.length === 0) {
              await conn.query(`ALTER TABLE queue ADD COLUMN notificado_whatsapp TINYINT(1) DEFAULT 0`);
            }
          } catch (e) { /* ignore */ }
        },
        
        // Create optimized index for notification queries
        async (conn) => {
          try {
            await conn.query(`CREATE INDEX idx_queue_notify ON queue(barbershop_id, position, notificado_whatsapp)`);
          } catch (e) { /* ignore if index already exists */ }
        },
        
        // Initialize monthly usage records for all existing barbershops
        async (conn) => {
          try {
            const currentMonth = new Date();
            currentMonth.setDate(1);
            const mesReferencia = currentMonth.toISOString().split('T')[0];
            
            await conn.query(`
              INSERT INTO whatsapp_usage (barbershop_id, mes_referencia, notificacoes_enviadas, limite_mensal, creditos_extra)
              SELECT id, ?, 0, 500, 0
              FROM barbershops
              WHERE id NOT IN (
                SELECT DISTINCT barbershop_id FROM whatsapp_usage 
                WHERE mes_referencia = ?
              )
              ON DUPLICATE KEY UPDATE barbershop_id = barbershop_id
            `, [mesReferencia, mesReferencia]);
          } catch (e) { /* ignore */ }
        },
      ],
    });

    // Migration 015: Stripe billing status fields (status_assinatura/ativo/invoice/tentativas)
    migrations.push({
      name: '015_stripe_billing_fields',
      queries: [
        async (conn) => {
          try {
            const [cols] = await conn.query(`SHOW COLUMNS FROM barbershops LIKE 'status_assinatura'`);
            if (cols.length === 0) {
              await conn.query(`ALTER TABLE barbershops ADD COLUMN status_assinatura VARCHAR(40) NULL`);
            }
          } catch (e) { /* ignore */ }
        },
        async (conn) => {
          try {
            const [cols] = await conn.query(`SHOW COLUMNS FROM barbershops LIKE 'ativo'`);
            if (cols.length === 0) {
              await conn.query(`ALTER TABLE barbershops ADD COLUMN ativo TINYINT(1) NOT NULL DEFAULT 1`);
            }
          } catch (e) { /* ignore */ }
        },
        async (conn) => {
          try {
            const [cols] = await conn.query(`SHOW COLUMNS FROM barbershops LIKE 'data_ultimo_pagamento'`);
            if (cols.length === 0) {
              await conn.query(`ALTER TABLE barbershops ADD COLUMN data_ultimo_pagamento TIMESTAMP NULL`);
            }
          } catch (e) { /* ignore */ }
        },
        async (conn) => {
          try {
            const [cols] = await conn.query(`SHOW COLUMNS FROM barbershops LIKE 'stripe_invoice_id'`);
            if (cols.length === 0) {
              await conn.query(`ALTER TABLE barbershops ADD COLUMN stripe_invoice_id VARCHAR(100) NULL`);
            }
          } catch (e) { /* ignore */ }
        },
        async (conn) => {
          try {
            const [cols] = await conn.query(`SHOW COLUMNS FROM barbershops LIKE 'tentativas_pagamento'`);
            if (cols.length === 0) {
              await conn.query(`ALTER TABLE barbershops ADD COLUMN tentativas_pagamento INT NOT NULL DEFAULT 0`);
            }
          } catch (e) { /* ignore */ }
        },
        async (conn) => {
          try {
            const [cols] = await conn.query(`SHOW COLUMNS FROM barbershops LIKE 'proxima_tentativa_pagamento'`);
            if (cols.length === 0) {
              await conn.query(`ALTER TABLE barbershops ADD COLUMN proxima_tentativa_pagamento TIMESTAMP NULL`);
            }
          } catch (e) { /* ignore */ }
        },
        // Backfill: if subscription_status exists, initialize status_assinatura when empty
        async (conn) => {
          try {
            await conn.query(`
              UPDATE barbershops
              SET status_assinatura = CASE
                WHEN subscription_status = 'active' THEN 'ativa'
                WHEN subscription_status = 'cancelled' THEN 'cancelada'
                WHEN subscription_status = 'expired' THEN 'pendente_bloqueado'
                ELSE status_assinatura
              END
              WHERE (status_assinatura IS NULL OR status_assinatura = '')
                AND subscription_status IS NOT NULL
            `);
          } catch (e) { /* ignore */ }
        },
      ],
    });

    // Migration 016: queue position 3 notification flag
    migrations.push({
      name: '016_queue_position3_notified',
      queries: [
        async (conn) => {
          try {
            const [cols] = await conn.query(`SHOW COLUMNS FROM queue LIKE 'position3_notified'`);
            if (cols.length === 0) {
              await conn.query(`ALTER TABLE queue ADD COLUMN position3_notified TINYINT(1) DEFAULT 0`);
            }
          } catch (e) { /* ignore */ }
        },
        async (conn) => {
          try {
            await conn.query(`CREATE INDEX idx_queue_position3_notify ON queue(barbershop_id, status, position3_notified, position, id)`);
          } catch (e) { /* ignore if index already exists */ }
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
