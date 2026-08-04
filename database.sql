-- ServisDrama Database Setup
-- Run this SQL file in MySQL to create the database structure

CREATE DATABASE IF NOT EXISTS servisdrama;
USE servisdrama;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  role ENUM('admin', 'tech', 'sales') DEFAULT 'tech',
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_username (username),
  INDEX idx_role (role)
);

-- Device Data Table (Attack/Alert data)
CREATE TABLE IF NOT EXISTS device_data (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  device_id VARCHAR(100),
  device_name VARCHAR(255),
  attack_type VARCHAR(100),
  severity ENUM('Low', 'Medium', 'High', 'Critical') DEFAULT 'Medium',
  location VARCHAR(255),
  ip_address VARCHAR(45),
  port INT,
  payload LONGTEXT,
  status ENUM('pending', 'investigating', 'resolved', 'false_alarm') DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_device_id (device_id),
  INDEX idx_severity (severity),
  INDEX idx_created_at (created_at)
);

-- Activity Log Table
CREATE TABLE IF NOT EXISTS activity_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  action VARCHAR(255),
  details TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
);

-- Backup History Table
CREATE TABLE IF NOT EXISTS backup_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  backup_type ENUM('json', 'csv', 'sql') DEFAULT 'json',
  filename VARCHAR(255),
  file_size INT,
  record_count INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
);

-- NOT: Bildirimler ayrı bir tabloda tutulmaz. Uygulama verisi (firmalar,
-- ziyaretler, satışçılar, bildirimler) app_state tablosundaki tek JSON
-- payload içinde saklanır — bkz. config/database.js ve routes/state.js.

-- Insert Default Users
INSERT INTO users (username, password, name, email, role) VALUES
('barkin.kayaci', '$2a$10$P5q2cF1I1r8zC0Z0C0Z0C.9LkJ2E5M5M5M5M5M5M5M5M5M5M5M5M', 'Barkın Kayacı', 'barkin@dramagroup.com', 'admin'),
('semih.aglan', '$2a$10$P5q2cF1I1r8zC0Z0C0Z0C.9LkJ2E5M5M5M5M5M5M5M5M5M5M5M5M', 'Semih Ağlan', 'semih@dramagroup.com', 'tech'),
('suleyman', '$2a$10$P5q2cF1I1r8zC0Z0C0Z0C.9LkJ2E5M5M5M5M5M5M5M5M5M5M5M5M', 'Süleyman Küçük', 'suleyman@dramagroup.com', 'tech'),
('ayse.yilmaz', '$2a$10$P5q2cF1I1r8zC0Z0C0Z0C.9LkJ2E5M5M5M5M5M5M5M5M5M5M5M5M', 'Ayşe Yılmaz', 'ayse@dramagroup.com', 'sales'),
('mehmet.ozdemir', '$2a$10$P5q2cF1I1r8zC0Z0C0Z0C.9LkJ2E5M5M5M5M5M5M5M5M5M5M5M5M', 'Mehmet Özdemir', 'mehmet@dramagroup.com', 'sales');

-- Sample Data
INSERT INTO device_data (user_id, device_id, device_name, attack_type, severity, location, ip_address, port, status) VALUES
(1, 'DEV001', 'Server 1', 'Port Scan', 'High', 'Data Center', '192.168.1.100', 22, 'resolved'),
(1, 'DEV002', 'Router', 'SSH Brute Force', 'Critical', 'Network Room', '192.168.1.1', 22, 'investigating'),
(2, 'DEV003', 'Web Server', 'SQL Injection Attempt', 'Medium', 'Cloud', '10.0.0.50', 3306, 'false_alarm');
