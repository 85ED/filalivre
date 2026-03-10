-- Migration 010: Add image_url to barbershops
ALTER TABLE barbershops ADD COLUMN image_url VARCHAR(500) NULL;
