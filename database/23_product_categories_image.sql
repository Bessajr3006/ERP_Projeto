ALTER TABLE product_categories
    ADD COLUMN image_base64 LONGTEXT DEFAULT NULL AFTER description;