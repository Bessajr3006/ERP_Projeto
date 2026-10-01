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

export async function runMigration126FechamentosAddAjustes(): Promise<void> {
    const conn = await pool.getConnection();
    try {
        logger.info('Starting migration: run_migration_126_fechamentos_add_ajustes...');

        const hasAjIcms = await columnExists('fechamentos', 'apuracao_aj_icms');
        if (!hasAjIcms) {
            logger.info('Adding apuracao_aj_icms, apuracao_aj_pis, apuracao_aj_cofins to fechamentos...');
            await pool.query(`
                ALTER TABLE fechamentos 
                ADD COLUMN apuracao_aj_icms DECIMAL(15,2) DEFAULT 0.00 AFTER apuracao_cofins,
                ADD COLUMN apuracao_aj_pis DECIMAL(15,2) DEFAULT 0.00 AFTER apuracao_aj_icms,
                ADD COLUMN apuracao_aj_cofins DECIMAL(15,2) DEFAULT 0.00 AFTER apuracao_aj_pis
            `);
            logger.info('fechamentos table altered successfully.');
        } else {
            logger.info('Ajustes columns already exist in fechamentos table.');
        }

        // Register migration
        const migrationVersion = 126;
        const migrationDescription = 'Add apuracao_aj_icms, apuracao_aj_pis, and apuracao_aj_cofins to fechamentos table';
        await pool.query(
            `INSERT INTO schema_migrations (version, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE version=version`,
            [migrationVersion, migrationDescription]
        );

        logger.info('Migration run_migration_126_fechamentos_add_ajustes finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_126_fechamentos_add_ajustes');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration126FechamentosAddAjustes()
        .then(() => {
            logger.info('Migration 126 completed successfully');
            process.exit(0);
        })
        .catch((err) => {
            logger.error({ err }, 'Migration 126 execution failed');
            process.exit(1);
        });
}
