import pool from '../config/db';

export async function runMigration214AddAlterdataFields() {
    console.log('│  Migration 214: Add Alterdata fields to companies             │');
    
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

        const fields = [
            { name: 'serv_alterdata', type: 'VARCHAR(255) DEFAULT NULL' },
            { name: 'bd_alterdata', type: 'VARCHAR(255) DEFAULT NULL' },
            { name: 'login_alterdata', type: 'VARCHAR(255) DEFAULT NULL' },
            { name: 'senha_alterdata', type: 'VARCHAR(255) DEFAULT NULL' },
            { name: 'porta_alterdata', type: 'VARCHAR(10) DEFAULT NULL' },
            { name: 'show_alterdata', type: 'TINYINT(4) NOT NULL DEFAULT 0' }
        ];

        for (const field of fields) {
            if (!(await columnExists('companies', field.name))) {
                await conn.query(
                    `ALTER TABLE companies ADD COLUMN ${field.name} ${field.type}`
                );
            }
        }

        await conn.commit();
        console.log('│  Migration 214 OK                                             │');
    } catch (error) {
        await conn.rollback();
        console.error('│  Migration 214 FAILED                                         │');
        throw error;
    } finally {
        conn.release();
    }
}
