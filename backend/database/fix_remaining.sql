-- Apply remaining alterations (indexes and barbershop columns)
-- Safe: uses IF NOT EXISTS or checks before adding

-- Add remaining barbershop columns if they don't exist
SET @col_count = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'barbershops' AND COLUMN_NAME = 'trial_expires_at');
SET @sql = IF(@col_count = 0, 'ALTER TABLE barbershops ADD COLUMN trial_expires_at TIMESTAMP NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_count = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'barbershops' AND COLUMN_NAME = 'subscription_status');
SET @sql = IF(@col_count = 0, "ALTER TABLE barbershops ADD COLUMN subscription_status ENUM('trial','active','cancelled','expired') DEFAULT 'trial'", 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_count = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'barbershops' AND COLUMN_NAME = 'owner_name');
SET @sql = IF(@col_count = 0, 'ALTER TABLE barbershops ADD COLUMN owner_name VARCHAR(120) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_count = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'barbershops' AND COLUMN_NAME = 'email');
SET @sql = IF(@col_count = 0, 'ALTER TABLE barbershops ADD COLUMN email VARCHAR(120) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_count = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'barbershops' AND COLUMN_NAME = 'phone');
SET @sql = IF(@col_count = 0, 'ALTER TABLE barbershops ADD COLUMN phone VARCHAR(20) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Verify
DESCRIBE barbershops;
SELECT * FROM _migrations;
