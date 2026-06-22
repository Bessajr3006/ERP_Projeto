import pool from '../config/db';

export async function runMigration97BankAccountsWebhookBoleto() {
    console.log('│  Migration 97: Add webhook_event_boleto to bank_accounts     │');
    
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

        if (!(await columnExists('bank_accounts', 'webhook_event_boleto'))) {
            await conn.query(
                `ALTER TABLE bank_accounts ADD COLUMN webhook_event_boleto TINYINT(1) NOT NULL DEFAULT 0`
            );
        }

        await conn.commit();
        console.log('│  Migration 97 OK                                             │');
    } catch (error) {
        await conn.rollback();
        console.error('│  Migration 97 FAILED                                         │');
        throw error;
    } finally {
        conn.release();
    }
}
