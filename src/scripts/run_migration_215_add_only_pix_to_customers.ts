import pool from '../config/db';

export async function runMigration215AddOnlyPixToCustomers() {
    console.log('│  Migration 215: Add only_pix field to customers               │');
    
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

        if (!(await columnExists('customers', 'only_pix'))) {
            await conn.query(
                `ALTER TABLE customers ADD COLUMN only_pix TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Travar emissao de boleto (Somente PIX)' AFTER limite`
            );
        }

        await conn.commit();
        console.log('│  Migration 215 OK                                             │');
    } catch (error) {
        await conn.rollback();
        console.error('│  Migration 215 FAILED                                         │');
        throw error;
    } finally {
        conn.release();
    }
}
