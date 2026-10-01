import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration212MigrateUiPreferences() {
    try {
        logger.info('Running migration: run_migration_212_migrate_ui_preferences');

        // Query existing columns in ui_preferences to build query dynamically
        const [columnsResult] = await pool.query<any[]>(
            `SELECT COLUMN_NAME 
             FROM information_schema.COLUMNS 
             WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'ui_preferences'`
        );
        
        if (!columnsResult || columnsResult.length === 0) {
            logger.info('Table ui_preferences does not exist or has no columns yet. Skipping.');
            return;
        }

        const columns = columnsResult.map((c: any) => c.COLUMN_NAME || c.column_name);
        const selectableColumns = columns.filter((col: string) => col !== 'id' && col !== 'user_public_id' && col !== 'company_id');

        const insertCols = ['company_id', 'user_public_id', ...selectableColumns].join(', ');
        const selectCols = ['company_id', "'company_default'", ...selectableColumns].join(', ');

        await pool.query(
            `INSERT INTO ui_preferences (${insertCols})
             SELECT ${selectCols}
             FROM ui_preferences
             WHERE id IN (
                 SELECT MAX(id)
                 FROM ui_preferences
                 WHERE user_public_id != 'company_default'
                 GROUP BY company_id
             )
             AND company_id NOT IN (
                 SELECT DISTINCT company_id
                 FROM ui_preferences
                 WHERE user_public_id = 'company_default'
             )`
        );

        logger.info('Migration run_migration_212_migrate_ui_preferences finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_212_migrate_ui_preferences');
    }
}
