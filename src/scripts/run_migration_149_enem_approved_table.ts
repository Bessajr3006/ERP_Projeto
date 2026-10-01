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

export async function runMigration149EnemApprovedTable() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_149_enem_approved_table');

        if (!(await tableExists('ibge_enem_approved'))) {
            await pool.query(`
                CREATE TABLE ibge_enem_approved (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    state_uf VARCHAR(2) NOT NULL,
                    municipality_name VARCHAR(255) NOT NULL,
                    school_name VARCHAR(255) NOT NULL,
                    approved_count INT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_state_uf (state_uf),
                    INDEX idx_municipality (municipality_name),
                    INDEX idx_school (school_name),
                    INDEX idx_approved_count (approved_count DESC)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            logger.info('Table ibge_enem_approved created successfully.');

            // Seed data
            const seedData = [
                // São Paulo
                ['SP', 'São Paulo', 'Colégio Bernoulli - Unidade SP', 412],
                ['SP', 'São Paulo', 'Colégio Bandeirantes', 389],
                ['SP', 'São Paulo', 'Colégio Dante Alighieri', 295],
                ['SP', 'São Paulo', 'Colégio Santo Américo', 210],
                ['SP', 'Campinas', 'Colégio Porto Seguro', 245],
                ['SP', 'Campinas', 'Colégio Oficina do Estudante', 198],
                ['SP', 'Campinas', 'Colégio Dom Barreto', 178],
                ['SP', 'São José dos Campos', 'Colégio Poliedro', 512],
                ['SP', 'São José dos Campos', 'Colégio Embraer Juarez Wanderley', 320],
                ['SP', 'Ribeirão Preto', 'Colégio Albert Einstein', 185],
                ['SP', 'Ribeirão Preto', 'Colégio Santa Úrsula', 142],

                // Rio de Janeiro
                ['RJ', 'Rio de Janeiro', 'Colégio de São Bento', 356],
                ['RJ', 'Rio de Janeiro', 'Colégio Santo Agostinho - Novo Leblon', 288],
                ['RJ', 'Rio de Janeiro', 'Colégio PH - Botafogo', 215],
                ['RJ', 'Rio de Janeiro', 'Colégio Cruzeiro - Centro', 189],
                ['RJ', 'Niterói', 'Colégio PH - Icaraí', 194],
                ['RJ', 'Niterói', 'Colégio Abel', 156],
                ['RJ', 'Petrópolis', 'Colégio ipiranga', 98],

                // Minas Gerais
                ['MG', 'Belo Horizonte', 'Colégio Bernoulli - Unidade Lourdes', 624],
                ['MG', 'Belo Horizonte', 'Coleguium - Unidade Jaraguá', 310],
                ['MG', 'Belo Horizonte', 'Colégio Santo Antônio', 415],
                ['MG', 'Belo Horizonte', 'Colégio Loyola', 280],
                ['MG', 'Juiz de Fora', 'Colégio Apogeu', 165],
                ['MG', 'Juiz de Fora', 'Colégio Jesuítas', 142],
                ['MG', 'Uberlândia', 'Colégio Nacional', 210],
                ['MG', 'Uberlândia', 'Colégio Gabarito', 188],

                // Espírito Santo
                ['ES', 'Vitória', 'Centro Educacional Leonardo da Vinci', 195],
                ['ES', 'Vitória', 'Colégio Sagrado Coração de Maria', 112],
                ['ES', 'Vila Velha', 'Colégio Marista Vila Velha', 134],

                // Paraná
                ['PR', 'Curitiba', 'Colégio Positivo - Ângelo Sampaio', 345],
                ['PR', 'Curitiba', 'Colégio Bom Jesus Centro', 290],
                ['PR', 'Curitiba', 'Colégio Dom Bosco', 180],
                ['PR', 'Londrina', 'Colégio Universitário de Londrina', 167],

                // Santa Catarina
                ['SC', 'Florianópolis', 'Colégio Catarinense', 224],
                ['SC', 'Florianópolis', 'Colégio Energia', 178],
                ['SC', 'Joinville', 'Colégio Bom Jesus Ielusc', 145],

                // Rio Grande do Sul
                ['RS', 'Porto Alegre', 'Colégio Anchieta', 265],
                ['RS', 'Porto Alegre', 'Colégio Farroupilha', 210],
                ['RS', 'Porto Alegre', 'Colégio Militar de Porto Alegre', 198],

                // Distrito Federal
                ['DF', 'Brasília', 'Colégio Olimpo', 398],
                ['DF', 'Brasília', 'Colégio Galois', 276],
                ['DF', 'Brasília', 'Colégio Militar de Brasília', 245]
            ];

            await pool.query(
                `INSERT INTO ibge_enem_approved (state_uf, municipality_name, school_name, approved_count) VALUES ?`,
                [seedData]
            );
            logger.info('Seed data for ibge_enem_approved inserted successfully.');
        }

        logger.info('Migration run_migration_149_enem_approved_table finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_149_enem_approved_table');
    } finally {
        conn?.release();
    }
}
