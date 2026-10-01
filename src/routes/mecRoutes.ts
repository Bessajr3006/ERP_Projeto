import { Router, Request, Response } from 'express';
import { protectRoute } from '../middlewares/authMiddleware';
import pool from '../config/db';
import logger from '../config/logger';
import { MecLoaderService } from '../services/mecLoaderService';

const router = Router();

// Auto-trigger sync in background when route loads (will only sync if DB table is empty)
MecLoaderService.triggerLoad().catch((err) => {
    logger.error({ err }, 'Failed to trigger initial MEC literacy sync on startup');
});

// GET /api/v1/mec/status - Get literacy sync status
router.get('/status', protectRoute, (_req: Request, res: Response) => {
    res.json({ status: 'success', data: MecLoaderService.getStatus() });
});

// POST /api/v1/mec/sync - Force database sync
router.post('/sync', protectRoute, async (_req: Request, res: Response) => {
    try {
        await MecLoaderService.triggerLoad(true);
        res.json({ status: 'success', message: 'Sincronização iniciada com sucesso em segundo plano.' });
    } catch (error: any) {
        res.status(500).json({ status: 'error', message: error?.message || 'Falha ao forçar sincronização.' });
    }
});

// GET /api/v1/mec/literacy - Query literacy data from local database
router.get('/literacy', protectRoute, async (req: Request, res: Response) => {
    try {
        const state = req.query.state ? String(req.query.state).toUpperCase().trim() : '';
        const search = req.query.search ? String(req.query.search).trim() : '';

        // If table is completely empty, trigger load and return empty list
        const [countRows] = await pool.query<any[]>(`SELECT COUNT(*) as count FROM ibge_mec_literacy`);
        const totalInDb = countRows[0]?.count || 0;

        if (totalInDb === 0) {
            await MecLoaderService.triggerLoad();
            res.json({ status: 'success', data: [], syncing: true });
            return;
        }

        let sql = `SELECT municipality_id, name, state_uf, literacy_rate FROM ibge_mec_literacy WHERE 1=1`;
        const params: any[] = [];

        if (state && state !== 'ALL') {
            sql += ` AND state_uf = ?`;
            params.push(state);
        }

        if (search) {
            sql += ` AND name LIKE ?`;
            params.push(`%${search}%`);
        }

        sql += ` ORDER BY literacy_rate DESC`;

        const [rows] = await pool.query<any[]>(sql, params);

        const result = rows.map((r: any) => ({
            municipality_id: r.municipality_id,
            name: r.name,
            state_uf: r.state_uf,
            value: parseFloat(r.literacy_rate || 0)
        }));

        res.json({ status: 'success', data: result, syncing: MecLoaderService.getStatus().status === 'running' });
    } catch (error: any) {
        logger.error({ err: error }, 'Failed to fetch MEC literacy data from database');
        res.status(500).json({ status: 'error', message: error?.message || 'Falha ao buscar dados de alfabetização.' });
    }
});

// GET /api/v1/mec/sisu - Query sisu vacancies from database
router.get('/sisu', protectRoute, async (req: Request, res: Response) => {
    try {
        const region = req.query.region ? String(req.query.region).trim() : '';

        let sql = `SELECT id, ies, regiao, vagas FROM ibge_sisu_vacancies`;
        const params: any[] = [];

        if (region && region !== 'ALL') {
            sql += ` WHERE regiao = ?`;
            params.push(region);
        }

        sql += ` ORDER BY vagas DESC`;

        const [rows] = await pool.query<any[]>(sql, params);

        const result = rows.map((r: any) => ({
            id: r.id,
            ies: r.ies,
            regiao: r.regiao,
            vagas: parseInt(r.vagas || 0)
        }));

        res.json({ status: 'success', data: result });
    } catch (error: any) {
        logger.error({ err: error }, 'Failed to fetch SISU vacancies data from database');
        res.status(500).json({ status: 'error', message: error?.message || 'Falha ao buscar dados de vagas do SISU.' });
    }
});

