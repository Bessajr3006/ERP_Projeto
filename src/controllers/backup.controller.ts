import { Request, Response } from 'express';
import pool from '../config/db';
import logger from '../config/logger';

export const generateBackup = async (req: Request, res: Response) => {
    try {
        const [tablesRows] = await pool.query('SHOW TABLES');
        const tables = (tablesRows as any[]).map(row => Object.values(row)[0] as string);
        
        const dateStr = new Date().toISOString().split('T')[0];
        
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="backup-keystone-${dateStr}.zip"`);
        
        const archiver = require('archiver');
        const archive = archiver('zip', {
            zlib: { level: 9 }
        });
        
        archive.on('error', function(err: any) {
            throw err;
        });

        // pipe archive data directly to the HTTP response
        archive.pipe(res);

        for (const table of tables) {
            const [rows] = await pool.query(`SELECT * FROM \`${table}\``);
            const dataRows = rows as any[];
            
            if (dataRows.length === 0) {
                // If table is empty, we get headers from SHOW COLUMNS
                const [cols] = await pool.query(`SHOW COLUMNS FROM \`${table}\``);
                const headers = (cols as any[]).map(c => `"${c.Field}"`).join(',');
                archive.append(headers + '\n', { name: `${table}.csv` });
                continue;
            }

            // Headers from the first row keys
            const headers = Object.keys(dataRows[0]).map(key => `"${key}"`).join(',');
            
            // Map rows to CSV lines
            const csvLines = dataRows.map(row => {
                return Object.values(row).map(val => {
                    if (val === null || val === undefined) return '';
                    
                    // Convert Dates properly
                    if (val instanceof Date) {
                        return `"${val.toISOString()}"`;
                    }

                    let strVal = String(val);
                    // Escape internal quotes by doubling them
                    strVal = strVal.replace(/"/g, '""');
                    // Always wrap in quotes to ensure commas or newlines don't break CSV format
                    return `"${strVal}"`;
                }).join(',');
            });

            // Join everything
            const csvContent = headers + '\n' + csvLines.join('\n') + '\n';
            
            archive.append(csvContent, { name: `${table}.csv` });
        }

        await archive.finalize();
        logger.info(`[Backup] Backup gerado com sucesso por usuário ID ${req.user?.id || 'unknown'}`);

    } catch (error) {
        logger.error({ err: error }, '[Backup] Erro ao gerar backup zip com CSVs');
        if (!res.headersSent) {
            res.status(500).json({ error: 'Erro ao gerar backup', details: error instanceof Error ? error.message : String(error) });
        }
    }
};
