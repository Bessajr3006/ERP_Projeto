-- 74_product_stock_type.sql
-- Vincula produtos ao tipo de estoque.

ALTER TABLE products
ADD COLUMN IF NOT EXISTS stock_type_id INT NULL AFTER category_id;

CREATE INDEX IF NOT EXISTS idx_products_stock_type_id ON products (stock_type_id);
