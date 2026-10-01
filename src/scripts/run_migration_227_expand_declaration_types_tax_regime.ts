import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration227ExpandDeclarationTypesTaxRegime(): Promise<void> {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Starting migration: 227 - Expand declaration_types tax_regime column to VARCHAR(255)');

        await conn.query(`
            ALTER TABLE declaration_types 
            MODIFY COLUMN tax_regime VARCHAR(255) NULL;
        `);

        logger.info('Migration 227 finished successfully: declaration_types.tax_regime modified to VARCHAR(255).');
    } catch (error: any) {
        logger.error({ err: error }, 'Error running migration 227: ' + error.message);
    } finally {
        conn?.release();
    }
}export default runMigration227ExpandDeclarationTypesTaxRegime;

if (require.main === module) {
    runMigration227ExpandDeclarationTypesTaxRegime().then(() => process.exit(0)).catch(() => process.exit(1));
}
