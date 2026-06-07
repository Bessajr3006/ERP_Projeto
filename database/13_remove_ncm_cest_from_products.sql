-- 13_remove_ncm_cest_from_products.sql
ALTER TABLE products
DROP COLUMN ncm,
DROP COLUMN cest;
