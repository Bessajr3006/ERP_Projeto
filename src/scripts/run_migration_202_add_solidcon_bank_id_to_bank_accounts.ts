import pool from '../config/db';

export async function runMigration202AddSolidconBankIdToBankAccounts() {
    console.log('│  Migration 202: Add solidcon_bank_id field to bank_accounts     │');
    
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

        if (!(await columnExists('bank_accounts', 'solidcon_bank_id'))) {
            await conn.query(
                `ALTER TABLE bank_accounts ADD COLUMN solidcon_bank_id VARCHAR(50) DEFAULT NULL`
            );
        }

        await conn.commit();
        console.log('│  Migration 202 OK                                            │');
    } catch (error) {
        await conn.rollback();
        console.error('│  Migration 202 FAILED                                        │');
        throw error;
    } finally {
        conn.release();
    }
}
