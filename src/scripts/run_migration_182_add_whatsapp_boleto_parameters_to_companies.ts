import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration182AddWhatsappBoletoParametersToCompanies() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_182_add_whatsapp_boleto_parameters_to_companies');

        const [autoSendCols] = await pool.query<any[]>(
            `SHOW COLUMNS FROM companies LIKE 'auto_send_boleto_whatsapp'`
        );
        const [sendTimeCols] = await pool.query<any[]>(
            `SHOW COLUMNS FROM companies LIKE 'boleto_send_time'`
        );
        const [sendNumberCols] = await pool.query<any[]>(
            `SHOW COLUMNS FROM companies LIKE 'boleto_send_whatsapp_number'`
        );
        const [sendNameCols] = await pool.query<any[]>(
            `SHOW COLUMNS FROM companies LIKE 'boleto_send_whatsapp_name'`
        );

        if (autoSendCols.length === 0) {
            await pool.query(
                `ALTER TABLE companies ADD COLUMN auto_send_boleto_whatsapp TINYINT(1) NOT NULL DEFAULT 0`
            );
            logger.info('Column auto_send_boleto_whatsapp added to companies table.');
        } else {
            logger.info('Column auto_send_boleto_whatsapp already exists in companies table.');
        }

        if (sendTimeCols.length === 0) {
            await pool.query(
                `ALTER TABLE companies ADD COLUMN boleto_send_time VARCHAR(5) NULL DEFAULT '08:00'`
            );
            logger.info('Column boleto_send_time added to companies table.');
        } else {
            logger.info('Column boleto_send_time already exists in companies table.');
        }

        if (sendNumberCols.length === 0) {
            await pool.query(
                `ALTER TABLE companies ADD COLUMN boleto_send_whatsapp_number VARCHAR(20) NULL`
            );
            logger.info('Column boleto_send_whatsapp_number added to companies table.');
        } else {
            logger.info('Column boleto_send_whatsapp_number already exists in companies table.');
        }

        if (sendNameCols.length === 0) {
            await pool.query(
                `ALTER TABLE companies ADD COLUMN boleto_send_whatsapp_name VARCHAR(100) NULL`
            );
            logger.info('Column boleto_send_whatsapp_name added to companies table.');
        } else {
            logger.info('Column boleto_send_whatsapp_name already exists in companies table.');
        }

        logger.info('Migration run_migration_182_add_whatsapp_boleto_parameters_to_companies finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_182_add_whatsapp_boleto_parameters_to_companies');
    } finally {
        conn?.release();
    }
}
