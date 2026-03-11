-- Migration 012: Add password reset columns to users table
ALTER TABLE users
  ADD COLUMN reset_token VARCHAR(64) NULL,
  ADD COLUMN reset_token_expires_at TIMESTAMP NULL;

CREATE INDEX idx_users_reset_token ON users(reset_token);
