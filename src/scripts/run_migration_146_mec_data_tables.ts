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

export async function runMigration146MecDataTables() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_146_mec_data_tables');

        // 1. Create table ibge_mec_literacy
        if (!(await tableExists('ibge_mec_literacy'))) {
            await pool.query(`
                CREATE TABLE ibge_mec_literacy (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    municipality_id VARCHAR(10) UNIQUE NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    state_uf VARCHAR(2) NOT NULL,
                    literacy_rate DECIMAL(5, 2) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_state_uf (state_uf),
                    INDEX idx_rate (literacy_rate DESC)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            logger.info('Table ibge_mec_literacy created successfully.');
        }

        // 2. Create table ibge_sisu_vacancies
        if (!(await tableExists('ibge_sisu_vacancies'))) {
            await pool.query(`
                CREATE TABLE ibge_sisu_vacancies (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    ies VARCHAR(255) NOT NULL,
                    regiao VARCHAR(100) NOT NULL,
                    vagas INT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_regiao (regiao),
                    INDEX idx_vagas (vagas DESC)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            logger.info('Table ibge_sisu_vacancies created successfully.');

            // Seed sisu vacancies data
            const sisuSeed = [
                // Sudeste
                ['UFRJ', 'Sudeste', 9110],
                ['UFF', 'Sudeste', 7420],
                ['UFMG', 'Sudeste', 6309],
                ['UFRRJ', 'Sudeste', 4150],
                ['UFV', 'Sudeste', 3250],
                ['UFU', 'Sudeste', 3180],
                ['UNIFESP', 'Sudeste', 3120],
                ['UFSCar', 'Sudeste', 2890],
                ['UFES', 'Sudeste', 2776],
                ['UNIRIO', 'Sudeste', 2516],
                ['UFJF', 'Sudeste', 2280],
                // Nordeste
                ['UFPB', 'Nordeste', 7850],
                ['UFRN', 'Nordeste', 6890],
                ['UFC', 'Nordeste', 6288],
                ['UFPE', 'Nordeste', 5522],
                ['UFS', 'Nordeste', 5120],
                ['UFMA', 'Nordeste', 4890],
                ['UFBA', 'Nordeste', 4580],
                ['UFPI', 'Nordeste', 3200],
                ['UFAL', 'Nordeste', 2900],
                // Sul
                ['UFSM', 'Sul', 3100],
                ['UFPel', 'Sul', 2800],
                ['UFRGS', 'Sul', 2560],
                ['FURG', 'Sul', 2300],
                ['UFSC', 'Sul', 1890],
                ['UFPR', 'Sul', 1540],
                // Centro-Oeste
                ['UFMT', 'Centro-Oeste', 4920],
                ['UFG', 'Centro-Oeste', 4300],
                ['UnB', 'Centro-Oeste', 2110],
                ['UFMS', 'Centro-Oeste', 2000],
                ['IFG', 'Centro-Oeste', 1200],
                // Norte
                ['UFAM', 'Norte', 2720],
                ['UFPA', 'Norte', 1250],
                ['UNIR', 'Norte', 1100],
                ['UFRR', 'Norte', 800],
                ['UNIFAP', 'Norte', 710]
            ];

            await pool.query(
                `INSERT INTO ibge_sisu_vacancies (ies, regiao, vagas) VALUES ?`,
                [sisuSeed]
            );
            logger.info('SISU vacancies seed data inserted successfully.');
        }

        logger.info('Migration run_migration_146_mec_data_tables finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_146_mec_data_tables');
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration146MecDataTables()
        .catch((err) => {
            logger.error({ err }, 'Migration 146 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
