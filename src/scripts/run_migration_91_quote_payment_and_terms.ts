import pool from '../config/db';

export async function runMigration91QuotePaymentAndTerms() {
    console.log('│  Migration 91: Add payment_method and payment_terms to sales_orders │');
    
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

        // 1. Add payment_method column if not exists
        if (!(await columnExists('sales_orders', 'payment_method'))) {
            await conn.query(
                `ALTER TABLE sales_orders ADD COLUMN payment_method VARCHAR(50) NULL AFTER brand`
            );
        }

        // 2. Add payment_terms column if not exists
        if (!(await columnExists('sales_orders', 'payment_terms'))) {
            await conn.query(
                `ALTER TABLE sales_orders ADD COLUMN payment_terms VARCHAR(100) NULL AFTER payment_method`
            );
        }

        await conn.commit();
        console.log('│  Migration 91 OK                                             │');
    } catch (error) {
        await conn.rollback();
        console.error('│  Migration 91 FAILED                                         │');
        throw error;
    } finally {
        conn.release();
    }
}
