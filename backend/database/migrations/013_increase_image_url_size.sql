-- Migration 013: Increase image_url column size for longer URLs
-- Some image URLs can be longer than 500 characters (e.g., food & wine product URLs)

ALTER TABLE barbershops MODIFY COLUMN image_url VARCHAR(2000) NULL;
