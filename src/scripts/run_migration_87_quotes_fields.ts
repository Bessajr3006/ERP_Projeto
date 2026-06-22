import pool from '../config/db';

export default async function runMigration87QuotesFields() {
    console.log('│  Migration 87: Add observation and seller_id to sales_orders │');
    
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        // Helper function to check if column exists
        const columnExists = async (tableName: string, columnName: string) => {
            const [rows] = await conn.query<any[]>(
                `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
                [tableName, columnName]
            );
            return rows.length > 0;
        };

        if (!(await columnExists('sales_orders', 'seller_id'))) {
            await conn.query(
                `ALTER TABLE sales_orders ADD COLUMN seller_id INT NULL AFTER customer_id`
            );
            
            // Add foreign key constraint if users table is assumed
            try {
                await conn.query(
                    `ALTER TABLE sales_orders ADD CONSTRAINT fk_sales_orders_seller FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE SET NULL`
                );
            } catch(e: any) {
                console.warn(`[WARN] Could not add foreign key for seller_id: ${e.message}`);
            }
        }

        if (!(await columnExists('sales_orders', 'observation'))) {
            await conn.query(
                `ALTER TABLE sales_orders ADD COLUMN observation TEXT NULL AFTER delivery_address`
            );
        }

        if (!(await columnExists('sales_orders', 'validity_date'))) {
            await conn.query(
                `ALTER TABLE sales_orders ADD COLUMN validity_date DATETIME NULL AFTER date`
            );
        }

        await conn.commit();
        console.log('│  Migration 87 OK                                             │');
    } catch (error) {
        await conn.rollback();
        console.error('│  Migration 87 FAILED                                         │');
        throw error;
    } finally {
        conn.release();
    }
}
