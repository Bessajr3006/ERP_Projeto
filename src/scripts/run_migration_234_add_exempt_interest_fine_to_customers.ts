import pool from '../config/db';

export async function runMigration234AddExemptInterestFineToCustomers() {
    console.log('│  Migration 234: Add exempt_interest_fine to customers         │');
    
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

        if (!(await columnExists('customers', 'exempt_interest_fine'))) {
            await conn.query(
                `ALTER TABLE customers ADD COLUMN exempt_interest_fine TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Isentar juros e multa do cliente' AFTER only_solidcon_baixa`
            );
        }

        await conn.commit();
        console.log('│  Migration 234 OK                                             │');
    } catch (error) {
        await conn.rollback();
        console.error('│  Migration 234 FAILED                                         │');
        throw error;
    } finally {
        conn.release();
    }
}
