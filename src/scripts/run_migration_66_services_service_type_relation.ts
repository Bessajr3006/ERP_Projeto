import pool from '../config/db';
import logger from '../config/logger';

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

async function indexExists(tableName: string, indexName: string): Promise<boolean> {
    const [rows] = await pool.query<any[]>(
        `SELECT COUNT(*) AS count
         FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND INDEX_NAME = ?`,
        [tableName, indexName]
    );
    return Array.isArray(rows) && rows[0] && Number(rows[0].count) > 0;
}

async function foreignKeyExists(tableName: string, fkName: string): Promise<boolean> {
    const [rows] = await pool.query<any[]>(
        `SELECT COUNT(*) AS count
         FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
         WHERE CONSTRAINT_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND CONSTRAINT_NAME = ?
           AND CONSTRAINT_TYPE = 'FOREIGN KEY'`,
        [tableName, fkName]
    );
    return Array.isArray(rows) && rows[0] && Number(rows[0].count) > 0;
}

export default async function runMigration66ServicesServiceTypeRelation() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_66_services_service_type_relation');

        const hasServiceTypeId = await columnExists('services', 'service_type_id');
        if (!hasServiceTypeId) {
            await conn.query(`
                ALTER TABLE services
                    ADD COLUMN service_type_id INT DEFAULT NULL AFTER description
            `);
        }

        const hasCompanyTypeIndex = await indexExists('services', 'idx_services_company_type');
        if (!hasCompanyTypeIndex) {
            await conn.query(`
                ALTER TABLE services
                    ADD INDEX idx_services_company_type (company_id, service_type_id)
            `);
        }

        const hasServiceTypeFk = await foreignKeyExists('services', 'fk_services_service_type');
        if (!hasServiceTypeFk) {
            await conn.query(`
                ALTER TABLE services
                    ADD CONSTRAINT fk_services_service_type
                    FOREIGN KEY (service_type_id)
                    REFERENCES service_types(id)
                    ON DELETE SET NULL
            `);
        }

        logger.info('Migration run_migration_66_services_service_type_relation finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_66_services_service_type_relation');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration66ServicesServiceTypeRelation()
        .catch((err) => {
            logger.error({ err }, 'Migration 66 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
