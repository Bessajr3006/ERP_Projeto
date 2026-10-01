import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration226RemoveKeystoneInterestTransactions(): Promise<void> {
    let conn;
    try {
        conn = await pool.getConnection();
        const [result]: any = await conn.query(`
            DELETE FROM transactions 
            WHERE (
                description LIKE '%Juros de conv%' 
                OR description LIKE '%Juros de convênio%' 
                OR description LIKE '%Juros de convenio%' 
                OR description LIKE '%[ORIGIN_TX:%'
            )
        `);
        if (result?.affectedRows > 0) {
            logger.info(`[Migration 226] Removidos ${result.affectedRows} lançamentos de juros separados do Keystone (permanecem gravados diretamente no Solidcon).`);
        }
    } catch (error: any) {
        logger.error(`[Migration 226] Erro ao remover lançamentos de juros do Keystone: ${error.message}`);
    } finally {
        conn?.release();
    }
}

