import { Request, Response } from 'express';
import unzipper from 'unzipper';
import { parse } from 'csv-parse';
import pool from '../config/db';
import logger from '../config/logger';

export const listBackupTables = async (req: Request, res: Response) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
        }

        const directory = await unzipper.Open.buffer(file.buffer);
        const tables = directory.files
            .filter(zFile => zFile.path.endsWith('.csv'))
            .map(zFile => zFile.path.replace('.csv', ''));

        return res.status(200).json({ tables });
    } catch (error) {
        logger.error({ err: error }, '[Restore] Erro ao listar tabelas do backup');
        return res.status(500).json({ error: 'Erro ao ler arquivo de backup.', details: error instanceof Error ? error.message : String(error) });
    }
};

export const restoreBackup = async (req: Request, res: Response) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).send('Nenhum arquivo enviado.');
        }

        const tablesParam = req.body.tables as string | undefined;
        let tablesToRestore: string[] | null = null;
        if (tablesParam) {
            tablesToRestore = tablesParam.split(',').map(t => t.trim());
        }

        const directory = await unzipper.Open.buffer(file.buffer);
        
        const connection = await pool.getConnection();
        // Desativar restrições de chaves estrangeiras para permitir o TRUNCATE e INSERT fora de ordem
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');

        try {
            for (const zFile of directory.files) {
                if (!zFile.path.endsWith('.csv')) continue;
                const tableName = zFile.path.replace('.csv', '');
                
                if (tablesToRestore && !tablesToRestore.includes(tableName)) {
                    logger.info(`Ignorando tabela não selecionada: ${tableName}`);
                    continue;
                }
                
                logger.info(`Restaurando tabela: ${tableName}`);
                
                // Em vez de TRUNCATE que às vezes falha por chaves, tentamos DELETE se for MyISAM/InnoDB e TRUNCATE falhar
                try {
                    await connection.query(`TRUNCATE TABLE \`${tableName}\``);
                } catch (e) {
                    await connection.query(`DELETE FROM \`${tableName}\``);
                }
                
                const buffer = await zFile.buffer();
                const content = buffer.toString('utf-8');
                
                const records: any[] = await new Promise((resolve, reject) => {
                    parse(content, {
                        columns: true,
                        skip_empty_lines: true
                    }, (err, data) => {
                        if (err) reject(err);
                        else resolve(data);
                    });
                });

                if (records.length > 0) {
                    const columns = Object.keys(records[0]);
                    
                    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
                    // Converte valores vazios '' para null, para evitar erros de tipagem no BD (ex: int, date)
                    const values = records.map(record => columns.map(col => {
                        const val = record[col];
                        if (val === '') return null;
                        if (typeof val === 'string' && isoDateRegex.test(val)) {
                            return val.substring(0, 19).replace('T', ' ');
                        }
                        return val;
                    }));
                    
                    const query = `INSERT INTO \`${tableName}\` (\`${columns.join('`, `')}\`) VALUES ?`;
                    
                    // Insere em bulk
                    await connection.query(query, [values]);
                }
            }
        } finally {
            // Reativar
            await connection.query('SET FOREIGN_KEY_CHECKS = 1');
            connection.release();
        }

        logger.info('Backup restaurado com sucesso');
        return res.status(200).send('Backup restaurado com sucesso');
    } catch (error) {
        logger.error({ err: error }, '[Restore] Erro ao restaurar backup');
        return res.status(500).send('Erro interno ao restaurar backup: ' + (error instanceof Error ? error.message : String(error)));
    }
};
