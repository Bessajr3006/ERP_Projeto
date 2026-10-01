import pool from '../config/db';

export async function runMigration235AddAsaasFieldsToBankAccounts() {
    console.log('│  Migration 235: Add Asaas API & Webhook fields to bank_accounts│');
    
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const columnExists = async (tableName: string, columnName: string) => {
            const [rows] = await conn.query<any[]>(
                `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
                [tableName, columnName]
            );
            return rows.length > 0;
        };

        const columnsToAdd: Array<{ name: string; query: string }> = [
            { name: 'asaas_environment', query: `ALTER TABLE bank_accounts ADD COLUMN asaas_environment VARCHAR(20) NOT NULL DEFAULT 'production' COMMENT 'Ambiente Asaas: production ou sandbox'` },
            { name: 'asaas_api_key', query: `ALTER TABLE bank_accounts ADD COLUMN asaas_api_key TEXT NULL COMMENT 'Chave de API / Access Token Asaas (criptografado)'` },
            { name: 'asaas_wallet_id', query: `ALTER TABLE bank_accounts ADD COLUMN asaas_wallet_id VARCHAR(100) NULL COMMENT 'ID da Carteira / Wallet ID Asaas'` },
            { name: 'asaas_fine', query: `ALTER TABLE bank_accounts ADD COLUMN asaas_fine DECIMAL(5,2) NULL COMMENT 'Multa padrao Asaas (%)'` },
            { name: 'asaas_interest', query: `ALTER TABLE bank_accounts ADD COLUMN asaas_interest DECIMAL(5,2) NULL COMMENT 'Juros ao mes padrao Asaas (%)'` },
            { name: 'asaas_discount_value', query: `ALTER TABLE bank_accounts ADD COLUMN asaas_discount_value DECIMAL(10,2) NULL COMMENT 'Desconto padrao Asaas'` },
            { name: 'asaas_discount_days', query: `ALTER TABLE bank_accounts ADD COLUMN asaas_discount_days INT NULL COMMENT 'Dias de antecedencia para desconto Asaas'` },
            { name: 'asaas_webhook_url', query: `ALTER TABLE bank_accounts ADD COLUMN asaas_webhook_url VARCHAR(500) NULL COMMENT 'URL do Webhook Asaas'` },
            { name: 'asaas_webhook_email', query: `ALTER TABLE bank_accounts ADD COLUMN asaas_webhook_email VARCHAR(255) NULL COMMENT 'E-mail para notificacoes de erro no Webhook Asaas'` },
            { name: 'asaas_webhook_token', query: `ALTER TABLE bank_accounts ADD COLUMN asaas_webhook_token TEXT NULL COMMENT 'Token de autenticacao do Webhook Asaas (criptografado)'` },
            { name: 'asaas_webhook_event_payment_created', query: `ALTER TABLE bank_accounts ADD COLUMN asaas_webhook_event_payment_created TINYINT(1) NOT NULL DEFAULT 0` },
            { name: 'asaas_webhook_event_payment_updated', query: `ALTER TABLE bank_accounts ADD COLUMN asaas_webhook_event_payment_updated TINYINT(1) NOT NULL DEFAULT 0` },
            { name: 'asaas_webhook_event_payment_confirmed', query: `ALTER TABLE bank_accounts ADD COLUMN asaas_webhook_event_payment_confirmed TINYINT(1) NOT NULL DEFAULT 0` },
            { name: 'asaas_webhook_event_payment_received', query: `ALTER TABLE bank_accounts ADD COLUMN asaas_webhook_event_payment_received TINYINT(1) NOT NULL DEFAULT 1` },
            { name: 'asaas_webhook_event_payment_overdue', query: `ALTER TABLE bank_accounts ADD COLUMN asaas_webhook_event_payment_overdue TINYINT(1) NOT NULL DEFAULT 0` },
            { name: 'asaas_webhook_event_payment_deleted', query: `ALTER TABLE bank_accounts ADD COLUMN asaas_webhook_event_payment_deleted TINYINT(1) NOT NULL DEFAULT 0` },
            { name: 'asaas_webhook_event_payment_restored', query: `ALTER TABLE bank_accounts ADD COLUMN asaas_webhook_event_payment_restored TINYINT(1) NOT NULL DEFAULT 0` },
            { name: 'asaas_webhook_event_payment_refunded', query: `ALTER TABLE bank_accounts ADD COLUMN asaas_webhook_event_payment_refunded TINYINT(1) NOT NULL DEFAULT 0` },
        ];

        for (const col of columnsToAdd) {
            if (!(await columnExists('bank_accounts', col.name))) {
                await conn.query(col.query);
            }
        }

        await conn.commit();
        console.log('│  Migration 235 OK                                             │');
    } catch (error) {
        await conn.rollback();
        console.error('│  Migration 235 FAILED                                         │');
        throw error;
    } finally {
        conn.release();
    }
}
