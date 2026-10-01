import pool from '../config/db';

export async function runMigration200AddSolidconQuitadoToTransactions() {
    console.log('│  Migration 200: Add solidcon_quitado field to transactions      │');
    
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

        if (!(await columnExists('transactions', 'solidcon_quitado'))) {
            await conn.query(
                `ALTER TABLE transactions ADD COLUMN solidcon_quitado TINYINT(1) DEFAULT 0`
            );
        }

        await conn.commit();
        console.log('│  Migration 200 OK                                            │');
    } catch (error) {
        await conn.rollback();
        console.error('│  Migration 200 FAILED                                        │');
        throw error;
    } finally {
        conn.release();
    }
}
