import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration156EnemAddBabylandiaNiteroi() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_156_enem_add_babylandia_niteroi');

        const years = [2022, 2023, 2024, 2025];
        const newSeeds: any[] = [];

        for (const year of years) {
            const yearFactor = year === 2022 ? 0.95 : (year === 2023 ? 1.0 : (year === 2024 ? 1.05 : 1.10));
            const noise = Math.floor(Math.random() * 10) - 5;
            const approvedCount = Math.round(115 * yearFactor) + noise;
            const registeredCount = Math.round(approvedCount * (1.2 + Math.random() * 0.4));

            // Check if already exists
            const [existing] = await pool.query<any[]>(
                `SELECT id FROM ibge_enem_approved WHERE state_uf = ? AND municipality_name = ? AND school_name = ? AND enem_year = ?`,
                ['RJ', 'Niterói', 'Colégio Babylandia Atuação', year]
            );

            if (existing.length === 0) {
                newSeeds.push([
                    'RJ',
                    'Niterói',
                    'Colégio Babylandia Atuação',
                    approvedCount,
                    registeredCount,
                    year
                ]);
            }
        }

        if (newSeeds.length > 0) {
            await pool.query(
                `INSERT INTO ibge_enem_approved (state_uf, municipality_name, school_name, approved_count, registered_count, enem_year) VALUES ?`,
                [newSeeds]
            );
            logger.info(`Inserted Babylandia Atuação for Niterói for years 2022-2025.`);
        } else {
            logger.info('Babylandia Atuação already seeded.');
        }

        logger.info('Migration run_migration_156_enem_add_babylandia_niteroi finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_156_enem_add_babylandia_niteroi');
    } finally {
        conn?.release();
    }
}
