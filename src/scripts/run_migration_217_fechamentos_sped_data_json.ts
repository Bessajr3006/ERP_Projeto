import pool from '../config/db';

export async function runMigration217FechamentosSpedDataJson() {
    console.log('│  Migration 217: Add sped_data_json field to fechamentos         │');
    
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

        if (!(await columnExists('fechamentos', 'sped_data_json'))) {
            await conn.query(
                `ALTER TABLE fechamentos ADD COLUMN sped_data_json LONGTEXT DEFAULT NULL`
            );
        }

        await conn.commit();
        console.log('│  Migration 217 OK                                            │');
    } catch (error) {
        await conn.rollback();
        console.error('│  Migration 217 FAILED                                        │');
        throw error;
    } finally {
        conn.release();
    }
}

if (require.main === module) {
    runMigration217FechamentosSpedDataJson()
        .then(() => {
            console.log('Migration 217 executed directly.');
            process.exit(0);
        })
        .catch(err => {
            console.error('Migration 217 direct run failed:', err);
            process.exit(1);
        });
}
