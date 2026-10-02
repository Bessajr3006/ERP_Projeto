import { Router, Request, Response } from 'express';
import { protectRoute, requireSuperAdmin } from '../middlewares/authMiddleware';
import pool from '../config/db';
import logger from '../config/logger';
import { RowDataPacket } from 'mysql2/promise';

const router = Router();

// Todas as rotas de manutenção são estritamente restritas a Super Admin
router.use(protectRoute, requireSuperAdmin);

/**
 * Endpoint para listar tabelas do banco de dados para diagnóstico.
 */
router.get('/tables', async (req: Request, res: Response) => {
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

/**
 * Consultas de diagnóstico predefinidas e somente leitura (Super Admin).
 * Não aceita SQL livre.
 */
router.post('/diagnostics', async (req: Request, res: Response) => {
    const { action, tableName, databaseType } = req.body;

    const allowedActions = [
        'status',
        'table_counts',
        'storage',
        'processes',
        'table_schema',
        'external_ping'
    ];

    if (!action || !allowedActions.includes(action)) {
        res.status(400).json({
            status: 'error',
            message: `Ação de diagnóstico inválida. Ações permitidas: ${allowedActions.join(', ')}`
        });
        return;
    }

    try {
        let rows: any[] = [];
        let columns: string[] = [];

        switch (action) {
            case 'status': {
                const [result] = await pool.query<RowDataPacket[]>(
                    `SELECT VERSION() as version, NOW() as current_time, @@hostname as hostname, @@max_connections as max_connections`
                );
                rows = result;
                columns = Object.keys(rows[0] || {});
                break;
            }

            case 'table_counts': {
                const [result] = await pool.query<RowDataPacket[]>(
                    `SELECT 
                        TABLE_NAME as table_name, 
                        TABLE_ROWS as estimated_rows, 
                        ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) as size_mb, 
                        CREATE_TIME as created_at 
                     FROM information_schema.tables 
                     WHERE table_schema = DATABASE() 
                     ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC`
                );
                rows = result;
                columns = Object.keys(rows[0] || {});
                break;
            }

            case 'storage': {
                const [result] = await pool.query<RowDataPacket[]>(
                    `SELECT 
                        table_schema as database_name, 
                        COUNT(table_name) as total_tables,
                        ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as total_size_mb 
                     FROM information_schema.tables 
                     WHERE table_schema = DATABASE() 
                     GROUP BY table_schema`
                );
                rows = result;
                columns = Object.keys(rows[0] || {});
                break;
            }

            case 'processes': {
                const [result] = await pool.query<RowDataPacket[]>('SHOW PROCESSLIST');
                rows = result;
                columns = Object.keys(rows[0] || {});
                break;
            }

            case 'table_schema': {
                if (!tableName || typeof tableName !== 'string' || !/^[a-zA-Z0-9_]+$/.test(tableName)) {
                    res.status(400).json({ status: 'error', message: 'Nome da tabela inválido para inspeção de schema.' });
                    return;
                }

                const [result] = await pool.query<RowDataPacket[]>(
                    `SELECT 
                        COLUMN_NAME as column_name, 
                        COLUMN_TYPE as column_type, 
                        IS_NULLABLE as is_nullable, 
                        COLUMN_KEY as column_key, 
                        COLUMN_DEFAULT as default_value, 
                        EXTRA as extra 
                     FROM INFORMATION_SCHEMA.COLUMNS 
                     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? 
                     ORDER BY ORDINAL_POSITION`,
                    [tableName]
                );
                rows = result;
                columns = Object.keys(rows[0] || {});
                break;
            }

            case 'external_ping': {
                const companyId = req.user?.company_id;
                if (!companyId) {
                    res.status(400).json({ status: 'error', message: 'Empresa do usuário não identificada.' });
                    return;
                }

                const { CompanyService } = await import('../services/companyService');
                const company = await CompanyService.getById(companyId);

                if (databaseType === 'solidcon' || databaseType === 'dorsal') {
                    const isSolidcon = databaseType === 'solidcon';
                    const server = isSolidcon ? company.serv_solidcon : company.serv_dorsal;
                    const database = isSolidcon ? company.bd_solidcon : company.bd_dorsal;
                    const user = isSolidcon ? company.login_solidcon : company.login_dorsal;
                    const password = isSolidcon ? company.senha_solidcon : company.senha_dorsal;

                    if (!server || !database || !user || !password) {
                        res.status(400).json({
                            status: 'error',
                            message: `Configurações de conexão para ${isSolidcon ? 'Solidcon' : 'Dorsal'} incompletas.`
                        });
                        return;
                    }

                    const { ExternalDbService } = await import('../services/externalDbService');
                    const results = await ExternalDbService.executeCustomQuery({
                        host: server,
                        database,
                        user,
                        password
                    }, 'SELECT 1 as connected, @@version as server_version, GETDATE() as current_time');

                    rows = results;
                    columns = Object.keys(rows[0] || {});
                } else if (databaseType === 'alterdata') {
                    const server = company.serv_alterdata;
                    const port = company.porta_alterdata;
                    const database = company.bd_alterdata;
                    const user = company.login_alterdata;
                    const password = company.senha_alterdata;

                    if (!server || !database || !user) {
                        res.status(400).json({
                            status: 'error',
                            message: 'Configurações de conexão para Alterdata incompletas.'
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
                    }, 'SELECT 1 as connected, version() as server_version, NOW() as current_time;');

                    rows = results;
                    columns = Object.keys(rows[0] || {});
                } else {
                    rows = [{ status: 'local_database_connected', timestamp: new Date().toISOString() }];
                    columns = ['status', 'timestamp'];
                }
                break;
            }
        }

        res.status(200).json({
            status: 'success',
            data: {
                action,
                rows,
                columns
            }
        });
    } catch (error: any) {
        logger.error({ error, action }, 'Erro ao executar diagnóstico de manutenção');
        res.status(500).json({
            status: 'error',
            message: error.message || 'Erro ao executar diagnóstico.'
        });
    }
});

export default router;
