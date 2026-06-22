import pool from '../config/db';

export async function runMigration93AddCdfilial() {
    console.log('│  Migration 93: Add cdfilial field to companies                │');
    
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

        if (!(await columnExists('companies', 'cdfilial'))) {
            await conn.query(
                `ALTER TABLE companies ADD COLUMN cdfilial VARCHAR(255) DEFAULT NULL`
            );
        }

        await conn.commit();
        console.log('│  Migration 93 OK                                             │');
    } catch (error) {
        await conn.rollback();
        console.error('│  Migration 93 FAILED                                         │');
        throw error;
    } finally {
        conn.release();
    }
}
