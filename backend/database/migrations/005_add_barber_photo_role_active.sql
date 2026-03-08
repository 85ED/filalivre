-- Migration 005: Add photo_url, role, and active to barbers
ALTER TABLE barbers ADD COLUMN photo_url VARCHAR(500) NULL AFTER name;
ALTER TABLE barbers ADD COLUMN role VARCHAR(60) NULL AFTER photo_url;
ALTER TABLE barbers ADD COLUMN active BOOLEAN DEFAULT TRUE AFTER role;
