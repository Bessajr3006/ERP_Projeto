import pool from '../config/db';

export async function runMigration92SolidconDorsalFields() {
    console.log('│  Migration 92: Add Solidcon and Dorsal fields to companies │');
    
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
            'serv_solidcon',
            'bd_solidcon',
            'login_solidcon',
            'senha_solidcon',
            'serv_dorsal',
            'bd_dorsal',
            'login_dorsal',
            'senha_dorsal'
        ];

        for (const field of fields) {
            if (!(await columnExists('companies', field))) {
                await conn.query(
                    `ALTER TABLE companies ADD COLUMN ${field} VARCHAR(255) DEFAULT NULL`
                );
            }
        }

        await conn.commit();
        console.log('│  Migration 92 OK                                             │');
    } catch (error) {
        await conn.rollback();
        console.error('│  Migration 92 FAILED                                         │');
        throw error;
    } finally {
        conn.release();
    }
}
