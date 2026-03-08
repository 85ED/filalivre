-- Migration: add WhatsApp alert support
-- Adds alert_sent column to queue and creates whatsapp_sessions table

ALTER TABLE queue ADD COLUMN alert_sent BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  barbershop_id INT NOT NULL,
  session_name VARCHAR(100),
  status VARCHAR(20) DEFAULT 'disconnected',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
