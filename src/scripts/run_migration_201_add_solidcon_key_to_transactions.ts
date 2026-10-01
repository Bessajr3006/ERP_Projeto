import pool from '../config/db';

export async function runMigration201AddSolidconKeyToTransactions() {
    console.log('│  Migration 201: Add solidcon_key field to transactions          │');
    
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

        if (!(await columnExists('transactions', 'solidcon_key'))) {
            await conn.query(
                `ALTER TABLE transactions ADD COLUMN solidcon_key VARCHAR(255) DEFAULT NULL`
            );
        }

        await conn.commit();
        console.log('│  Migration 201 OK                                            │');
    } catch (error) {
        await conn.rollback();
        console.error('│  Migration 201 FAILED                                        │');
        throw error;
    } finally {
        conn.release();
    }
}
