import pool from '../config/db';

export async function runMigration199AddCdfilialToTransactions() {
    console.log('│  Migration 199: Add cdfilial field to transactions              │');
    
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

        if (!(await columnExists('transactions', 'cdfilial'))) {
            await conn.query(
                `ALTER TABLE transactions ADD COLUMN cdfilial VARCHAR(255) DEFAULT NULL`
            );
        }

        await conn.commit();
        console.log('│  Migration 199 OK                                            │');
    } catch (error) {
        await conn.rollback();
        console.error('│  Migration 199 FAILED                                        │');
        throw error;
    } finally {
        conn.release();
    }
}
