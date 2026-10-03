import pool from '../config/db';
import logger from '../config/logger';

/**
 * Migration 100 - Odontograma
 *  - dental_charts: um odontograma por paciente (customer)
 *  - dental_chart_teeth: condição de cada dente (numeração FDI)
 *  - dental_procedures: procedimentos (existentes/planejados/orçados/aprovados/realizados)
 *  - sales_items.description: descrição livre do item (ex.: "Dente 16 – faces M/O")
 *  - transactions.installment_number / installment_count: parcelamento de receitas
 *
 * Script idempotente: pode ser executado várias vezes.
 */

async function columnExists(conn: any, tableName: string, columnName: string): Promise<boolean> {
    const [rows] = await conn.query(
        `SELECT COUNT(*) AS count
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [tableName, columnName]
    );
    return Array.isArray(rows) && rows[0] && Number(rows[0].count) > 0;
}

async function tableExists(conn: any, tableName: string): Promise<boolean> {
    const [rows] = await conn.query(
        `SELECT COUNT(*) AS count
         FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [tableName]
    );
    return Array.isArray(rows) && rows[0] && Number(rows[0].count) > 0;
}

export default async function runMigration100DentalCharts() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_100_dental_charts');

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
                CONSTRAINT fk_dental_charts_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                CONSTRAINT fk_dental_charts_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
                UNIQUE KEY uk_dental_charts_company_customer (company_id, customer_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS dental_chart_teeth (
                id INT AUTO_INCREMENT PRIMARY KEY,
                public_id CHAR(36) NOT NULL UNIQUE,
                company_id INT NOT NULL,
                chart_id INT NOT NULL,
                tooth_code TINYINT UNSIGNED NOT NULL COMMENT 'Numeração FDI (11-48 permanentes, 51-85 decíduos)',
                \`condition\` ENUM('present', 'absent', 'extracted', 'implant', 'unerupted', 'retained') NOT NULL DEFAULT 'present',
                notes TEXT DEFAULT NULL,
                is_deleted TINYINT(1) NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_dental_chart_teeth_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                CONSTRAINT fk_dental_chart_teeth_chart FOREIGN KEY (chart_id) REFERENCES dental_charts(id) ON DELETE CASCADE,
                UNIQUE KEY uk_dental_chart_teeth_chart_tooth (chart_id, tooth_code)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS dental_procedures (
                id INT AUTO_INCREMENT PRIMARY KEY,
                public_id CHAR(36) NOT NULL UNIQUE,
                company_id INT NOT NULL,
                chart_id INT NOT NULL,
                customer_id INT NOT NULL,
                tooth_code TINYINT UNSIGNED DEFAULT NULL,
                region ENUM('tooth', 'upper_arch', 'lower_arch', 'quadrant', 'mouth') NOT NULL DEFAULT 'tooth',
                faces SET('M', 'D', 'O', 'I', 'V', 'L', 'P') DEFAULT NULL,
                service_id INT DEFAULT NULL,
                unit_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                status ENUM('existing', 'planned', 'quoted', 'approved', 'done', 'cancelled') NOT NULL DEFAULT 'planned',
                sales_order_id INT DEFAULT NULL,
                sales_item_id INT DEFAULT NULL,
                professional_user_id INT DEFAULT NULL,
                planned_at DATE DEFAULT NULL,
                performed_at DATETIME DEFAULT NULL,
                notes TEXT DEFAULT NULL,
                created_by_user_id INT DEFAULT NULL,
                is_deleted TINYINT(1) NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_dental_procedures_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                CONSTRAINT fk_dental_procedures_chart FOREIGN KEY (chart_id) REFERENCES dental_charts(id) ON DELETE CASCADE,
                CONSTRAINT fk_dental_procedures_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
                CONSTRAINT fk_dental_procedures_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT,
                CONSTRAINT fk_dental_procedures_sales_order FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE SET NULL,
                CONSTRAINT fk_dental_procedures_sales_item FOREIGN KEY (sales_item_id) REFERENCES sales_items(id) ON DELETE SET NULL,
                CONSTRAINT fk_dental_procedures_professional FOREIGN KEY (professional_user_id) REFERENCES users(id) ON DELETE SET NULL,
                CONSTRAINT fk_dental_procedures_created_by FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
                INDEX idx_dental_procedures_chart (company_id, chart_id, is_deleted),
                INDEX idx_dental_procedures_customer (company_id, customer_id),
                INDEX idx_dental_procedures_status (company_id, status),
                INDEX idx_dental_procedures_sales_order (sales_order_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        if ((await tableExists(conn, 'sales_items')) && !(await columnExists(conn, 'sales_items', 'description'))) {
            await conn.query('ALTER TABLE sales_items ADD COLUMN description VARCHAR(255) NULL DEFAULT NULL');
        }

        if (await tableExists(conn, 'transactions')) {
            if (!(await columnExists(conn, 'transactions', 'installment_number'))) {
                await conn.query('ALTER TABLE transactions ADD COLUMN installment_number INT NULL DEFAULT NULL');
            }
            if (!(await columnExists(conn, 'transactions', 'installment_count'))) {
                await conn.query('ALTER TABLE transactions ADD COLUMN installment_count INT NULL DEFAULT NULL');
            }
        }

        logger.info('Migration run_migration_100_dental_charts finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_100_dental_charts');
        throw err;
    } finally {
        if (conn) conn.release();
    }
}

if (require.main === module) {
    runMigration100DentalCharts()
        .catch((err) => {
            logger.error({ err }, 'Migration 100 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
