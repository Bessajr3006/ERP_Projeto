import { Router, Request, Response, NextFunction } from 'express';
import { protectRoute } from '../middlewares/authMiddleware';
import pool from '../config/db';
import logger from '../config/logger';
import { CensusLoaderService } from '../services/censusLoaderService';

const router = Router();

// Auto-trigger sync in background when route loads (will only sync if DB table is empty)
CensusLoaderService.triggerLoad().catch((err) => {
    logger.error({ err }, 'Failed to trigger initial census sync on startup');
});

// GET /api/v1/census/status - Get sync status
router.get('/status', protectRoute, (_req: Request, res: Response) => {
    res.json({ status: 'success', data: CensusLoaderService.getStatus() });
});

// POST /api/v1/census/sync - Force database sync
router.post('/sync', protectRoute, async (_req: Request, res: Response) => {
    try {
        await CensusLoaderService.triggerLoad(true);
        res.json({ status: 'success', message: 'Sincronização iniciada com sucesso em segundo plano.' });
    } catch (error: any) {
        res.status(500).json({ status: 'error', message: error?.message || 'Falha ao forçar sincronização.' });
    }
});

// GET /api/v1/census/data - Query census data from local database
router.get('/data', protectRoute, async (req: Request, res: Response, _next: NextFunction) => {
    try {
        const state = req.query.state ? String(req.query.state).toUpperCase().trim() : '';
        const search = req.query.search ? String(req.query.search).trim() : '';

        // If table is completely empty, we trigger load and return empty list indicating loader is running
        const [countRows] = await pool.query<any[]>(`SELECT COUNT(*) as count FROM ibge_census_income`);
        const totalInDb = countRows[0]?.count || 0;

        if (totalInDb === 0) {
            // Trigger sync again just in case
            await CensusLoaderService.triggerLoad();
            res.json({ status: 'success', data: [], syncing: true });
            return;
        }

        let sql = `SELECT municipality_id, name, state_uf, income_per_capita, population FROM ibge_census_income WHERE 1=1`;
        const params: any[] = [];

        if (state && state !== 'ALL') {
            sql += ` AND state_uf = ?`;
            params.push(state);
        }

        if (search) {
            sql += ` AND name LIKE ?`;
            params.push(`%${search}%`);
        }

        sql += ` ORDER BY income_per_capita DESC`;

        const [rows] = await pool.query<any[]>(sql, params);

        const result = rows.map((r: any) => ({
            municipality_id: r.municipality_id,
            name: r.name,
            state_uf: r.state_uf,
            value: parseFloat(r.income_per_capita || 0),
            population: r.population ? parseInt(r.population) : null
        }));

        res.json({ status: 'success', data: result, syncing: CensusLoaderService.getStatus().status === 'running' });
    } catch (error: any) {
        logger.error({ err: error }, 'Failed to fetch census data from database');
        res.status(500).json({ status: 'error', message: error?.message || 'Falha ao buscar dados do Censo.' });
    }
});

// GET /api/v1/census/pnad - Query pnad income historical series
router.get('/pnad', protectRoute, async (req: Request, res: Response) => {
    try {
        const state = req.query.state ? String(req.query.state).toUpperCase().trim() : '';

        let sql = `SELECT id, state_uf, year, quarter, average_income, unemployment_rate FROM ibge_pnad_income`;
        const params: any[] = [];

        if (state && state !== 'ALL') {
            sql += ` WHERE state_uf = ?`;
            params.push(state);
        }

        sql += ` ORDER BY year DESC, quarter DESC`;

        const [rows] = await pool.query<any[]>(sql, params);

        const result = rows.map((r: any) => ({
            id: r.id,
            state_uf: r.state_uf,
            year: parseInt(r.year),
            quarter: r.quarter ? parseInt(r.quarter) : null,
            average_income: parseFloat(r.average_income || 0),
            unemployment_rate: r.unemployment_rate ? parseFloat(r.unemployment_rate) : null
        }));

        res.json({ status: 'success', data: result });
    } catch (error: any) {
        logger.error({ err: error }, 'Failed to fetch PNAD Contínua data from database');
        res.status(500).json({ status: 'error', message: error?.message || 'Falha ao buscar dados da PNAD Contínua.' });
    }
});

export default router;
