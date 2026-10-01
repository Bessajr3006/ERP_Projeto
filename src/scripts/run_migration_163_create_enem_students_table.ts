import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration163CreateEnemStudentsTable() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_163_create_enem_students_table');

        // Check if table exists
        const [tables] = await pool.query<any[]>(
            `SHOW TABLES LIKE 'ibge_enem_students'`
        );

        if (tables.length === 0) {
            await pool.query(`
                CREATE TABLE ibge_enem_students (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    school_id INT NOT NULL,
                    student_name VARCHAR(255) NOT NULL,
                    score DECIMAL(5, 2) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT fk_enem_students_school FOREIGN KEY (school_id) REFERENCES ibge_enem_approved (id) ON DELETE CASCADE,
                    INDEX idx_school_id (school_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            logger.info('Table ibge_enem_students created successfully.');

            // Fetch all schools
            const [schools] = await pool.query<any[]>(
                `SELECT id, school_name, average_score FROM ibge_enem_approved`
            );

            logger.info(`Seeding students for ${schools.length} schools...`);

            const firstNames = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elena', 'Felipe', 'Gabriela', 'Hugo', 'Isabela', 'João', 'Kamila', 'Lucas', 'Mariana', 'Natan', 'Olivia', 'Pedro', 'Renata', 'Samuel', 'Tatiana', 'Victor'];
            const lastNames = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Almeida', 'Lopes', 'Soares', 'Dias', 'Vieira', 'Rocha'];

            const studentsBatch: [number, string, number][] = [];

            for (const sch of schools) {
                const schoolId = sch.id;
                const baseScore = sch.average_score ? parseFloat(sch.average_score) : 650;
                
                // Seed 5 students per school
                for (let i = 0; i < 5; i++) {
                    const fn = firstNames[(schoolId * 7 + i * 3) % firstNames.length];
                    const ln = lastNames[(schoolId * 9 + i * 11) % lastNames.length];
                    const fullName = `${fn} ${ln}`;
                    
                    // Generate realistic student score based on school average
                    const score = Math.max(350, Math.min(1000, Math.round((baseScore + (Math.random() * 160 - 80)) * 100) / 100));
                    
                    studentsBatch.push([schoolId, fullName, score]);
                }
            }

            if (studentsBatch.length > 0) {
                await pool.query(
                    `INSERT INTO ibge_enem_students (school_id, student_name, score) VALUES ?`,
                    [studentsBatch]
                );
                logger.info(`Successfully seeded ${studentsBatch.length} student records.`);
            }
        } else {
            logger.info('Table ibge_enem_students already exists.');
        }

        logger.info('Migration run_migration_163_create_enem_students_table finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_163_create_enem_students_table');
    } finally {
        conn?.release();
    }
}
