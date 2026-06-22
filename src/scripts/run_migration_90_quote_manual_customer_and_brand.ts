import pool from '../config/db';

export async function runMigration90QuoteManualCustomerAndBrand() {
    console.log('│  Migration 90: Add manual_customer_name and brand to sales_orders │');
    
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

        // 1. Add manual_customer_name column if not exists
        if (!(await columnExists('sales_orders', 'manual_customer_name'))) {
            await conn.query(
                `ALTER TABLE sales_orders ADD COLUMN manual_customer_name VARCHAR(150) NULL AFTER customer_id`
            );
        }

        // 2. Add brand column if not exists
        if (!(await columnExists('sales_orders', 'brand'))) {
            await conn.query(
                `ALTER TABLE sales_orders ADD COLUMN brand VARCHAR(100) NULL AFTER validity_date`
            );
        }

        await conn.commit();
        console.log('│  Migration 90 OK                                             │');
    } catch (error) {
        await conn.rollback();
        console.error('│  Migration 90 FAILED                                         │');
        throw error;
    } finally {
        conn.release();
    }
}
