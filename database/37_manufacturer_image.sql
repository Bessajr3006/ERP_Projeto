-- Migration 37: add image_base64 to manufacturers table
ALTER TABLE manufacturers
    ADD COLUMN IF NOT EXISTS image_base64 MEDIUMTEXT DEFAULT NULL;
