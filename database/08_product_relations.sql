ALTER TABLE products 
ADD COLUMN category_id INT NULL,
ADD COLUMN manufacturer_id INT NULL,
ADD COLUMN tax_rule_id INT NULL,
ADD CONSTRAINT fk_product_category FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_product_manufacturer FOREIGN KEY (manufacturer_id) REFERENCES manufacturers(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_product_tax_rule FOREIGN KEY (tax_rule_id) REFERENCES tax_rules(id) ON DELETE SET NULL;
