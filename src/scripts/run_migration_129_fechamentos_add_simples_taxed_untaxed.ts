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

export async function runMigration129FechamentosAddSimplesTaxedUntaxed(): Promise<void> {
    const conn = await pool.getConnection();
    try {
        logger.info('Starting migration: run_migration_129_fechamentos_add_simples_taxed_untaxed...');

        const columnsToAdd = [
            { name: 'simples_valor_tributado', type: 'DECIMAL(15,2) DEFAULT 0.00' },
            { name: 'simples_valor_nao_tributado', type: 'DECIMAL(15,2) DEFAULT 0.00' }
        ];

        for (const col of columnsToAdd) {
            const hasCol = await columnExists('fechamentos', col.name);
            if (!hasCol) {
                logger.info(`Adding ${col.name} to fechamentos table...`);
                await pool.query(`ALTER TABLE fechamentos ADD COLUMN ${col.name} ${col.type} AFTER simples_faturamento`);
            } else {
                logger.info(`${col.name} column already exists in fechamentos table.`);
            }
        }

        // Register migration
        const migrationVersion = 129;
        const migrationDescription = 'Add simples_valor_tributado and simples_valor_nao_tributado columns to fechamentos table';
        await pool.query(
            `INSERT INTO schema_migrations (version, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE version=version`,
            [migrationVersion, migrationDescription]
        );

        logger.info('Migration run_migration_129_fechamentos_add_simples_taxed_untaxed finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_129_fechamentos_add_simples_taxed_untaxed');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration129FechamentosAddSimplesTaxedUntaxed()
        .then(() => {
            logger.info('Migration 129 completed successfully');
            process.exit(0);
        })
        .catch((err) => {
            logger.error({ err }, 'Migration 129 execution failed');
            process.exit(1);
        });
}
