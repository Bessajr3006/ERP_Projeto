import pool from '../config/db';
import logger from '../config/logger';

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
    const [rows] = await pool.query<any[]>(
        `SELECT COUNT(*) AS count
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?`,
        [tableName, columnName]
    );

    return Array.isArray(rows) && rows[0] && Number(rows[0].count) > 0;
}

export default async function runMigration53(): Promise<void> {
    logger.info('Running migration: run_migration_53_product_images');

    const productColumns: Array<{ name: string; definition: string; after: string }> = [
        { name: 'external_code', definition: 'VARCHAR(100) DEFAULT NULL', after: 'ean' },
        { name: 'is_imported', definition: 'TINYINT(1) NOT NULL DEFAULT 0', after: 'external_code' },
        { name: 'ncm', definition: 'VARCHAR(8) DEFAULT NULL', after: 'is_imported' },
        { name: 'cest', definition: 'VARCHAR(7) DEFAULT NULL', after: 'ncm' },
        { name: 'cost_price', definition: 'DECIMAL(10, 2) NOT NULL DEFAULT 0.00', after: 'cest' },
        { name: 'selling_price', definition: 'DECIMAL(10, 2) NOT NULL DEFAULT 0.00', after: 'cost_price' },
        { name: 'is_promotional', definition: 'TINYINT(1) NOT NULL DEFAULT 0', after: 'selling_price' },
        { name: 'promotional_price', definition: 'DECIMAL(10, 2) NOT NULL DEFAULT 0.00', after: 'is_promotional' },
        { name: 'current_stock', definition: 'DECIMAL(10, 2) NOT NULL DEFAULT 0.00', after: 'promotional_price' },
        { name: 'min_stock', definition: 'INT DEFAULT 0', after: 'current_stock' },
        { name: 'max_stock', definition: 'INT DEFAULT 0', after: 'min_stock' },
        { name: 'category_id', definition: 'INT DEFAULT NULL', after: 'max_stock' },
        { name: 'manufacturer_id', definition: 'INT DEFAULT NULL', after: 'category_id' },
        { name: 'tax_rule_id', definition: 'INT DEFAULT NULL', after: 'manufacturer_id' },
        { name: 'measure_id', definition: 'INT DEFAULT NULL', after: 'tax_rule_id' },
        { name: 'image_base64', definition: 'LONGTEXT DEFAULT NULL', after: 'measure_id' },
        { name: 'image_url', definition: 'VARCHAR(512) DEFAULT NULL', after: 'image_base64' },
    ];

    for (const column of productColumns) {
        if (!(await columnExists('products', column.name))) {
            await pool.query(`
                ALTER TABLE products
                ADD COLUMN ${column.name} ${column.definition} AFTER ${column.after}
            `);
            logger.info(`Added products.${column.name}`);
        }
    }

    if (!(await columnExists('product_categories', 'image_base64'))) {
        await pool.query(`
            ALTER TABLE product_categories
            ADD COLUMN image_base64 LONGTEXT DEFAULT NULL AFTER description
        `);
        logger.info('Added product_categories.image_base64');
    }

    if (!(await columnExists('manufacturers', 'image_base64'))) {
        await pool.query(`
            ALTER TABLE manufacturers
            ADD COLUMN image_base64 MEDIUMTEXT DEFAULT NULL
        `);
        logger.info('Added manufacturers.image_base64');
    }

    logger.info('Migration run_migration_53_product_images finished successfully!');
}
