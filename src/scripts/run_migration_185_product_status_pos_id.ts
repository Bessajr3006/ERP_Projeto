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

export async function runMigration185ProductStatusPosId(): Promise<void> {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_185_product_status_pos_id');

        if (!(await columnExists('products', 'status_pos_id'))) {
            logger.info('Adding status_pos_id column to products...');
            await pool.query(`
                ALTER TABLE products 
                ADD COLUMN status_pos_id VARCHAR(255) DEFAULT NULL AFTER idprodutopos;
            `);
            // Initialize status_pos_id based on active status
            await pool.query(`
                UPDATE products 
                SET status_pos_id = CASE 
                    WHEN active = 1 THEN 'ABCDEABC-ABCD-ABCD-ABCD-ABCED1758966' 
                    ELSE 'ABCDEABC-ABCD-ABCD-ABCD-ABCED1457822' 
                END;
            `);
        }

        logger.info('Migration run_migration_185_product_status_pos_id finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_185_product_status_pos_id');
    } finally {
        conn?.release();
    }
}
