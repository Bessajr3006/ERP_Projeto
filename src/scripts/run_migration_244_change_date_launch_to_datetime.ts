import 'dotenv/config';
import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration244ChangeDateLaunchToDatetime() {
    console.log('│  Migration 244: Change date_launch to DATETIME in transactions │');
    
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [rows]: any = await conn.query(
            `SELECT DATA_TYPE 
             FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'transactions' 
               AND COLUMN_NAME = 'date_launch'`
        );

        const currentType = rows && rows.length > 0 ? String(rows[0].DATA_TYPE).toLowerCase() : null;

        if (currentType === 'date') {
            console.log('│  Altering transactions.date_launch from DATE to DATETIME...   │');
            await conn.query(
                `ALTER TABLE transactions MODIFY COLUMN date_launch DATETIME DEFAULT NULL`
            );

            // Populate time part from created_at for existing rows where time is midnight and created_at exists
            await conn.query(
                `UPDATE transactions 
                 SET date_launch = TIMESTAMP(DATE(date_launch), TIME(created_at)) 
                 WHERE date_launch IS NOT NULL 
                   AND TIME(date_launch) = '00:00:00' 
                   AND created_at IS NOT NULL`
            );
        }

        await conn.commit();
        console.log('│  Migration 244 OK                                             │');
        logger.info('Migration 244 executed successfully');
    } catch (error) {
        await conn.rollback();
        console.error('│  Migration 244 FAILED                                         │');
        logger.error({ error }, 'Migration 244 failed');
        throw error;
    } finally {
        conn.release();
    }
}

if (require.main === module) {
    runMigration244ChangeDateLaunchToDatetime()
        .then(() => {
            console.log('Finished standalone migration 244 execution');
            process.exit(0);
        })
        .catch((err) => {
            console.error('Error executing standalone migration 244:', err);
            process.exit(1);
        });
}
