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

export async function runMigration127FechamentosAddSimples(): Promise<void> {
    const conn = await pool.getConnection();
    try {
        logger.info('Starting migration: run_migration_127_fechamentos_add_simples...');

        const hasSimples = await columnExists('fechamentos', 'simples_faturamento');
        if (!hasSimples) {
            logger.info('Adding simples_faturamento, simples_aliquota, simples_das to fechamentos...');
            await pool.query(`
                ALTER TABLE fechamentos 
                ADD COLUMN simples_faturamento DECIMAL(15,2) DEFAULT 0.00 AFTER imposto_csll,
                ADD COLUMN simples_aliquota DECIMAL(15,2) DEFAULT 0.00 AFTER simples_faturamento,
                ADD COLUMN simples_das DECIMAL(15,2) DEFAULT 0.00 AFTER simples_aliquota
            `);
            logger.info('fechamentos table altered successfully.');
        } else {
            logger.info('Simples columns already exist in fechamentos table.');
        }

        // Register migration
        const migrationVersion = 127;
        const migrationDescription = 'Add simples_faturamento, simples_aliquota, and simples_das to fechamentos table';
        await pool.query(
            `INSERT INTO schema_migrations (version, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE version=version`,
            [migrationVersion, migrationDescription]
        );

        logger.info('Migration run_migration_127_fechamentos_add_simples finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_127_fechamentos_add_simples');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration127FechamentosAddSimples()
        .then(() => {
            logger.info('Migration 127 completed successfully');
            process.exit(0);
        })
        .catch((err) => {
            logger.error({ err }, 'Migration 127 execution failed');
            process.exit(1);
        });
}