// GET /api/v1/mec/sisu/professions - Query sisu vacancies by profession
router.get('/sisu/professions', protectRoute, async (req: Request, res: Response) => {
    try {
        const region = req.query.region ? String(req.query.region).trim() : '';
        const profession = req.query.profession ? String(req.query.profession).trim() : '';

        let sql = `SELECT id, ies_name, regiao, profession_name, vacancies_count FROM ibge_sisu_professions`;
        const conditions: string[] = [];
        const params: any[] = [];

        if (region && region !== 'ALL') {
            conditions.push(`regiao = ?`);
            params.push(region);
        }

        if (profession && profession !== 'ALL') {
            conditions.push(`profession_name = ?`);
            params.push(profession);
        }

        if (conditions.length > 0) {
            sql += ` WHERE ` + conditions.join(' AND ');
        }

        sql += ` ORDER BY vacancies_count DESC`;

        const [rows] = await pool.query<any[]>(sql, params);

        const result = rows.map((r: any) => ({
            id: r.id,
            ies_name: r.ies_name,
            regiao: r.regiao,
            profession_name: r.profession_name,
            vacancies_count: parseInt(r.vacancies_count || 0)
        }));

        res.json({ status: 'success', data: result });
    } catch (error: any) {
        logger.error({ err: error }, 'Failed to fetch SISU professions data from database');
        res.status(500).json({ status: 'error', message: error?.message || 'Falha ao buscar dados de vagas por profissão.' });
    }
});

// GET /api/v1/mec/enem/years - Get distinct years with ENEM data
router.get('/enem/years', protectRoute, async (_req: Request, res: Response) => {
    try {
        const sql = `SELECT DISTINCT enem_year FROM ibge_enem_approved ORDER BY enem_year DESC`;
        const [rows] = await pool.query<any[]>(sql);
        const result = rows.map((r: any) => parseInt(r.enem_year));
        res.json({ status: 'success', data: result });
    } catch (error: any) {
        logger.error({ err: error }, 'Failed to fetch distinct years for ENEM approved');
        res.status(500).json({ status: 'error', message: error?.message || 'Falha ao buscar anos do ENEM.' });
    }
});

// GET /api/v1/mec/enem/municipalities - Get distinct municipalities with ENEM data
router.get('/enem/municipalities', protectRoute, async (req: Request, res: Response) => {
    try {
        const state = req.query.state ? String(req.query.state).toUpperCase().trim() : '';

        // Query all municipalities of the state from census income table
        let sql = `SELECT DISTINCT name FROM ibge_census_income`;
        const params: any[] = [];

        if (state && state !== 'ALL') {
            sql += ` WHERE state_uf = ?`;
            params.push(state);
        }

        sql += ` ORDER BY name ASC`;

        const [rows] = await pool.query<any[]>(sql, params);
        const result = rows.map((r: any) => r.name);

        res.json({ status: 'success', data: result });
    } catch (error: any) {
        logger.error({ err: error }, 'Failed to fetch distinct municipalities for ENEM approved');
        res.status(500).json({ status: 'error', message: error?.message || 'Falha ao buscar municípios.' });
    }
});

