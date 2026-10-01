import pool from '../config/db';

export async function runMigration233AddOnlySolidconBaixaToCustomers() {
    console.log('│  Migration 233: Add only_solidcon_baixa to customers          │');
    
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

        if (!(await columnExists('customers', 'only_solidcon_baixa'))) {
            await conn.query(
                `ALTER TABLE customers ADD COLUMN only_solidcon_baixa TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Travar baixa no Keystone (Baixa Exclusiva Solidcon)' AFTER only_pix`
            );
        }

        await conn.commit();
        console.log('│  Migration 233 OK                                             │');
    } catch (error) {
        await conn.rollback();
        console.error('│  Migration 233 FAILED                                         │');
        throw error;
    } finally {
        conn.release();
    }
}
