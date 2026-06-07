/**
 * Script de migração: move imagens base64 existentes do banco para disco
 *
 * Execução: npx tsx src/scripts/migrate-images.ts
 *
 * O que faz:
 *  1. Lê todos os produtos que têm image_base64 preenchido e image_url vazio
 *  2. Decodifica o base64, infere o formato (JPEG/PNG/WebP)
 *  3. Salva o arquivo em public/uploads/products/
 *  4. Atualiza image_url no banco
 *  5. Limpa image_base64 do banco (para economizar espaço)
 *
 * Segurança idempotente:
 *  - Produtos que já têm image_url preenchido são ignorados automaticamente
 *  - Cada produto é processado individualmente; falha em um não para os outros
 *
 * Para reverter: um rollback manual é necessário (apagar os arquivos gerados
 * e limpar image_url). Por isso o script exibe um log detalhado de cada arquivo.
 */

import 'dotenv/config';
import pool from '../config/db';
import { StorageService } from '../utils/storageService';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

interface ProductRow {
    id: number;
    public_id: string;
    company_id: number;
    name: string;
    image_base64: string;
}

async function migrateImages() {
    console.log('');
    console.log('┌─────────────────────────────────────────────────────────────────┐');
    console.log('│  Migração: products.image_base64 → disk (public/uploads/)       │');
    console.log('└─────────────────────────────────────────────────────────────────┘');
    console.log('');

    // Garante que os diretórios existam
    StorageService.ensureDirectories();

    // Busca produtos com base64 preenchido mas sem image_url ainda
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, public_id, company_id, name, image_base64
         FROM products
         WHERE image_base64 IS NOT NULL
           AND image_base64 != ''
           AND (image_url IS NULL OR image_url = '')
         ORDER BY id`
    );

    const products = rows as ProductRow[];

    if (products.length === 0) {
        console.log('[INFO] Nenhum produto com image_base64 para migrar. Nada a fazer.');
        await pool.end();
        process.exit(0);
    }

    console.log(`[INFO] ${products.length} produto(s) com imagem base64 encontrado(s).\n`);

    let totalMigrated = 0;
    let totalFailed = 0;
    let totalBytesFreed = 0;

    for (const product of products) {
        const label = `Produto #${product.id} "${product.name}" (company: ${product.company_id})`;
        process.stdout.write(`─ ${label} ... `);

        try {
            const base64Len = product.image_base64.length;

            // Salva no disco
            const saved = StorageService.saveBase64('products', product.image_base64);

            if (!saved) {
                console.log('IGNORADO (base64 vazio)');
                continue;
            }

            // Atualiza banco: grava image_url e limpa image_base64
            const [result] = await pool.query<ResultSetHeader>(
                `UPDATE products
                    SET image_url   = ?,
                        image_base64 = NULL
                  WHERE id = ? AND company_id = ?`,
                [saved.url, product.id, product.company_id]
            );

            if (result.affectedRows !== 1) {
                throw new Error('UPDATE não afetou nenhuma linha');
            }

            const approxBytes = Math.ceil(base64Len * 0.75); // base64 → bytes reais
            totalBytesFreed += approxBytes;
            totalMigrated++;

            console.log(`OK → ${saved.url} (~${(approxBytes / 1024).toFixed(1)} KB liberados)`);

        } catch (err: any) {
            console.log(`FALHOU — ${err.message}`);
            totalFailed++;
        }
    }

    // ─── Relatório ────────────────────────────────────────────────────────────
    const mbFreed = (totalBytesFreed / (1024 * 1024)).toFixed(2);

    console.log('');
    console.log('┌─────────────────────────────────────────────────────────────────┐');
    console.log('│  Relatório de Migração de Imagens                               │');
    console.log('├─────────────────────────────────────────────────────────────────┤');
    console.log(`│  Migrados com sucesso : ${String(totalMigrated).padEnd(41)}│`);
    console.log(`│  Falhas               : ${String(totalFailed).padEnd(41)}│`);
    console.log(`│  Espaço liberado no DB: ~${String(mbFreed + ' MB').padEnd(40)}│`);
    console.log('└─────────────────────────────────────────────────────────────────┘');

    if (totalFailed > 0) {
        console.log('\n[ATENÇÃO] Alguns produtos falharam. Verifique os logs acima.');
        console.log('          Re-execute o script para tentar novamente (idempotente).\n');
    } else {
        console.log('\n[OK] Migração concluída com sucesso.\n');
    }

    await pool.end();
    process.exit(totalFailed > 0 ? 1 : 0);
}

migrateImages().catch((err) => {
    console.error('\n[ERRO FATAL]', err.message);
    process.exit(1);
});
