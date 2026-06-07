ALTER TABLE sales_orders
MODIFY COLUMN status ENUM('pending', 'progress', 'completed', 'cancelled', 'separated', 'invoiced') NOT NULL DEFAULT 'pending';