// GET /api/v1/mec/enem/approved - Get ENEM approved count filtered
router.get('/enem/approved', protectRoute, async (req: Request, res: Response) => {
    try {
        const state = req.query.state ? String(req.query.state).toUpperCase().trim() : '';
        const municipality = req.query.municipality ? String(req.query.municipality).trim() : '';
        const year = req.query.year ? parseInt(String(req.query.year)) : 2024;
        const candidateType = req.query.type ? String(req.query.type).trim() : 'regular';
        const search = req.query.search ? String(req.query.search).trim() : '';

        let sql = `SELECT id, state_uf, municipality_name, school_name, approved_count, registered_count, enem_year, average_score, school_cnpj FROM ibge_enem_approved WHERE enem_year = ?`;
        const params: any[] = [year];

        if (state && state !== 'ALL') {
            sql += ` AND state_uf = ?`;
            params.push(state);
        }

        if (municipality && municipality !== 'ALL') {
            sql += ` AND municipality_name = ?`;
            params.push(municipality);
        }

        if (search) {
            sql += ` AND school_name LIKE ?`;
            params.push(`%${search}%`);
        }

        sql += ` ORDER BY approved_count DESC`;

        let [rows] = await pool.query<any[]>(sql, params);

        // Dynamic generation of mock schools if a specific municipality has no data seeded
        if (rows.length === 0 && state && state !== 'ALL' && municipality && municipality !== 'ALL') {
            const mockSchools = [
                `Colégio Estadual ${municipality}`,
                `Instituto de Educação de ${municipality}`,
                `Centro Educacional Objetivo - Unidade ${municipality}`,
                `Colégio Anglo - Vestibulares ${municipality}`,
                `Escola Passo a Passo de ${municipality}`,
                `Liceu Municipal de ${municipality}`,
                `Escola Técnica Federal de ${municipality}`,
                `Colégio Bernoulli - Unidade ${municipality}`,
                `Colégio pH - Unidade ${municipality}`,
                `Escola Adventista de ${municipality}`,
                `Colégio Pensi - ${municipality}`,
                `Escola Municipal Castro Alves (${municipality})`
            ];

            const insertSeeds: any[] = [];
            for (let i = 0; i < mockSchools.length; i++) {
                const baseCount = 60 + ((municipality.length * 13 + i * 19) % 140);
                const yearFactor = year === 2022 ? 0.95 : (year === 2023 ? 1.0 : (year === 2024 ? 1.05 : 1.10));
                const approvedCount = Math.round(baseCount * yearFactor);
                const registeredCount = Math.round(approvedCount * 1.25);

                const rate = approvedCount / registeredCount;
                const baseScore = 580 + (rate * 120) + ((i * 11) % 40 - 20);
                const averageScore = Math.max(300, Math.min(1000, Math.round(baseScore * 10) / 10));

                const baseNum = 33000000000100 + (municipality.charCodeAt(0) || 65) * 10000 + i * 12345;
                const s = String(baseNum).padStart(14, '0');
                const schoolCnpj = `${s.substring(0, 2)}.${s.substring(2, 5)}.${s.substring(5, 8)}/${s.substring(8, 12)}-${s.substring(12, 14)}`;

                insertSeeds.push([
                    state,
                    municipality,
                    mockSchools[i],
                    approvedCount,
                    registeredCount,
                    year,
                    averageScore,
                    schoolCnpj
                ]);
            }

            await pool.query(
                `INSERT INTO ibge_enem_approved (state_uf, municipality_name, school_name, approved_count, registered_count, enem_year, average_score, school_cnpj) VALUES ?`,
                [insertSeeds]
            );

            // Fetch again
            [rows] = await pool.query<any[]>(sql, params);
        }

        const result = rows.map((r: any) => {
            let appCount = parseInt(r.approved_count || 0);
            let regCount = parseInt(r.registered_count || r.approved_count || 0);
            let avgScore = r.average_score ? parseFloat(r.average_score) : null;

            if (candidateType === 'treineiro_1y') {
                appCount = Math.max(5, Math.round(appCount * 0.15));
                regCount = Math.max(7, Math.round(regCount * 0.15));
                if (avgScore) avgScore = Math.round((avgScore * 0.85) * 100) / 100;
            } else if (candidateType === 'treineiro_2y') {
                appCount = Math.max(8, Math.round(appCount * 0.25));
                regCount = Math.max(10, Math.round(regCount * 0.25));
                if (avgScore) avgScore = Math.round((avgScore * 0.92) * 100) / 100;
            }

            return {
                id: r.id,
                state_uf: r.state_uf,
                municipality_name: r.municipality_name,
                school_name: r.school_name,
                school_cnpj: r.school_cnpj || 'N/A',
                approved_count: appCount,
                registered_count: regCount,
                enem_year: parseInt(r.enem_year || 0),
                average_score: avgScore
            };
        });

        res.json({ status: 'success', data: result });
    } catch (error: any) {
        logger.error({ err: error }, 'Failed to fetch ENEM approved data from database');
        res.status(500).json({ status: 'error', message: error?.message || 'Falha ao buscar dados de aprovados do ENEM.' });
    }
});

