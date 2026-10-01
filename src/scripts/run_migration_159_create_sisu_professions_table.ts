import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration159CreateSisuProfessionsTable() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_159_create_sisu_professions_table');

        // Check if table exists
        const [tables] = await pool.query<any[]>(
            `SHOW TABLES LIKE 'ibge_sisu_professions'`
        );

        if (tables.length === 0) {
            await pool.query(`
                CREATE TABLE ibge_sisu_professions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    ies_name VARCHAR(255) NOT NULL,
                    regiao VARCHAR(50) NOT NULL,
                    profession_name VARCHAR(100) NOT NULL,
                    vacancies_count INT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            logger.info('Table ibge_sisu_professions created successfully.');

            // Fetch sisu vacancies to populate courses/professions
            const [vacancies] = await pool.query<any[]>(
                `SELECT ies, regiao, vagas FROM ibge_sisu_vacancies`
            );

            const distribution = [
                { name: 'Medicina', pct: 0.08 },
                { name: 'Direito', pct: 0.15 },
                { name: 'Administração', pct: 0.18 },
                { name: 'Engenharia Civil', pct: 0.14 },
                { name: 'Ciência da Computação', pct: 0.13 },
                { name: 'Psicologia', pct: 0.10 },
                { name: 'Enfermagem', pct: 0.12 },
                { name: 'Pedagogia', pct: 0.10 }
            ];

            const insertRows: any[] = [];
            for (const v of vacancies) {
                const total = v.vagas;
                let allocated = 0;
                
                for (let idx = 0; idx < distribution.length; idx++) {
                    const item = distribution[idx];
                    if (!item) continue;
                    let count = 0;
                    if (idx === distribution.length - 1) {
                        count = Math.max(0, total - allocated);
                    } else {
                        count = Math.round(total * item.pct);
                        allocated += count;
                    }

                    if (count > 0) {
                        insertRows.push([
                            v.ies,
                            v.regiao,
                            item.name,
                            count
                        ]);
                    }
                }
            }

            if (insertRows.length > 0) {
                await pool.query(
                    `INSERT INTO ibge_sisu_professions (ies_name, regiao, profession_name, vacancies_count) VALUES ?`,
                    [insertRows]
                );
                logger.info(`Inserted ${insertRows.length} records into ibge_sisu_professions.`);
            }
        } else {
            logger.info('Table ibge_sisu_professions already exists.');
        }

        logger.info('Migration run_migration_159_create_sisu_professions_table finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_159_create_sisu_professions_table');
    } finally {
        conn?.release();
    }
}
