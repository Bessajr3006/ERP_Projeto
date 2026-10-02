import { Request, Response } from 'express';
import unzipper from 'unzipper';
import { parse } from 'csv-parse';
import pool from '../config/db';
import logger from '../config/logger';
import { RowDataPacket } from 'mysql2/promise';

async function getAllowedBaseTables(): Promise<Set<string>> {
    const [tablesRows] = await pool.query<RowDataPacket[]>("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
    const allowed = (tablesRows as any[])
        .map(row => Object.values(row)[0] as string)
        .filter(t => /^[a-zA-Z0-9_]+$/.test(t));
    return new Set(allowed);
}

export const listBackupTables = async (req: Request, res: Response) => {
    try {
        if (req.user?.role !== 'super_admin') {
            return res.status(403).json({ error: 'Acesso restrito ao super admin.' });
        }

        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
        }

        const allowedBaseTables = await getAllowedBaseTables();
        const directory = await unzipper.Open.buffer(file.buffer);
        const tables = directory.files
            .filter(zFile => zFile.path.endsWith('.csv'))
            .map(zFile => zFile.path.replace('.csv', ''))
            .filter(tableName => /^[a-zA-Z0-9_]+$/.test(tableName) && allowedBaseTables.has(tableName));

        return res.status(200).json({ tables });
    } catch (error) {
        logger.error({ err: error }, '[Restore] Erro ao listar tabelas do backup');
        return res.status(500).json({ error: 'Erro ao ler arquivo de backup.', details: error instanceof Error ? error.message : String(error) });
    }
};

export const restoreBackup = async (req: Request, res: Response) => {
    if (req.user?.role !== 'super_admin') {
        return res.status(403).json({ error: 'Acesso restrito ao super admin.' });
    }

    const file = req.file;
    if (!file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const allowedBaseTables = await getAllowedBaseTables();

    const tablesParam = req.body.tables as string | undefined;
    let tablesToRestore: Set<string> | null = null;
    if (tablesParam) {
        const filtered = tablesParam
            .split(',')
            .map(t => t.trim())
            .filter(t => allowedBaseTables.has(t));
        tablesToRestore = new Set(filtered);
    }

    const directory = await unzipper.Open.buffer(file.buffer);
    const connection = await pool.getConnection();

    try {
        // Desativar restrições de chaves estrangeiras e iniciar transação
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');
        await connection.beginTransaction();

        for (const zFile of directory.files) {
            if (!zFile.path.endsWith('.csv')) continue;
            const rawTableName = zFile.path.replace('.csv', '').trim();
            
            // Validação estrita: apenas letras, números e underscores, presente na lista permitida
            if (!/^[a-zA-Z0-9_]+$/.test(rawTableName) || !allowedBaseTables.has(rawTableName)) {
                logger.warn(`[Restore] Ignorando arquivo não reconhecido ou tabela não autorizada: ${zFile.path}`);
                continue;
            }

            const tableName = rawTableName;
            
            if (tablesToRestore && !tablesToRestore.has(tableName)) {
                logger.info(`[Restore] Ignorando tabela não selecionada: ${tableName}`);
                continue;
            }
            
            logger.info(`[Restore] Restaurando tabela autorizada: ${tableName}`);
            
            // Limpa os dados existentes da tabela dentro da transação
            await connection.query(`DELETE FROM \`${tableName}\``);
            
            const buffer = await zFile.buffer();
            const content = buffer.toString('utf-8');
            
            const records: any[] = await new Promise((resolve, reject) => {
                parse(content, {
                    columns: true,
                    skip_empty_lines: true,
                    relax_column_count: true
                }, (err, data) => {
                    if (err) reject(err);
                    else resolve(data);
                });
            });

            if (records.length > 0) {
                // Valida as colunas do CSV contra as colunas reais da tabela no banco
                const [cols] = await connection.query<RowDataPacket[]>(`SHOW COLUMNS FROM \`${tableName}\``);
                const actualColumns = new Set((cols as any[]).map(c => c.Field as string));

                const rawCsvColumns = Object.keys(records[0]);
                const validColumns = rawCsvColumns.filter(c => /^[a-zA-Z0-9_]+$/.test(c) && actualColumns.has(c));

                if (validColumns.length === 0) {
                    logger.warn(`[Restore] Nenhuma coluna válida encontrada para a tabela: ${tableName}`);
                    continue;
                }
                
                const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
                const values = records.map(record => validColumns.map(col => {
                    const val = record[col];
                    if (val === '' || val === null || val === undefined) return null;
                    if (typeof val === 'string' && isoDateRegex.test(val)) {
                        return val.substring(0, 19).replace('T', ' ');
                    }
                    return val;
                }));
                
                // Inserir em lotes de 500 para performance e estabilidade
                const chunkSize = 500;
                for (let i = 0; i < values.length; i += chunkSize) {
                    const chunk = values.slice(i, i + chunkSize);
                    const escapedColumnList = validColumns.map(col => `\`${col}\``).join(', ');
                    const query = `INSERT INTO \`${tableName}\` (${escapedColumnList}) VALUES ?`;
                    await connection.query(query, [chunk]);
                }
            }
        }

        // Confirma a transação
        await connection.commit();
        logger.info(`[Restore] Backup restaurado com sucesso por usuário super admin ID ${req.user?.id || 'unknown'}`);
        return res.status(200).json({ status: 'success', message: 'Backup restaurado com sucesso' });

    } catch (error) {
        // Reverte qualquer modificação em caso de erro
        await connection.rollback();
        logger.error({ err: error }, '[Restore] Erro ao restaurar backup. Transação abortada.');
        return res.status(500).json({
            status: 'error',
            message: 'Erro interno ao restaurar backup: ' + (error instanceof Error ? error.message : String(error))
        });
    } finally {
        // Reativar restrições e liberar conexão
        try {
            await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        } catch (_e) {}
        connection.release();
    }
};