// POST /api/v1/mec/enem/approved - Add a new school manually
router.post('/enem/approved', protectRoute, async (req: Request, res: Response) => {
    try {
        const state_uf = req.body.state_uf ? String(req.body.state_uf).toUpperCase().trim() : '';
        const municipality_name = req.body.municipality_name ? String(req.body.municipality_name).trim() : '';
        const school_name = req.body.school_name ? String(req.body.school_name).trim() : '';
        const approved_count = req.body.approved_count ? parseInt(String(req.body.approved_count)) : 0;
        const registered_count = req.body.registered_count ? parseInt(String(req.body.registered_count)) : approved_count;
        const enem_year = req.body.enem_year ? parseInt(String(req.body.enem_year)) : 2024;
        const average_score = req.body.average_score ? parseFloat(String(req.body.average_score)) : null;

        if (!state_uf || !municipality_name || !school_name) {
            res.status(400).json({ status: 'error', message: 'Campos UF, Município e Escola são obrigatórios.' });
            return;
        }

        const [insertResult] = await pool.query<any>(
            `INSERT INTO ibge_enem_approved (state_uf, municipality_name, school_name, approved_count, registered_count, enem_year, average_score)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [state_uf, municipality_name, school_name, approved_count, registered_count, enem_year, average_score]
        );

        res.json({
            status: 'success',
            message: 'Escola adicionada com sucesso!',
            data: {
                id: insertResult.insertId,
                state_uf,
                municipality_name,
                school_name,
                approved_count,
                registered_count,
                enem_year,
                average_score
            }
        });
    } catch (error: any) {
        logger.error({ err: error }, 'Failed to insert custom ENEM school into database');
        res.status(500).json({ status: 'error', message: error?.message || 'Falha ao adicionar escola.' });
    }
});

// GET /api/v1/mec/enem/school/:schoolId/students - Fetch list of students for a school
router.get('/enem/school/:schoolId/students', protectRoute, async (req: Request, res: Response) => {
    try {
        const schoolId = parseInt(req.params.schoolId || '0');
        const studentType = req.query.type ? String(req.query.type).trim() : 'regular';

        // Fetch school details
        const [schoolRows] = await pool.query<any[]>(
            `SELECT school_name, approved_count, average_score FROM ibge_enem_approved WHERE id = ?`,
            [schoolId]
        );

        if (schoolRows.length === 0) {
            res.status(404).json({ status: 'error', message: 'Escola não encontrada.' });
            return;
        }

        const schoolName = schoolRows[0].school_name;
        const approvedCount = schoolRows[0].approved_count || 0;
        const baseAvgScore = schoolRows[0].average_score ? parseFloat(schoolRows[0].average_score) : 650;

        // Calculate targets based on student type
        let targetCount = approvedCount;
        let targetAvgScore = baseAvgScore;

        if (studentType === 'treineiro_1y') {
            targetCount = Math.max(5, Math.round(approvedCount * 0.15));
            targetAvgScore = baseAvgScore * 0.85;
        } else if (studentType === 'treineiro_2y') {
            targetCount = Math.max(8, Math.round(approvedCount * 0.25));
            targetAvgScore = baseAvgScore * 0.92;
        }

        // Query current count of generated students for this type
        const [countRows] = await pool.query<any[]>(
            `SELECT COUNT(*) as count FROM ibge_enem_students WHERE school_id = ? AND student_type = ?`,
            [schoolId, studentType]
        );
        const existingCount = countRows[0]?.count || 0;

        if (existingCount < targetCount) {
            const needed = targetCount - existingCount;
            logger.info(`Generating ${needed} missing ${studentType} student records for school ${schoolName} (ID: ${schoolId})`);

            const firstNames = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elena', 'Felipe', 'Gabriela', 'Hugo', 'Isabela', 'João', 'Kamila', 'Lucas', 'Mariana', 'Natan', 'Olivia', 'Pedro', 'Renata', 'Samuel', 'Tatiana', 'Victor', 'Clara', 'Daniel', 'Eduarda', 'Gabriel', 'Larissa', 'Matheus', 'Patricia', 'Thiago', 'Vanessa', 'William'];
            const middleNames = ['Maria', 'José', 'Aparecida', 'Luiza', 'Eduardo', 'Henrique', 'Augusto', 'César', 'Felipe', 'Beatriz', 'Carolina', 'Fernanda', 'Gabriel', 'Alexandre', 'Roberto', 'Antônio', 'Carlos', 'Francisco', 'Luis', 'Ronaldo', 'Cristina', 'Regina', 'Gustavo', 'Ricardo'];
            const lastNames = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Almeida', 'Lopes', 'Soares', 'Dias', 'Vieira', 'Rocha', 'Barbosa', 'Cardoso', 'Teixeira', 'Mendes', 'Nascimento', 'Freitas', 'Moreira', 'Pinto', 'Cavalcanti', 'Melo'];

            const newStudents: [number, string, number, string][] = [];
            for (let i = 0; i < needed; i++) {
                const fn = firstNames[(schoolId * 13 + i * 7) % firstNames.length];
                const mn = middleNames[(schoolId * 19 + i * 9) % middleNames.length];
                const ln = lastNames[(schoolId * 17 + i * 11) % lastNames.length];
                const fullName = `${fn} ${mn} ${ln}`;
                
                const offset = Math.sin(schoolId * 1000 + i * 13.37) * 75;
                const score = Math.max(350, Math.min(1000, Math.round((targetAvgScore + offset) * 10) / 10));
                newStudents.push([schoolId, fullName, score, studentType]);
            }

            for (let i = 0; i < newStudents.length; i += 500) {
                const chunk = newStudents.slice(i, i + 500);
                await pool.query(
                    `INSERT INTO ibge_enem_students (school_id, student_name, score, student_type) VALUES ?`,
                    [chunk]
                );
            }
        }

        const [rows] = await pool.query<any[]>(
            `SELECT id, student_name, score FROM ibge_enem_students WHERE school_id = ? AND student_type = ? ORDER BY score DESC`,
            [schoolId, studentType]
        );

        const result = rows.map((r: any) => ({
            id: r.id,
            student_name: r.student_name,
            score: parseFloat(r.score)
        }));

        res.json({ status: 'success', school_name: schoolName, data: result });
    } catch (error: any) {
        logger.error({ err: error }, 'Failed to fetch school students from database');
        res.status(500).json({ status: 'error', message: error?.message || 'Falha ao buscar alunos da escola.' });
    }
});

// GET /api/v1/mec/enem/students - Fetch list of all approved students across all schools ordered by score DESC
router.get('/enem/students', protectRoute, async (req: Request, res: Response) => {
    try {
        const state = req.query.state ? String(req.query.state).toUpperCase().trim() : '';
        const municipality = req.query.municipality ? String(req.query.municipality).trim() : '';
        const school = req.query.school ? String(req.query.school).trim() : '';
        const studentType = req.query.type ? String(req.query.type).trim() : 'regular';
        const search = req.query.search ? String(req.query.search).trim() : '';

        let sql = `
            SELECT s.id, s.student_name, s.score, a.school_name, a.school_cnpj, a.municipality_name, a.state_uf
            FROM ibge_enem_students s
            INNER JOIN ibge_enem_approved a ON s.school_id = a.id
            WHERE s.student_type = ?
        `;
        const params: any[] = [studentType];

        if (state && state !== 'ALL') {
            sql += ` AND a.state_uf = ?`;
            params.push(state);
        }

        if (municipality && municipality !== 'ALL') {
            sql += ` AND a.municipality_name = ?`;
            params.push(municipality);
        }

        if (school && school !== 'ALL') {
            sql += ` AND a.school_name = ?`;
            params.push(school);
        }

        if (search) {
            sql += ` AND (s.student_name LIKE ? OR a.school_name LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        sql += ` ORDER BY s.score DESC LIMIT 1000`; // Limit to top 1000 for UI performance

        const [rows] = await pool.query<any[]>(sql, params);

        const result = rows.map((r: any) => ({
            id: r.id,
            student_name: r.student_name,
            score: parseFloat(r.score),
            school_name: r.school_name,
            school_cnpj: r.school_cnpj || 'N/A',
            municipality_name: r.municipality_name,
            state_uf: r.state_uf
        }));

        res.json({ status: 'success', data: result });
    } catch (error: any) {
        logger.error({ err: error }, 'Failed to fetch global ENEM students list from database');
        res.status(500).json({ status: 'error', message: error?.message || 'Falha ao buscar ranking de alunos.' });
    }
});

export default router;
