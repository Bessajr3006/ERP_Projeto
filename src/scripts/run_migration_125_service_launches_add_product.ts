import 'dotenv/config';
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

export async function runMigration125ServiceLaunchesAddProduct(): Promise<void> {
    const conn = await pool.getConnection();
    try {
        logger.info('Starting migration: run_migration_125_service_launches_add_product...');

        const hasProductCol = await columnExists('service_launches', 'product_id');
        if (!hasProductCol) {
            logger.info('Modifying service_launches columns...');
            // 1. Modify service_id to be NULL
            await pool.query(`
                ALTER TABLE service_launches 
                MODIFY COLUMN service_id INT NULL
            `);
            // 2. Add product_id column
            await pool.query(`
                ALTER TABLE service_launches 
                ADD COLUMN product_id INT NULL AFTER service_id,
                ADD CONSTRAINT fk_service_launches_product_id FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
            `);
            logger.info('service_launches table columns modified successfully.');
        } else {
            logger.info('Column product_id already exists in service_launches table.');
        }

        // Register migration
        const migrationVersion = 125;
        const migrationDescription = 'Add product_id column and make service_id nullable in service_launches table';
        await pool.query(
            `INSERT INTO schema_migrations (version, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE version=version`,
            [migrationVersion, migrationDescription]
        );

        logger.info('Migration run_migration_125_service_launches_add_product finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_125_service_launches_add_product');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration125ServiceLaunchesAddProduct()
        .then(() => {
            logger.info('Migration 125 completed successfully');
            process.exit(0);
        })
        .catch((err) => {
            logger.error({ err }, 'Migration 125 execution failed');
            process.exit(1);
        });
}
