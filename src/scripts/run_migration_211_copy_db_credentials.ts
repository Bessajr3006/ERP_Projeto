import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration211CopyDbCredentials() {
    try {
        logger.info('Running migration: run_migration_211_copy_db_credentials');

        // Copy credentials from company ID 3 ('NOVA GESTAO') to company ID 1 and 2 if they are empty
        await pool.query(
            `UPDATE companies 
             SET serv_dorsal = '190.107.93.66,1433', 
                 bd_dorsal = 'dorsal', 
                 login_dorsal = 'aporttec', 
                 senha_dorsal = '30mariafn@',
                 serv_solidcon = '190.107.93.66,1433', 
                 bd_solidcon = 'solidcon', 
                 login_solidcon = 'aporttec', 
                 senha_solidcon = '30mariafn@',
                 cdfilial = COALESCE(cdfilial, '1')
             WHERE id IN (1, 2) AND (serv_dorsal IS NULL OR serv_dorsal = '')`
        );

        logger.info('Migration run_migration_211_copy_db_credentials finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_211_copy_db_credentials');
    }
}
