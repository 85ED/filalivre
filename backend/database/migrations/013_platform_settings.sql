-- Migration 013: Create platform_settings table for global configuration
-- Stores key-value pairs for platform-wide settings like pricing

CREATE TABLE IF NOT EXISTS platform_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value LONGTEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_setting_key (setting_key)
);

-- Insert default setting for public seat price (R$35.00 = 3500 cents)
INSERT INTO platform_settings (setting_key, setting_value) 
VALUES ('public_seat_price_cents', '3500') 
ON DUPLICATE KEY UPDATE setting_value='3500';
