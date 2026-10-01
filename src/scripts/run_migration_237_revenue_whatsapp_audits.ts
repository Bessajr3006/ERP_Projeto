import pool from '../config/db';

export async function runMigration237RevenueWhatsappAudits(): Promise<void> {
    console.log('│  Migration 237: Create revenue_whatsapp_audits table       │');
    
    const query = `
        CREATE TABLE IF NOT EXISTS revenue_whatsapp_audits (
            id INT AUTO_INCREMENT PRIMARY KEY,
            public_id CHAR(36) NOT NULL UNIQUE,
            company_id INT NOT NULL,
            transaction_id INT NOT NULL,
            transaction_public_id VARCHAR(100) NOT NULL,
            user_id INT NULL,
            user_name VARCHAR(150) NULL,
            recipient_phone VARCHAR(30) NOT NULL,
            recipient_name VARCHAR(255) NULL,
            billing_type VARCHAR(50) NOT NULL DEFAULT 'boleto',
            status ENUM('success', 'failed', 'pending') NOT NULL DEFAULT 'success',
            error_message TEXT NULL,
            message_text MEDIUMTEXT NULL,
            media_file_name VARCHAR(255) NULL,
            media_url VARCHAR(500) NULL,
            is_automatic TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = Disparo automático pelo sistema, 0 = Manual',
            whatsapp_message_id VARCHAR(255) NULL,
            raw_response LONGTEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_rwa_company_created (company_id, created_at),
            INDEX idx_rwa_company_tx (company_id, transaction_id),
            INDEX idx_rwa_company_txpub (company_id, transaction_public_id),
            INDEX idx_rwa_phone (recipient_phone),
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await pool.query(query);
    console.log('│  Migration 237: Completed successfully!                     │');
}

if (require.main === module) {
    runMigration237RevenueWhatsappAudits()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error('Migration failed:', err);
            process.exit(1);
        });
}
