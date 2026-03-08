-- Migration: Add platform_owner role, skip_count, service_start_time, trial support
-- Date: 2026-03-08

-- Expand user role to include platform_owner
ALTER TABLE users
MODIFY COLUMN role ENUM('platform_owner', 'owner', 'admin', 'barber') NOT NULL;

-- Allow platform_owner to have no barbershop
ALTER TABLE users
MODIFY COLUMN barbershop_id INT NULL;

-- Add skip_count to queue for skip-3-times-remove rule
ALTER TABLE queue
ADD COLUMN skip_count INT DEFAULT 0 AFTER alert_sent;

-- Add service_start_time for accurate KPI (avg service time starts here, not queue entry)
ALTER TABLE queue
ADD COLUMN service_start_time TIMESTAMP NULL AFTER status;

-- Add finished_at if not exists
ALTER TABLE queue
ADD COLUMN finished_at TIMESTAMP NULL AFTER service_start_time;

-- Add updated_at if not exists
ALTER TABLE queue
ADD COLUMN updated_at TIMESTAMP NULL AFTER finished_at;

-- Add trial support to barbershops
ALTER TABLE barbershops
ADD COLUMN trial_expires_at TIMESTAMP NULL AFTER slug;
