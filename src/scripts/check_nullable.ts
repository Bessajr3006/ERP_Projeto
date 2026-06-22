import 'dotenv/config';
import pool from '../config/db';

async function main() {
    try {
        const columnsToCheck = [
            { table: 'sales_orders', column: 'seller_id' },
            { table: 'customers', column: 'seller_user_id' },
            { table: 'audit_logs', column: 'user_id' }
        ];

        for (const item of columnsToCheck) {
            const [rows] = await pool.query<any[]>(`
                SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_TYPE
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = ?
                  AND COLUMN_NAME = ?
            `, [item.table, item.column]);
            console.log(`Table: ${item.table}, Column: ${item.column}`);
            console.table(rows);
        }
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

main();
