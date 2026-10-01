import 'dotenv/config';
import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration243CustomerHideInRevenuesGrid() {
    console.log('│  Migration 243: Add hide_in_revenues_grid to customers        │');
    
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const columnExists = async (tableName: string, columnName: string) => {
            const [rows]: any = await conn.query(
                `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
                [tableName, columnName]
            );
            return rows && rows.length > 0;
        };

        if (!(await columnExists('customers', 'hide_in_revenues_grid'))) {
            await conn.query(
                `ALTER TABLE customers ADD COLUMN hide_in_revenues_grid TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Não exibir no grid receita (revenues.html)' AFTER exempt_interest_fine`
            );
        }

        await conn.commit();
        console.log('│  Migration 243 OK                                             │');
        logger.info('Migration 243 executed successfully');
    } catch (error) {
        await conn.rollback();
        console.error('│  Migration 243 FAILED                                         │');
        logger.error({ error }, 'Migration 243 failed');
        throw error;
    } finally {
        conn.release();
    }
}

if (require.main === module) {
    runMigration243CustomerHideInRevenuesGrid()
        .then(() => {
            console.log('Finished standalone migration 243 execution');
            process.exit(0);
        })
        .catch((err) => {
            console.error('Error executing standalone migration 243:', err);
            process.exit(1);
        });
}
