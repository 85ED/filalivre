-- Create database
CREATE DATABASE IF NOT EXISTS fila;
USE fila;

-- Table: barbershops
CREATE TABLE barbershops (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(120) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: users
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  barbershop_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(120) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('owner', 'admin', 'barber') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (barbershop_id) REFERENCES barbershops(id) ON DELETE CASCADE
);

-- Table: barbers
CREATE TABLE barbers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  barbershop_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  status ENUM('available', 'serving', 'paused') DEFAULT 'available',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (barbershop_id) REFERENCES barbershops(id) ON DELETE CASCADE
);

-- Table: queue
CREATE TABLE queue (
  id INT AUTO_INCREMENT PRIMARY KEY,
  barbershop_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NULL,
  barber_id INT NULL,
  status ENUM('waiting', 'called', 'serving', 'finished', 'cancelled', 'no_show', 'removed') DEFAULT 'waiting',
  position INT NOT NULL,
  alert_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (barbershop_id) REFERENCES barbershops(id) ON DELETE CASCADE,
  FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE SET NULL
);

-- Table: whatsapp_sessions
CREATE TABLE whatsapp_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  barbershop_id INT NOT NULL,
  session_name VARCHAR(100),
  status VARCHAR(20) DEFAULT 'disconnected',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_queue_barbershop ON queue(barbershop_id);
CREATE INDEX idx_queue_status ON queue(status);
CREATE INDEX idx_queue_position ON queue(position);
