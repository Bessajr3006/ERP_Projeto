import pool from '../config/db';

export async function runMigration216AddCdempresaAlterdata() {
    console.log('│  Migration 216: Add cdempresa_alterdata field to companies   │');
    
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

        if (!(await columnExists('companies', 'cdempresa_alterdata'))) {
            await conn.query(
                `ALTER TABLE companies ADD COLUMN cdempresa_alterdata VARCHAR(50) DEFAULT NULL COMMENT 'Numero/Codigo da empresa no Alterdata' AFTER porta_alterdata`
            );
        }

        await conn.commit();
        console.log('│  Migration 216 OK                                             │');
    } catch (error) {
        await conn.rollback();
        console.error('│  Migration 216 FAILED                                         │');
        throw error;
    } finally {
        conn.release();
    }
}
