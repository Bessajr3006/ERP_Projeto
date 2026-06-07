ALTER TABLE sales_orders
ADD COLUMN IF NOT EXISTS is_deleted TINYINT(1) NOT NULL DEFAULT 0 AFTER delivery_address;

ALTER TABLE sales_items
ADD COLUMN IF NOT EXISTS is_deleted TINYINT(1) NOT NULL DEFAULT 0 AFTER total_price;

CREATE INDEX IF NOT EXISTS idx_sales_orders_company_deleted ON sales_orders(company_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_sales_items_sale_deleted ON sales_items(sale_id, is_deleted);