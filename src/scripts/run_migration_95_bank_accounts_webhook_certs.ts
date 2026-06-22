import pool from '../config/db';

export async function runMigration95BankAccountsWebhookCerts() {
    console.log('│  Migration 95: Add webhook certificate fields to bank_accounts │');
    
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

        if (!(await columnExists('bank_accounts', 'webhook_certificate'))) {
            await conn.query(
                `ALTER TABLE bank_accounts ADD COLUMN webhook_certificate TEXT DEFAULT NULL`
            );
        }

        if (!(await columnExists('bank_accounts', 'webhook_key'))) {
            await conn.query(
                `ALTER TABLE bank_accounts ADD COLUMN webhook_key TEXT DEFAULT NULL`
            );
        }

        await conn.commit();
        console.log('│  Migration 95 OK                                             │');
    } catch (error) {
        await conn.rollback();
        console.error('│  Migration 95 FAILED                                         │');
        throw error;
    } finally {
        conn.release();
    }
}
