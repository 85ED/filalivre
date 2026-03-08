-- Full schema for FilaLivre - includes all migrations
-- Run against the railway database

-- Table: barbershops
CREATE TABLE IF NOT EXISTS barbershops (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(120) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: users
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  barbershop_id INT NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(120) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('platform_owner', 'owner', 'admin', 'barber') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (barbershop_id) REFERENCES barbershops(id) ON DELETE CASCADE
);

-- Table: barbers
CREATE TABLE IF NOT EXISTS barbers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  barbershop_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  photo_url VARCHAR(500) NULL,
  role VARCHAR(60) NULL,
  active BOOLEAN DEFAULT TRUE,
  status ENUM('available', 'serving', 'paused') DEFAULT 'available',
  current_client_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (barbershop_id) REFERENCES barbershops(id) ON DELETE CASCADE
);

-- Table: queue
CREATE TABLE IF NOT EXISTS queue (
  id INT AUTO_INCREMENT PRIMARY KEY,
  queue_token VARCHAR(50) UNIQUE,
  token_expires_at TIMESTAMP NULL,
  barbershop_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NULL,
  barber_id INT NULL,
  status ENUM('waiting', 'called', 'serving', 'finished', 'cancelled', 'no_show', 'removed') DEFAULT 'waiting',
  service_start_time TIMESTAMP NULL,
  finished_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL,
  position INT NOT NULL,
  alert_sent BOOLEAN DEFAULT FALSE,
  skip_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by_ip VARCHAR(50) NULL,
  FOREIGN KEY (barbershop_id) REFERENCES barbershops(id) ON DELETE CASCADE,
  FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE SET NULL
);

-- Table: whatsapp_sessions
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  barbershop_id INT NOT NULL,
  session_name VARCHAR(100),
  status VARCHAR(20) DEFAULT 'disconnected',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_queue_barbershop ON queue(barbershop_id);
CREATE INDEX idx_queue_status ON queue(status);
CREATE INDEX idx_queue_position ON queue(position);
CREATE INDEX idx_queue_token ON queue(queue_token);
CREATE INDEX idx_token_expires ON queue(token_expires_at);
CREATE INDEX idx_barbershop_status ON queue(barbershop_id, status);

-- Subscription/trial columns on barbershops
ALTER TABLE barbershops ADD COLUMN trial_expires_at TIMESTAMP NULL;
ALTER TABLE barbershops ADD COLUMN subscription_status ENUM('trial','active','cancelled','expired') DEFAULT 'trial';
ALTER TABLE barbershops ADD COLUMN owner_name VARCHAR(120) NULL;
ALTER TABLE barbershops ADD COLUMN email VARCHAR(120) NULL;
ALTER TABLE barbershops ADD COLUMN phone VARCHAR(20) NULL;

-- Migrations tracking table
CREATE TABLE IF NOT EXISTS _migrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Mark all migrations as applied
INSERT INTO _migrations (name) VALUES ('004_platform_owner_and_trial');
INSERT INTO _migrations (name) VALUES ('005_subscription_fields');
INSERT INTO _migrations (name) VALUES ('006_barber_photo_role_active');
