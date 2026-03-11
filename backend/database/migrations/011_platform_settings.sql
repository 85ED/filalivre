-- Migration 011: Platform-wide settings (e.g., pricing, features)
-- Used to store global configuration like the public site price

CREATE TABLE IF NOT EXISTS platform_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default public seat price (R$35 = 3500 cents)
INSERT INTO platform_settings (setting_key, setting_value) 
VALUES ('public_seat_price_cents', '3500')
ON DUPLICATE KEY UPDATE setting_value = '3500';
