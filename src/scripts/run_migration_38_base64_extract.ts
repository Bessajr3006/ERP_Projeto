import 'dotenv/config';
import pool from '../config/db';
import { StorageService } from '../utils/storageService';
import { RowDataPacket } from 'mysql2/promise';

export async function runMigration38(): Promise<void> {
    console.log('');
    console.log('┌──────────────────────────────────────────────────────────────┐');
    console.log('│  Migration 38: Extract Base64 PDFs/Certs to StorageService   │');
    console.log('└──────────────────────────────────────────────────────────────┘');
    console.log('');

    StorageService.ensureDirectories();

    const tables = ['companies', 'customers', 'suppliers'];
    const columnsToExtract = [
        { old: 'certificate_base64', new: 'certificate_url' },
        { old: 'social_contract_base64', new: 'social_contract_url' },
        { old: 'cnpj_document_base64', new: 'cnpj_document_url' }
    ];

    try {
        const conn = await pool.getConnection();
        try {
            await conn.query('SET SESSION innodb_strict_mode = OFF');
            
            for (const table of tables) {
                console.log(`\n[Processando Tabela] ${table}...`);
                
                // Verifica se a tabela tem as colunas
                const [cols] = await conn.query<RowDataPacket[]>('SHOW COLUMNS FROM ??', [table]);
                const colNames = cols.map(c => c.Field);

                for (const col of columnsToExtract) {
                    if (!colNames.includes(col.old)) {
                        console.log(`[SKIP] Coluna ${col.old} não existe em ${table}.`);
                        continue;
                    }

                    if (!colNames.includes(col.new)) {
                        console.log(`[ALTER] Adicionando coluna ${col.new} em ${table}...`);
                        await conn.query(`ALTER TABLE ?? ADD COLUMN ?? VARCHAR(500) DEFAULT NULL AFTER ??`, [table, col.new, col.old]);
                    }

                    // Faz a extração
                    const [rows] = await conn.query<RowDataPacket[]>(`SELECT id, ?? FROM ?? WHERE ?? IS NOT NULL AND ?? != ''`, [col.old, table, col.old, col.old]);
                    
                    if (rows.length > 0) {
                        console.log(`[EXTRACT] Encontrados ${rows.length} registros com ${col.old} na tabela ${table}. Salvando em disco...`);
                        
                        for (const row of rows) {
                            const base64Str = row[col.old];
                            let url = null;
                            
                            try {
                                const result = StorageService.saveBase64('documents', base64Str);
                                url = result ? result.url : null;
                            } catch (e: any) {
                                console.error(`- Erro ao salvar arquivo do ID ${row.id}: ${e.message}`);
                            }

                            if (url) {
                                await conn.query(`UPDATE ?? SET ?? = ?, ?? = NULL WHERE id = ?`, [table, col.new, url, col.old, row.id]);
                            }
                        }
                        console.log(`[OK] Extração da coluna ${col.old} em ${table} finalizada.`);
                    }

                    // Drop da antiga
                    console.log(`[DROP] Removendo coluna legada ${col.old} da tabela ${table}...`);
                    await conn.query('ALTER TABLE ?? ROW_FORMAT=DYNAMIC', [table]);
                    await conn.query(`ALTER TABLE ?? DROP COLUMN ??`, [table, col.old]);
                }
            }
        } finally {
            conn.release();
        }
    } catch (error: any) {
        console.error('[ERRO FATAL] Migration 38:', error);
        throw error;
    }

    console.log('\n[OK] Migration 38 completed successfully.');
}

if (require.main === module) {
    runMigration38()
        .catch((error) => {
            console.error('[FAIL] Migration 38 failed:', error);
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
