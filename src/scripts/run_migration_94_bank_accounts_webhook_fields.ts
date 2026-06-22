import pool from '../config/db';

export async function runMigration94BankAccountsWebhookFields() {
    console.log('│  Migration 94: Add webhook fields to bank_accounts            │');
    
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

        if (!(await columnExists('bank_accounts', 'webhook_url'))) {
            await conn.query(
                `ALTER TABLE bank_accounts ADD COLUMN webhook_url VARCHAR(500) DEFAULT NULL`
            );
        }

        if (!(await columnExists('bank_accounts', 'webhook_secret'))) {
            await conn.query(
                `ALTER TABLE bank_accounts ADD COLUMN webhook_secret VARCHAR(500) DEFAULT NULL`
            );
        }

        if (!(await columnExists('bank_accounts', 'webhook_event_transaction'))) {
            await conn.query(
                `ALTER TABLE bank_accounts ADD COLUMN webhook_event_transaction TINYINT(1) NOT NULL DEFAULT 0`
            );
        }

        if (!(await columnExists('bank_accounts', 'webhook_event_account'))) {
            await conn.query(
                `ALTER TABLE bank_accounts ADD COLUMN webhook_event_account TINYINT(1) NOT NULL DEFAULT 0`
            );
        }

        if (!(await columnExists('bank_accounts', 'webhook_event_status_sync'))) {
            await conn.query(
                `ALTER TABLE bank_accounts ADD COLUMN webhook_event_status_sync TINYINT(1) NOT NULL DEFAULT 0`
            );
        }

        await conn.commit();
        console.log('│  Migration 94 OK                                             │');
    } catch (error) {
        await conn.rollback();
        console.error('│  Migration 94 FAILED                                         │');
        throw error;
    } finally {
        conn.release();
    }
}
