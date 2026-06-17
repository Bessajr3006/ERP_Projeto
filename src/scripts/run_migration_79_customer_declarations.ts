import 'dotenv/config';
import pool from '../config/db';
import logger from '../config/logger';

export default async function runMigration79() {
    try {
        const conn = await pool.getConnection();

        logger.info('Starting migration: 79 - Create customer_declarations table');

        try {
            await conn.query(`
                CREATE TABLE IF NOT EXISTS customer_declarations (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    public_id VARCHAR(36) NOT NULL UNIQUE,
                    company_id INT NOT NULL,
                    customer_id INT NOT NULL,
                    competence_month INT NOT NULL,
                    competence_year INT NOT NULL,
                    declaration_type VARCHAR(100) NOT NULL,
                    status ENUM('PENDENTE', 'ENTREGUE', 'SEM_MOVIMENTO', 'NAO_SE_APLICA') NOT NULL DEFAULT 'PENDENTE',
                    delivery_date DATE NULL,
                    receipt_url VARCHAR(255) NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
                    CONSTRAINT fk_customer_declarations_company
                        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                    CONSTRAINT fk_customer_declarations_customer
                        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
                    UNIQUE KEY customer_declarations_unique_entry (company_id, customer_id, competence_month, competence_year, declaration_type)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);
            logger.info('Created customer_declarations table.');

            const migrationName = '79_customer_declarations';
            await conn.query(
                `INSERT INTO schema_migrations (version) VALUES (?) ON DUPLICATE KEY UPDATE version=version`,
                [migrationName]
            );

        } finally {
            conn.release();
        }

        logger.info('Migration 79 finished successfully.');
    } catch (error) {
        logger.error('Error running migration 79: ' + (error instanceof Error ? error.message : String(error)));
        throw error;
    }
}

// Executar se for chamado diretamente
if (require.main === module) {
    runMigration79().then(() => process.exit(0)).catch(() => process.exit(1));
}
