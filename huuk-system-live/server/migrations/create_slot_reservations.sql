-- Create table for temporary slot reservations
CREATE TABLE IF NOT EXISTS slot_reservations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    outlet_id INT NOT NULL,
    service_id INT NOT NULL,
    staff_id INT NOT NULL,
    date DATE NOT NULL,
    time TIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    status ENUM('reserved', 'confirmed', 'expired', 'cancelled') DEFAULT 'reserved',
    INDEX idx_slot_lookup (date, outlet_id, staff_id, time),
    INDEX idx_user_reservations (user_id, status),
    INDEX idx_expiry (expires_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
    FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create event to clean up expired reservations automatically
CREATE EVENT IF NOT EXISTS cleanup_expired_reservations
ON SCHEDULE EVERY 1 MINUTE
DO
  DELETE FROM slot_reservations 
  WHERE status = 'reserved' AND expires_at < NOW();
