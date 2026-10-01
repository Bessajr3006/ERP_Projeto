import pool from '../config/db';

export async function runMigration219SingleSessionPerUser() {
    console.log('│  Migration 219: Add single session & geoip columns to users   │');
    
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

        if (!(await columnExists('users', 'current_session_token'))) {
            await conn.query(`ALTER TABLE users ADD COLUMN current_session_token VARCHAR(500) DEFAULT NULL`);
        }
        if (!(await columnExists('users', 'current_session_ip'))) {
            await conn.query(`ALTER TABLE users ADD COLUMN current_session_ip VARCHAR(50) DEFAULT NULL`);
        }
        if (!(await columnExists('users', 'current_session_location'))) {
            await conn.query(`ALTER TABLE users ADD COLUMN current_session_location VARCHAR(255) DEFAULT NULL`);
        }
        if (!(await columnExists('users', 'current_session_user_agent'))) {
            await conn.query(`ALTER TABLE users ADD COLUMN current_session_user_agent VARCHAR(500) DEFAULT NULL`);
        }
        if (!(await columnExists('users', 'current_session_at'))) {
            await conn.query(`ALTER TABLE users ADD COLUMN current_session_at TIMESTAMP NULL DEFAULT NULL`);
        }
        if (!(await columnExists('users', 'last_activity_at'))) {
            await conn.query(`ALTER TABLE users ADD COLUMN last_activity_at TIMESTAMP NULL DEFAULT NULL`);
        }

        await conn.commit();
        console.log('│  Migration 219 OK                                            │');
    } catch (error) {
        await conn.rollback();
        console.error('│  Migration 219 FAILED                                        │');
        throw error;
    } finally {
        conn.release();
    }
}

if (require.main === module) {
    runMigration219SingleSessionPerUser()
        .then(() => {
            console.log('Migration 219 executed directly.');
            process.exit(0);
        })
        .catch(err => {
            console.error('Migration 219 direct run failed:', err);
            process.exit(1);
        });
}
