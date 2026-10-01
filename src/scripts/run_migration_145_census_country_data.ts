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

export async function runMigration145CensusCountryData() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_145_census_country_data');

        if (!(await tableExists('ibge_census_income'))) {
            await pool.query(`
                CREATE TABLE ibge_census_income (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    municipality_id VARCHAR(10) UNIQUE NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    state_uf VARCHAR(2) NOT NULL,
                    income_per_capita DECIMAL(10, 2) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_state_uf (state_uf),
                    INDEX idx_income (income_per_capita DESC)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            logger.info('Table ibge_census_income created successfully.');
        } else {
            logger.info('Table ibge_census_income already exists.');
        }

        logger.info('Migration run_migration_145_census_country_data finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_145_census_country_data');
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration145CensusCountryData()
        .catch((err) => {
            logger.error({ err }, 'Migration 145 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
