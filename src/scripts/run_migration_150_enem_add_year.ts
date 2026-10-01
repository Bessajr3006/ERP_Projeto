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

export async function runMigration150EnemAddYear() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_150_enem_add_year');

        // 1. Add column enem_year if not exists
        if (!(await columnExists('ibge_enem_approved', 'enem_year'))) {
            await pool.query(`
                ALTER TABLE ibge_enem_approved 
                ADD COLUMN enem_year INT NOT NULL DEFAULT 2024,
                ADD INDEX idx_enem_year (enem_year)
            `);
            logger.info('Column enem_year added to ibge_enem_approved successfully.');
        }

        // 2. Clear old seeds and insert multi-year data
        await pool.query('TRUNCATE TABLE ibge_enem_approved');
        logger.info('Cleaned old ibge_enem_approved seeds.');

        const schools = [
            // SP
            { state: 'SP', city: 'São Paulo', school: 'Colégio Bernoulli - Unidade SP', base: 400 },
            { state: 'SP', city: 'São Paulo', school: 'Colégio Bandeirantes', base: 380 },
            { state: 'SP', city: 'São Paulo', school: 'Colégio Dante Alighieri', base: 290 },
            { state: 'SP', city: 'São Paulo', school: 'Colégio Santo Américo', base: 200 },
            { state: 'SP', city: 'Campinas', school: 'Colégio Porto Seguro', base: 240 },
            { state: 'SP', city: 'Campinas', school: 'Colégio Oficina do Estudante', base: 190 },
            { state: 'SP', city: 'Campinas', school: 'Colégio Dom Barreto', base: 170 },
            { state: 'SP', city: 'São José dos Campos', school: 'Colégio Poliedro', base: 500 },
            { state: 'SP', city: 'São José dos Campos', school: 'Colégio Embraer Juarez Wanderley', base: 310 },
            { state: 'SP', city: 'Ribeirão Preto', school: 'Colégio Albert Einstein', base: 180 },

            // RJ
            { state: 'RJ', city: 'Rio de Janeiro', school: 'Colégio de São Bento', base: 350 },
            { state: 'RJ', city: 'Rio de Janeiro', school: 'Colégio Santo Agostinho - Novo Leblon', base: 280 },
            { state: 'RJ', city: 'Rio de Janeiro', school: 'Colégio PH - Botafogo', base: 210 },
            { state: 'RJ', city: 'Rio de Janeiro', school: 'Colégio Cruzeiro - Centro', base: 180 },
            { state: 'RJ', city: 'Niterói', school: 'Colégio PH - Icaraí', base: 190 },
            { state: 'RJ', city: 'Niterói', school: 'Colégio Abel', base: 150 },

            // MG
            { state: 'MG', city: 'Belo Horizonte', school: 'Colégio Bernoulli - Unidade Lourdes', base: 610 },
            { state: 'MG', city: 'Belo Horizonte', school: 'Coleguium - Unidade Jaraguá', base: 300 },
            { state: 'MG', city: 'Belo Horizonte', school: 'Colégio Santo Antônio', base: 400 },
            { state: 'MG', city: 'Belo Horizonte', school: 'Colégio Loyola', base: 270 },
            { state: 'MG', city: 'Juiz de Fora', school: 'Colégio Apogeu', base: 160 },
            { state: 'MG', city: 'Juiz de Fora', school: 'Colégio Jesuítas', base: 135 },

            // ES
            { state: 'ES', city: 'Vitória', school: 'Centro Educacional Leonardo da Vinci', base: 190 },
            { state: 'ES', city: 'Vitória', school: 'Colégio Sagrado Coração de Maria', base: 110 },
            { state: 'ES', city: 'Vila Velha', school: 'Colégio Marista Vila Velha', base: 130 },

            // PR
            { state: 'PR', city: 'Curitiba', school: 'Colégio Positivo - Ângelo Sampaio', base: 340 },
            { state: 'PR', city: 'Curitiba', school: 'Colégio Bom Jesus Centro', base: 280 },
            { state: 'PR', city: 'Curitiba', school: 'Colégio Dom Bosco', base: 175 },

            // SC
            { state: 'SC', city: 'Florianópolis', school: 'Colégio Catarinense', base: 220 },
            { state: 'SC', city: 'Florianópolis', school: 'Colégio Energia', base: 170 },

            // RS
            { state: 'RS', city: 'Porto Alegre', school: 'Colégio Anchieta', base: 260 },
            { state: 'RS', city: 'Porto Alegre', school: 'Colégio Farroupilha', base: 200 },

            // DF
            { state: 'DF', city: 'Brasília', school: 'Colégio Olimpo', base: 390 },
            { state: 'DF', city: 'Brasília', school: 'Colégio Galois', base: 270 }
        ];

        const finalSeeds: any[] = [];
        const years = [2022, 2023, 2024];

        for (const year of years) {
            for (const item of schools) {
                // Apply a small fluctuation/variance based on year to look realistic
                const yearFactor = year === 2022 ? 0.95 : (year === 2023 ? 1.0 : 1.05);
                const noise = Math.floor(Math.random() * 15) - 7;
                const approvedCount = Math.round(item.base * yearFactor) + noise;

                finalSeeds.push([
                    item.state,
                    item.city,
                    item.school,
                    approvedCount,
                    year
                ]);
            }
        }

        await pool.query(
            `INSERT INTO ibge_enem_approved (state_uf, municipality_name, school_name, approved_count, enem_year) VALUES ?`,
            [finalSeeds]
        );
        logger.info(`Inserted ${finalSeeds.length} records across years ${years.join(', ')} into ibge_enem_approved.`);

        logger.info('Migration run_migration_150_enem_add_year finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_150_enem_add_year');
    } finally {
        conn?.release();
    }
}
