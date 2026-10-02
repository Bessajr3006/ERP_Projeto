import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration211CopyDbCredentials() {
    try {
        logger.info('Running migration: run_migration_211_copy_db_credentials');

        // Copy credentials from company ID 3 ('NOVA GESTAO') to company ID 1 and 2 if they are empty
        const [sourceRows]: any = await pool.query(
            `SELECT serv_dorsal, bd_dorsal, login_dorsal, senha_dorsal, 
                    serv_solidcon, bd_solidcon, login_solidcon, senha_solidcon, cdfilial
             FROM companies WHERE id = 3 LIMIT 1`
        );
        const source = sourceRows?.[0];
        if (source && source.serv_dorsal) {
            await pool.query(
                `UPDATE companies 
                 SET serv_dorsal = ?, 
                     bd_dorsal = ?, 
                     login_dorsal = ?, 
                     senha_dorsal = ?,
                     serv_solidcon = ?, 
                     bd_solidcon = ?, 
                     login_solidcon = ?, 
                     senha_solidcon = ?,
                     cdfilial = COALESCE(cdfilial, ?)
                 WHERE id IN (1, 2) AND (serv_dorsal IS NULL OR serv_dorsal = '')`,
                [
                    source.serv_dorsal,
                    source.bd_dorsal,
                    source.login_dorsal,
                    source.senha_dorsal,
                    source.serv_solidcon,
                    source.bd_solidcon,
                    source.login_solidcon,
                    source.senha_solidcon,
                    source.cdfilial || '1'
                ]
            );
        }

        logger.info('Migration run_migration_211_copy_db_credentials finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_211_copy_db_credentials');
    }
}
