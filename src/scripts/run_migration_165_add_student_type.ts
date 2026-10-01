import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration165AddStudentType() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_165_add_student_type');

        // Check if student_type column exists
        const [columns] = await pool.query<any[]>(
            `SHOW COLUMNS FROM ibge_enem_students LIKE 'student_type'`
        );

        if (columns.length === 0) {
            await pool.query(`
                ALTER TABLE ibge_enem_students 
                ADD COLUMN student_type VARCHAR(50) NOT NULL DEFAULT 'regular',
                ADD INDEX idx_student_type (student_type)
            `);
            logger.info('Column student_type added to ibge_enem_students.');
        }

        // Clear table to regenerate all records with the correct types
        await pool.query(`DELETE FROM ibge_enem_students`);
        logger.info('Table ibge_enem_students cleared for clean regeneration.');
    } catch (error) {
        logger.error({ err: error }, 'Error in runMigration165AddStudentType');
        throw error;
    } finally {
        if (conn) conn.release();
    }
}
