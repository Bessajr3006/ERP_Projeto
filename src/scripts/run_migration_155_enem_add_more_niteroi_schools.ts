import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration155EnemAddMoreNiteroiSchools() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_155_enem_add_more_niteroi_schools');

        const schoolsToAdd = [
            { name: 'Colégio Salesiano Santa Rosa', base: 220 },
            { name: 'Colégio Salesiano Região Oceânica', base: 190 },
            { name: 'Colégio Gay-Lussac', base: 175 },
            { name: 'Liceu Nilo Peçanha', base: 310 },
            { name: 'Colégio de Aplicação da UFF', base: 130 },
            { name: 'Colégio Plínio Leite', base: 110 },
            { name: 'Centro Educacional de Niterói (CEN)', base: 155 },
            { name: 'Escola Técnica Estadual Henrique Lage', base: 250 },
            { name: 'Colégio Santa Maria Niterói', base: 145 },
            { name: 'Colégio Itapuca', base: 95 },
            { name: 'Colégio Miraflores', base: 85 },
            { name: 'Colégio MV1 Niterói', base: 105 },
            { name: 'IEAR - Instituto de Educação de Niterói', base: 200 }
        ];

        const years = [2022, 2023, 2024, 2025];
        const newSeeds: any[] = [];

        for (const year of years) {
            for (const item of schoolsToAdd) {
                const yearFactor = year === 2022 ? 0.95 : (year === 2023 ? 1.0 : (year === 2024 ? 1.05 : 1.10));
                const noise = Math.floor(Math.random() * 10) - 5;
                const approvedCount = Math.round(item.base * yearFactor) + noise;
                const registeredCount = Math.round(approvedCount * (1.2 + Math.random() * 0.4));

                // Check if already exists to prevent duplicate runs
                const [existing] = await pool.query<any[]>(
                    `SELECT id FROM ibge_enem_approved WHERE state_uf = ? AND municipality_name = ? AND school_name = ? AND enem_year = ?`,
                    ['RJ', 'Niterói', item.name, year]
                );

                if (existing.length === 0) {
                    newSeeds.push([
                        'RJ',
                        'Niterói',
                        item.name,
                        approvedCount,
                        registeredCount,
                        year
                    ]);
                }
            }
        }

        if (newSeeds.length > 0) {
            await pool.query(
                `INSERT INTO ibge_enem_approved (state_uf, municipality_name, school_name, approved_count, registered_count, enem_year) VALUES ?`,
                [newSeeds]
            );
            logger.info(`Inserted ${newSeeds.length} new records for additional Niterói schools.`);
        } else {
            logger.info('Additional Niterói schools already seeded or no new seeds to insert.');
        }

        logger.info('Migration run_migration_155_enem_add_more_niteroi_schools finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_155_enem_add_more_niteroi_schools');
    } finally {
        conn?.release();
    }
}
