import { Router, Request, Response } from 'express';
import { protectRoute, requireAdminOrSuperAdmin } from '../middlewares/authMiddleware';
import pool from '../config/db';
import logger from '../config/logger';

const router = Router();

router.post('/query', protectRoute, requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
    const { query, databaseType } = req.body;

    if (!query || typeof query !== 'string') {
        res.status(400).json({ status: 'error', message: 'A consulta SQL é obrigatória.' });
        return;
    }

    const sql = query.trim();
    if (!sql) {
        res.status(400).json({ status: 'error', message: 'A consulta SQL está vazia.' });
        return;
    }

    try {
        if (databaseType === 'solidcon' || databaseType === 'dorsal') {
            const isSolidcon = databaseType === 'solidcon';
            const companyId = req.user?.company_id;
            if (!companyId) {
                res.status(400).json({ status: 'error', message: 'Empresa do usuário não identificada.' });
                return;
            }

            const { CompanyService } = await import('../services/companyService');
            const company = await CompanyService.getById(companyId);

            const server = isSolidcon ? company.serv_solidcon : company.serv_dorsal;
            const database = isSolidcon ? company.bd_solidcon : company.bd_dorsal;
            const user = isSolidcon ? company.login_solidcon : company.login_dorsal;
            const password = isSolidcon ? company.senha_solidcon : company.senha_dorsal;

            if (!server || !database || !user || !password) {
                res.status(400).json({
                    status: 'error',
                    message: `Configurações de conexão para o Banco de Dados ${isSolidcon ? 'Solidcon' : 'Dorsal'} incompletas no cadastro da empresa.`
                });
                return;
            }

            const { ExternalDbService } = await import('../services/externalDbService');
            const results = await ExternalDbService.executeCustomQuery({
                host: server,
                database,
                user,
                password
            }, sql);

            let columns: string[] = [];
            if (results.length > 0) {
                columns = Object.keys(results[0]);
            }

            res.status(200).json({
                status: 'success',
                data: {
                    rows: results,
                    columns
                }
            });
        } else if (databaseType === 'alterdata') {
            const companyId = req.user?.company_id;
            if (!companyId) {
                res.status(400).json({ status: 'error', message: 'Empresa do usuário não identificada.' });
                return;
            }

            const { CompanyService } = await import('../services/companyService');
            const company = await CompanyService.getById(companyId);

            const server = company.serv_alterdata;
            const port = company.porta_alterdata;
            const database = company.bd_alterdata;
            const user = company.login_alterdata;
            const password = company.senha_alterdata;

            if (!server || !database || !user) {
                res.status(400).json({
                    status: 'error',
                    message: 'Configurações de conexão para o Banco de Dados Alterdata incompletas no cadastro da empresa.'
                });
                return;
            }

            const { ExternalDbService } = await import('../services/externalDbService');
            const results = await ExternalDbService.executeAlterdataQuery({
                host: server,
                port,
                database,
                user,
                password
            }, sql);

            let columns: string[] = [];
            if (results.length > 0) {
                columns = Object.keys(results[0]);
            }

            res.status(200).json({
                status: 'success',
                data: {
                    rows: results,
                    columns
                }
            });
        } else {
            const [results, fields] = await pool.query<any>(sql);
            
            let rows = [];
            let columns: string[] = [];

            if (Array.isArray(results)) {
                rows = results;
                if (fields) {
                    columns = fields.map((f: any) => f.name);
                } else if (results.length > 0) {
                    columns = Object.keys(results[0]);
                }
            } else {
                rows = [results];
                columns = Object.keys(results || {});
            }

            res.status(200).json({
                status: 'success',
                data: {
                    rows,
                    columns
                }
            });
        }
    } catch (error: any) {
        logger.error({ error, query: sql }, 'Erro ao executar consulta de manutenção');
        res.status(400).json({
            status: 'error',
            message: error.message || 'Erro ao executar a consulta.'
        });
    }
});

