import pool from '../config/db';
import logger from '../config/logger';

async function tableExists(tableName: string): Promise<boolean> {
    const [rows] = await pool.query<any[]>(
        `SELECT COUNT(*) AS count
         FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?`,
        [tableName]
    );
    return Array.isArray(rows) && rows[0] && Number(rows[0].count) > 0;
}

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
    const [rows] = await pool.query<any[]>(
        `SELECT COUNT(*) AS count
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?`,
        [tableName, columnName]
    );
    return Array.isArray(rows) && rows[0] && Number(rows[0].count) > 0;
}

export async function runMigration100DentalOdontogram(): Promise<void> {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_100_dental_odontogram');

        // 1. Table dental_charts
        await conn.query(`
            CREATE TABLE IF NOT EXISTS dental_charts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                public_id CHAR(36) NOT NULL UNIQUE,
                company_id INT NOT NULL,
                customer_id INT NOT NULL,
                dentition ENUM('permanent', 'deciduous', 'mixed') NOT NULL DEFAULT 'permanent',
                notes TEXT DEFAULT NULL,
                is_deleted TINYINT(1) NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
                UNIQUE KEY uk_dental_charts_company_customer (company_id, customer_id),
                INDEX idx_dental_charts_company (company_id),
                INDEX idx_dental_charts_customer (customer_id),
                INDEX idx_dental_charts_public_id (public_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 2. Table dental_chart_teeth
        await conn.query(`
            CREATE TABLE IF NOT EXISTS dental_chart_teeth (
                id INT AUTO_INCREMENT PRIMARY KEY,
                public_id CHAR(36) NOT NULL UNIQUE,
                company_id INT NOT NULL,
                chart_id INT NOT NULL,
                tooth_code TINYINT NOT NULL,
                \`condition\` ENUM('present', 'absent', 'extracted', 'implant', 'unerupted', 'retained') NOT NULL DEFAULT 'present',
                notes TEXT DEFAULT NULL,
                is_deleted TINYINT(1) NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (chart_id) REFERENCES dental_charts(id) ON DELETE CASCADE,
                UNIQUE KEY uk_dental_chart_teeth_chart_tooth (chart_id, tooth_code),
                INDEX idx_dental_chart_teeth_company (company_id),
                INDEX idx_dental_chart_teeth_chart (chart_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 3. Table dental_procedures
        await conn.query(`
            CREATE TABLE IF NOT EXISTS dental_procedures (
                id INT AUTO_INCREMENT PRIMARY KEY,
                public_id CHAR(36) NOT NULL UNIQUE,
                company_id INT NOT NULL,
                chart_id INT NOT NULL,
                customer_id INT NOT NULL,
                tooth_code TINYINT DEFAULT NULL,
                region ENUM('tooth', 'upper_arch', 'lower_arch', 'quadrant', 'mouth') NOT NULL DEFAULT 'tooth',
                faces SET('M', 'D', 'O', 'I', 'V', 'L', 'P') DEFAULT NULL,
                service_id INT DEFAULT NULL,
                unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                status ENUM('existing', 'planned', 'quoted', 'approved', 'done', 'cancelled') NOT NULL DEFAULT 'planned',
                sales_order_id INT DEFAULT NULL,
                sales_item_id INT DEFAULT NULL,
                professional_user_id INT DEFAULT NULL,
                planned_at DATETIME DEFAULT NULL,
                performed_at DATETIME DEFAULT NULL,
                notes TEXT DEFAULT NULL,
                created_by_user_id INT DEFAULT NULL,
                is_deleted TINYINT(1) NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (chart_id) REFERENCES dental_charts(id) ON DELETE CASCADE,
                FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
                FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL,
                FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE SET NULL,
                FOREIGN KEY (sales_item_id) REFERENCES sales_items(id) ON DELETE SET NULL,
                FOREIGN KEY (professional_user_id) REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
                INDEX idx_dental_proc_company (company_id),
                INDEX idx_dental_proc_chart (chart_id),
                INDEX idx_dental_proc_customer (customer_id),
                INDEX idx_dental_proc_status (status),
                INDEX idx_dental_proc_sales_order (sales_order_id),
                INDEX idx_dental_proc_sales_item (sales_item_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 4. ALTER sales_items.description VARCHAR(255) NULL
        if (await tableExists('sales_items')) {
            const hasDesc = await columnExists('sales_items', 'description');
            if (!hasDesc) {
                await conn.query(`
                    ALTER TABLE sales_items
                    ADD COLUMN description VARCHAR(255) NULL DEFAULT NULL AFTER service_id;
                `);
                logger.info('[OK] Added description column to sales_items');
            }
        }

        // 5. ALTER transactions.installment_number and installment_count
        if (await tableExists('transactions')) {
            const hasInstNum = await columnExists('transactions', 'installment_number');
            if (!hasInstNum) {
                await conn.query(`
                    ALTER TABLE transactions
                    ADD COLUMN installment_number INT NULL DEFAULT NULL AFTER payment_method;
                `);
                logger.info('[OK] Added installment_number column to transactions');
            }

            const hasInstCount = await columnExists('transactions', 'installment_count');
            if (!hasInstCount) {
                await conn.query(`
                    ALTER TABLE transactions
                    ADD COLUMN installment_count INT NULL DEFAULT NULL AFTER installment_number;
                `);
                logger.info('[OK] Added installment_count column to transactions');
            }
        }

        logger.info('Migration run_migration_100_dental_odontogram finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_100_dental_odontogram');
        throw err;
    } finally {
        conn?.release();
    }
}

export default runMigration100DentalOdontogram;

if (require.main === module) {
    runMigration100DentalOdontogram()
        .catch((err) => {
            logger.error({ err }, 'Migration 100 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
