-- Migration 006: Add user_id to barbers table to link barber records to user accounts
ALTER TABLE barbers ADD COLUMN user_id INT NULL AFTER barbershop_id;
ALTER TABLE barbers ADD CONSTRAINT fk_barbers_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX idx_barbers_user_id ON barbers(user_id);