router.get('/tables', protectRoute, requireAdminOrSuperAdmin, async (req: Request, res: Response) => {
    const { databaseType, type } = req.query; // type can be 'all', 'table', 'view'
    try {
        if (databaseType === 'solidcon' || databaseType === 'dorsal') {
            const isSolidcon = databaseType === 'solidcon';
            const companyId = req.user?.company_id;
            if (!companyId) {
                res.status(400).json({ status: 'error', message: 'Empresa do usuário não identificada.' });
                return;
            }

            const { CompanyService } = await import('../services/companyService');
            const company = await CompanyService.getById(companyId);

            const server = isSolidcon ? company.serv_solidcon : company.serv_dorsal;
            const database = isSolidcon ? company.bd_solidcon : company.bd_dorsal;
            const user = isSolidcon ? company.login_solidcon : company.login_dorsal;
            const password = isSolidcon ? company.senha_solidcon : company.senha_dorsal;

            if (!server || !database || !user || !password) {
                res.status(400).json({
                    status: 'error',
                    message: `Configurações de conexão para o Banco de Dados ${isSolidcon ? 'Solidcon' : 'Dorsal'} incompletas.`
                });
                return;
            }

            let queryStr = `SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA NOT IN ('sys', 'INFORMATION_SCHEMA')`;
            const conditions: string[] = [];
            
            if (type === 'table') {
                conditions.push("TABLE_TYPE = 'BASE TABLE'");
            } else if (type === 'view') {
                conditions.push("TABLE_TYPE = 'VIEW'");
            }
            
            if (conditions.length > 0) {
                queryStr += ` AND ${conditions.join(' AND ')}`;
            }
            queryStr += ` ORDER BY TABLE_SCHEMA, TABLE_NAME`;

            const { ExternalDbService } = await import('../services/externalDbService');
            const results = await ExternalDbService.executeCustomQuery({
                host: server,
                database,
                user,
                password
            }, queryStr);

            const tables = results.map((row: any) => {
                const schema = row.TABLE_SCHEMA || row.table_schema || '';
                const name = row.TABLE_NAME || row.table_name || Object.values(row)[0];
                if (schema && schema.toLowerCase() !== 'dbo' && schema.toLowerCase() !== 'public') {
                    return `${schema}.${name}`;
                }
                return name;
            });
            res.status(200).json({
                status: 'success',
                data: tables
            });
        } else if (databaseType === 'alterdata') {
            const companyId = req.user?.company_id;
            if (!companyId) {
                res.status(400).json({ status: 'error', message: 'Empresa do usuário não identificada.' });
                return;
            }

            const { CompanyService } = await import('../services/companyService');
            const company = await CompanyService.getById(companyId);

            const server = company.serv_alterdata;
            const port = company.porta_alterdata;
            const database = company.bd_alterdata;
            const user = company.login_alterdata;
            const password = company.senha_alterdata;

            if (!server || !database || !user) {
                res.status(400).json({
                    status: 'error',
                    message: 'Configurações de conexão para o Banco de Dados Alterdata incompletas.'
                });
                return;
            }

            let queryStr = `
                SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_SCHEMA NOT IN ('sys', 'INFORMATION_SCHEMA', 'pg_catalog')
            `;
            if (type === 'table') {
                queryStr += " AND TABLE_TYPE = 'BASE TABLE'";
            } else if (type === 'view') {
                queryStr += " AND TABLE_TYPE = 'VIEW'";
            }
            queryStr += " ORDER BY TABLE_SCHEMA, TABLE_NAME;";

            const { ExternalDbService } = await import('../services/externalDbService');
            const results = await ExternalDbService.executeAlterdataQuery({
                host: server,
                port,
                database,
                user,
                password
            }, queryStr);

            const tables = results.map((row: any) => {
                const schema = row.TABLE_SCHEMA || row.table_schema || '';
                const name = row.TABLE_NAME || row.table_name || Object.values(row)[0];
                if (schema && schema.toLowerCase() !== 'dbo' && schema.toLowerCase() !== 'public') {
                    return `${schema}.${name}`;
                }
                return name;
            });
            res.status(200).json({
                status: 'success',
                data: tables
            });
        } else {
            const [results] = await pool.query<any>('SHOW FULL TABLES');
            const tables = results
                .filter((row: any) => {
                    const rowType = row.Table_type || row.TABLE_TYPE || '';
                    if (type === 'table') {
                        return rowType.toUpperCase() === 'BASE TABLE';
                    }
                    if (type === 'view') {
                        return rowType.toUpperCase() === 'VIEW';
                    }
                    return true;
                })
                .map((row: any) => Object.values(row)[0]);
            res.status(200).json({
                status: 'success',
                data: tables
            });
        }
    } catch (error: any) {
        logger.error({ error }, 'Erro ao carregar tabelas de manutenção');
        res.status(500).json({
            status: 'error',
            message: error.message || 'Erro ao listar tabelas.'
        });
    }
});

export default router;
