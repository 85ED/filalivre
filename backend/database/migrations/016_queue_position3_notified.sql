-- Migration: 016_queue_position3_notified
-- Purpose: Track WhatsApp notification when client becomes current position 3
-- Date: 2026-03-15

ALTER TABLE queue
  ADD COLUMN position3_notified TINYINT(1) DEFAULT 0 COMMENT '1 when client has already been notified after becoming position 3';

CREATE INDEX idx_queue_position3_notify
  ON queue(barbershop_id, status, position3_notified, position, id);
