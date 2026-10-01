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

export async function runMigration131FechamentosAddObservacao(): Promise<void> {
    const conn = await pool.getConnection();
    try {
        logger.info('Starting migration: run_migration_131_fechamentos_add_observacao...');

        const exists = await columnExists('fechamentos', 'observacao');
        if (!exists) {
            logger.info('Adding column observacao to fechamentos table...');
            await pool.query(`
                ALTER TABLE fechamentos 
                ADD COLUMN observacao TEXT NULL DEFAULT NULL AFTER imposto_csll
            `);
            logger.info('Column observacao added successfully.');
        } else {
            logger.info('Column observacao already exists in fechamentos table.');
        }

        // Register migration
        const migrationVersion = 131;
        const migrationDescription = 'Add observacao column to fechamentos table';
        await pool.query(
            `INSERT INTO schema_migrations (version, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE version=version`,
            [migrationVersion, migrationDescription]
        );

        logger.info('Migration run_migration_131_fechamentos_add_observacao finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_131_fechamentos_add_observacao');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration131FechamentosAddObservacao()
        .then(() => {
            logger.info('Migration 131 completed successfully');
            process.exit(0);
        })
        .catch((err) => {
            logger.error({ err }, 'Migration 131 execution failed');
            process.exit(1);
        });
}
