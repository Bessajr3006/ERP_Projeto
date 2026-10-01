import pool from '../config/db';

export async function runMigration220FechamentosFecp() {
    console.log('│  Migration 220: Add apuracao_fecp & apuracao_aj_fecp to fechamentos │');
    
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

        if (!(await columnExists('fechamentos', 'apuracao_fecp'))) {
            await conn.query(
                `ALTER TABLE fechamentos ADD COLUMN apuracao_fecp DECIMAL(15,2) DEFAULT 0.00 AFTER apuracao_icms`
            );
        }

        if (!(await columnExists('fechamentos', 'apuracao_aj_fecp'))) {
            await conn.query(
                `ALTER TABLE fechamentos ADD COLUMN apuracao_aj_fecp DECIMAL(15,2) DEFAULT 0.00 AFTER apuracao_aj_icms`
            );
        }

        await conn.commit();
        console.log('│  Migration 220 OK                                            │');
    } catch (error) {
        await conn.rollback();
        console.error('│  Migration 220 FAILED                                        │');
        throw error;
    } finally {
        conn.release();
    }
}

if (require.main === module) {
    runMigration220FechamentosFecp()
        .then(() => {
            console.log('Migration 220 executed directly.');
            process.exit(0);
        })
        .catch(err => {
            console.error('Migration 220 direct run failed:', err);
            process.exit(1);
        });
}
