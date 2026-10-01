import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration173AddIdmedidaposToMeasures() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_173_add_idmedidapos_to_measures');

        // Check if idmedidapos column exists in measures table
        const [columns] = await pool.query<any[]>(
            `SHOW COLUMNS FROM measures LIKE 'idmedidapos'`
        );

        if (columns.length === 0) {
            await pool.query(
                `ALTER TABLE measures ADD COLUMN idmedidapos VARCHAR(255) DEFAULT NULL`
            );
            logger.info('Column idmedidapos added to measures table.');
        } else {
            logger.info('Column idmedidapos already exists in measures table.');
        }

        logger.info('Migration run_migration_173_add_idmedidapos_to_measures finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_173_add_idmedidapos_to_measures');
    } finally {
        conn?.release();
    }
}
