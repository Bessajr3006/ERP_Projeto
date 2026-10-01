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

async function createFechamentosTable(): Promise<void> {
    logger.info('Creating fechamentos table...');
    await pool.query(`
        CREATE TABLE IF NOT EXISTS fechamentos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            public_id VARCHAR(50) NOT NULL UNIQUE,
            company_id INT NOT NULL,
            customer_id INT NOT NULL,
            competencia VARCHAR(7) NOT NULL,
            
            compra_valor DECIMAL(15,2) DEFAULT 0.00,
            compra_bs_icms DECIMAL(15,2) DEFAULT 0.00,
            compra_isento DECIMAL(15,2) DEFAULT 0.00,
            compra_outros DECIMAL(15,2) DEFAULT 0.00,
            compra_pis DECIMAL(15,2) DEFAULT 0.00,
            compra_cofins DECIMAL(15,2) DEFAULT 0.00,
            
            venda_valor DECIMAL(15,2) DEFAULT 0.00,
            venda_bs_icms DECIMAL(15,2) DEFAULT 0.00,
            venda_isento DECIMAL(15,2) DEFAULT 0.00,
            venda_outros DECIMAL(15,2) DEFAULT 0.00,
            venda_pis DECIMAL(15,2) DEFAULT 0.00,
            venda_cofins DECIMAL(15,2) DEFAULT 0.00,
            
            apuracao_icms DECIMAL(15,2) DEFAULT 0.00,
            apuracao_pis DECIMAL(15,2) DEFAULT 0.00,
            apuracao_cofins DECIMAL(15,2) DEFAULT 0.00,
            
            despesa_adm DECIMAL(15,2) DEFAULT 0.00,
            despesa_operacional DECIMAL(15,2) DEFAULT 0.00,
            despesa_folha DECIMAL(15,2) DEFAULT 0.00,
            despesa_cmv DECIMAL(15,2) DEFAULT 0.00,
            despesa_ir_aluguel DECIMAL(15,2) DEFAULT 0.00,
            
            imposto_irpj DECIMAL(15,2) DEFAULT 0.00,
            imposto_csll DECIMAL(15,2) DEFAULT 0.00,
            
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            
            CONSTRAINT fk_fechamentos_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
            CONSTRAINT fk_fechamentos_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
            UNIQUE KEY uq_company_customer_competencia (company_id, customer_id, competencia)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
}

async function seedFechamentoPermissions(): Promise<void> {
    logger.info('Seeding fechamento permissions...');
    const roles = ['admin', 'super_admin', 'admin_basic', 'financial', 'accountant'];
    for (const role of roles) {
        await pool.query(`
            INSERT INTO role_permissions (company_id, role, module, can_view)
            SELECT c.id, ?, 'fechamento', 1
            FROM companies c
            ON DUPLICATE KEY UPDATE 
                can_view = VALUES(can_view)
        `, [role]);
    }
}

export default async function runMigration120Fechamentos() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_120_fechamentos');

        if (!(await tableExists('fechamentos'))) {
            await createFechamentosTable();
        }

        if (await tableExists('role_permissions')) {
            await seedFechamentoPermissions();
        }

        const migrationVersion = 120;
        const migrationDescription = 'Create fechamentos table and seed permissions';
        await pool.query(
            `INSERT INTO schema_migrations (version, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE version=version`,
            [migrationVersion, migrationDescription]
        );

        logger.info('Migration run_migration_120_fechamentos finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_120_fechamentos');
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration120Fechamentos()
        .then(() => {
            logger.info('Migration 120 completed successfully');
            process.exit(0);
        })
        .catch((err) => {
            logger.error({ err }, 'Migration 120 execution failed');
            process.exit(1);
        });
}
