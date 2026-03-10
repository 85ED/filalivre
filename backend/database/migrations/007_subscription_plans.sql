-- Migration: Create subscription_plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  price_cents INT NOT NULL,
  `interval` ENUM('monthly', 'yearly') NOT NULL DEFAULT 'monthly',
  features JSON NULL,
  stripe_price_id VARCHAR(100) NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Stripe columns on barbershops
ALTER TABLE barbershops ADD COLUMN stripe_customer_id VARCHAR(100) NULL;
ALTER TABLE barbershops ADD COLUMN stripe_subscription_id VARCHAR(100) NULL;
ALTER TABLE barbershops ADD COLUMN plan_id INT NULL;
