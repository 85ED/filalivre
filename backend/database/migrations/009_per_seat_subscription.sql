-- Per-seat subscription model: charge per active professional
-- Remove fixed subscription plans

-- Add seat_price_cents to barbershops (default R$35 = 3500 cents)
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS seat_price_cents INT NOT NULL DEFAULT 3500;

-- Remove plan_id FK if exists
ALTER TABLE barbershops DROP COLUMN IF EXISTS plan_id;

-- Drop subscription_plans table
DROP TABLE IF EXISTS subscription_plans;
