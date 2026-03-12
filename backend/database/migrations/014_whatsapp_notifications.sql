-- Migration: 014_whatsapp_notifications
-- Purpose: Add WhatsApp notifications tracking and credits system
-- Date: 2026-03-12

-- ============================================================================
-- TABLE 1: whatsapp_usage
-- Tracks monthly notification usage per barbershop
-- ============================================================================
CREATE TABLE IF NOT EXISTS whatsapp_usage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  barbershop_id INT NOT NULL,
  mes_referencia DATE NOT NULL COMMENT 'First day of month (YYYY-MM-01)',
  notificacoes_enviadas INT DEFAULT 0 NOT NULL COMMENT 'Notifications sent this month',
  limite_mensal INT DEFAULT 500 NOT NULL COMMENT 'Monthly limit (editable by admin)',
  creditos_extra INT DEFAULT 0 NOT NULL COMMENT 'Extra credits purchased',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (barbershop_id) REFERENCES barbershops(id) ON DELETE CASCADE,
  UNIQUE KEY unique_barbershop_mes (barbershop_id, mes_referencia),
  INDEX idx_barbershop_mes (barbershop_id, mes_referencia)
);

-- ============================================================================
-- TABLE 2: whatsapp_credits_log
-- Audit trail for all credit movements (usage, purchases, adjustments)
-- ============================================================================
CREATE TABLE IF NOT EXISTS whatsapp_credits_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  barbershop_id INT NOT NULL,
  tipo_movimento ENUM('compra', 'uso', 'ajuste') NOT NULL COMMENT 'Type of movement',
  quantidade INT NOT NULL COMMENT 'Number of credits (positive/negative)',
  saldo_anterior INT DEFAULT 0 COMMENT 'Balance before movement',
  saldo_posterior INT DEFAULT 0 COMMENT 'Balance after movement',
  descricao VARCHAR(255) NULL COMMENT 'Description/reason',
  stripe_transaction_id VARCHAR(100) NULL COMMENT 'Associated Stripe transaction',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (barbershop_id) REFERENCES barbershops(id) ON DELETE CASCADE,
  INDEX idx_barbershop (barbershop_id),
  INDEX idx_created (created_at),
  INDEX idx_tipo (tipo_movimento)
);

-- ============================================================================
-- TABLE 3: Alter queue table
-- Add field to track if client was notified
-- ============================================================================
ALTER TABLE queue ADD COLUMN notificado_whatsapp TINYINT(1) DEFAULT 0 COMMENT 'Whether WhatsApp notification was already sent';

-- Create optimized index for notification filtering and position queries
-- Includes (barbershop_id, position, notificado_whatsapp) for efficient queue filtering
CREATE INDEX idx_queue_notify ON queue(barbershop_id, position, notificado_whatsapp);

-- ============================================================================
-- Optional: Alter barbershops table (for future use)
-- ============================================================================
-- ALTER TABLE barbershops ADD COLUMN whatsapp_enabled BOOLEAN DEFAULT TRUE;
-- ALTER TABLE barbershops ADD COLUMN whatsapp_phone VARCHAR(20) NULL;

-- ============================================================================
-- Seeds: Initialize whatsapp_usage for existing barbershops
-- ============================================================================
-- This creates the monthly usage record for all existing barbershops for CURRENT MONTH

INSERT INTO whatsapp_usage (barbershop_id, mes_referencia, notificacoes_enviadas, limite_mensal, creditos_extra)
SELECT id, CAST(DATE_FORMAT(CURDATE(), '%Y-%m-01') AS DATE), 0, 500, 0
FROM barbershops
WHERE id NOT IN (
  SELECT DISTINCT barbershop_id FROM whatsapp_usage 
  WHERE mes_referencia = CAST(DATE_FORMAT(CURDATE(), '%Y-%m-01') AS DATE)
)
ON DUPLICATE KEY UPDATE barbershop_id = barbershop_id;

-- ============================================================================
-- Verification queries (run after migration to verify)
-- ============================================================================
-- SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
-- WHERE TABLE_NAME IN ('whatsapp_usage', 'whatsapp_credits_log') 
-- AND TABLE_SCHEMA = 'fila';
--
-- SELECT * FROM whatsapp_usage LIMIT 5;
-- SELECT * FROM whatsapp_credits_log LIMIT 5;
--
-- SELECT COUNT(*) FROM queue WHERE notificado_whatsapp = FALSE;
