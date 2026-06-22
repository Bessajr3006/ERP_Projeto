import pool from '../config/db';

export async function runMigration89QuoteServices() {
    console.log('│  Migration 89: Add service_id and make product_id nullable in sales_items │');
    
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

        // 1. Make product_id nullable
        await conn.query(
            `ALTER TABLE sales_items MODIFY COLUMN product_id INT NULL`
        );

        // 2. Add service_id column if not exists
        if (!(await columnExists('sales_items', 'service_id'))) {
            await conn.query(
                `ALTER TABLE sales_items ADD COLUMN service_id INT NULL AFTER product_id`
            );

            // Add foreign key constraint
            try {
                await conn.query(
                    `ALTER TABLE sales_items ADD CONSTRAINT fk_sales_items_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT`
                );
            } catch (e: any) {
                console.warn(`[WARN] Could not add foreign key for service_id: ${e.message}`);
            }
        }

        await conn.commit();
        console.log('│  Migration 89 OK                                             │');
    } catch (error) {
        await conn.rollback();
        console.error('│  Migration 89 FAILED                                         │');
        throw error;
    } finally {
        conn.release();
    }
}
