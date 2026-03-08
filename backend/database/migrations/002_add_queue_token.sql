-- Migration: Add queue_token and expand status
-- Date: 2026-03-06

ALTER TABLE queue
ADD COLUMN queue_token VARCHAR(50) UNIQUE AFTER id,
ADD COLUMN token_expires_at TIMESTAMP DEFAULT NULL AFTER queue_token,
MODIFY COLUMN status ENUM('waiting', 'called', 'serving', 'finished', 'cancelled', 'no_show') DEFAULT 'waiting',
ADD COLUMN created_by_ip VARCHAR(50) DEFAULT NULL AFTER created_at;

-- Index for fast token lookup and cleanup
ALTER TABLE queue
ADD INDEX idx_queue_token (queue_token),
ADD INDEX idx_token_expires (token_expires_at),
ADD INDEX idx_barbershop_status (barbershop_id, status);

-- Add comment explaining token format
ALTER TABLE queue MODIFY COLUMN queue_token VARCHAR(50) COMMENT 'Unique token for client session: format "queueId_timestamp_random"';
