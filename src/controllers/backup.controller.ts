import { Request, Response } from 'express';
import pool from '../config/db';
import logger from '../config/logger';
import { RowDataPacket } from 'mysql2/promise';
import archiver from 'archiver';

const SYSTEM_REFERENCE_TABLES = new Set([
    'ibge_states',
    'ibge_mesoregions',
    'ibge_microregions',
    'ibge_cities'
]);

async function getAllowedBaseTables(): Promise<string[]> {
    const [tablesRows] = await pool.query<RowDataPacket[]>("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
    return (tablesRows as any[])
        .map(row => Object.values(row)[0] as string)
        .filter(t => /^[a-zA-Z0-9_]+$/.test(t));
}

export const getTables = async (_req: Request, res: Response): Promise<Response> => {
    try {
        const allTables = await getAllowedBaseTables();
        return res.status(200).json({ tables: allTables });
    } catch (error) {
        logger.error({ err: error }, '[Backup] Erro ao listar tabelas');
        return res.status(500).json({ error: 'Erro ao listar tabelas', details: error instanceof Error ? error.message : String(error) });
    }
};

export const generateBackup = async (req: Request, res: Response): Promise<Response | void> => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: 'Acesso negado. Não autenticado.' });
        }

        const isSuperAdmin = user.role === 'super_admin' || Boolean(user.general_admin_company_id);
        const userCompanyId = user.company_id;

        if (!isSuperAdmin && !userCompanyId) {
            return res.status(403).json({ error: 'Acesso negado. Empresa não identificada.' });
        }

        const allTables = await getAllowedBaseTables();
        const allowedTableSet = new Set(allTables);
        
        let tables = allTables;
        const selectedTablesParam = req.query.tables as string | undefined;
        if (selectedTablesParam) {
            const selectedTables = selectedTablesParam.split(',').map(t => t.trim());
            tables = allTables.filter(t => selectedTables.includes(t) && allowedTableSet.has(t));
        }
        
        const dateStr = new Date().toISOString().split('T')[0];
        const scopePrefix = isSuperAdmin ? 'backup-global' : `backup-company-${userCompanyId}`;
        
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${scopePrefix}-${dateStr}.zip"`);
        
        const archive = (archiver as any)('zip', {
            zlib: { level: 9 }
        });
        
        archive.on('error', function(err: any) {
            logger.error({ err }, '[Backup] Erro no fluxo do zip archiver');
            if (!res.headersSent) {
                res.status(500).json({ error: 'Erro ao processar arquivo ZIP' });
            }
        });

        // Pipe archive data directly to the HTTP response
        archive.pipe(res);

        for (const table of tables) {
            // Verifica as colunas da tabela de forma segura
            const [cols] = await pool.query<RowDataPacket[]>(`SHOW COLUMNS FROM \`${table}\``);
            const columnNames = (cols as any[]).map(c => c.Field as string);
            const hasCompanyId = columnNames.includes('company_id');

            let dataRows: any[] = [];

            if (isSuperAdmin) {
                const [rows] = await pool.query(`SELECT * FROM \`${table}\``);
                dataRows = rows as any[];
            } else {
                // Admin de empresa: exporta apenas dados da sua própria company_id
                if (table === 'companies') {
                    const [rows] = await pool.query(`SELECT * FROM companies WHERE id = ?`, [userCompanyId]);
                    dataRows = rows as any[];
                } else if (hasCompanyId) {
                    const [rows] = await pool.query(`SELECT * FROM \`${table}\` WHERE company_id = ?`, [userCompanyId]);
                    dataRows = rows as any[];
                } else if (SYSTEM_REFERENCE_TABLES.has(table)) {
                    const [rows] = await pool.query(`SELECT * FROM \`${table}\``);
                    dataRows = rows as any[];
                } else {
                    // Tabelas do sistema sem company_id são omitidas para inquilinos comuns
                    dataRows = [];
                }
            }
            
            if (dataRows.length === 0) {
                const headers = columnNames.map(name => `"${name}"`).join(',');
                archive.append(headers + '\n', { name: `${table}.csv` });
                continue;
            }

            // Headers from the first row keys
            const headers = Object.keys(dataRows[0]).map(key => `"${key}"`).join(',');
            
            // Map rows to CSV lines
            const csvLines = dataRows.map(row => {
                return Object.values(row).map(val => {
                    if (val === null || val === undefined) return '';
                    
                    if (val instanceof Date) {
                        return `"${val.toISOString()}"`;
                    }

                    let strVal = String(val);
                    strVal = strVal.replace(/"/g, '""');
                    return `"${strVal}"`;
                }).join(',');
            });

            const csvContent = headers + '\n' + csvLines.join('\n') + '\n';
            archive.append(csvContent, { name: `${table}.csv` });
        }

        await archive.finalize();
        logger.info(`[Backup] Backup (${isSuperAdmin ? 'global' : `empresa ${userCompanyId}`}) gerado com sucesso por usuário ID ${user.id}`);

    } catch (error) {
        logger.error({ err: error }, '[Backup] Erro ao gerar backup zip com CSVs');
        if (!res.headersSent) {
            res.status(500).json({ error: 'Erro ao gerar backup', details: error instanceof Error ? error.message : String(error) });
        }
    }
};
