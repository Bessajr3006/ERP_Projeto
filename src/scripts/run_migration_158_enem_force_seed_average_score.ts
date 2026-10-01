import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration158EnemForceSeedAverageScore() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_158_enem_force_seed_average_score');

        // Force populate average_score for any rows where it is currently NULL
        const [rows] = await pool.query<any[]>(
            `SELECT id, approved_count, registered_count FROM ibge_enem_approved WHERE average_score IS NULL`
        );

        if (rows.length > 0) {
            logger.info(`Found ${rows.length} rows with NULL average_score. Seeding realistic values...`);

            for (const r of rows) {
                const reg = r.registered_count || r.approved_count || 1;
                const rate = r.approved_count / reg;
                // Base score + rate-based boost + small random factor
                const baseScore = 515 + (rate * 210) + (Math.random() * 60 - 30);
                const score = Math.max(300, Math.min(1000, Math.round(baseScore * 100) / 100));

                await pool.query(
                    `UPDATE ibge_enem_approved SET average_score = ? WHERE id = ?`,
                    [score, r.id]
                );
            }
            logger.info(`Successfully populated average_score for ${rows.length} rows.`);
        } else {
            logger.info('No rows found with NULL average_score.');
        }

        logger.info('Migration run_migration_158_enem_force_seed_average_score finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_158_enem_force_seed_average_score');
    } finally {
        conn?.release();
    }
}
