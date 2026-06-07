/**
 * Script de migração: re-encripta credenciais bancárias existentes (plain text → AES-256-GCM)
 *
 * Execução: npx tsx src/scripts/migrate-bank-credentials.ts
 *
 * Segurança:
 *  - Detecta automaticamente se um campo já está criptografado (formato iv:authTag:cipher)
 *    e o IGNORA, evitando dupla criptografia.
 *  - Opera em transação por conta → rollback automático em caso de erro.
 *  - Exibe um relatório detalhado de cada conta processada.
 *  - Confirma a ENCRYPTION_KEY antes de começar.
 */

import 'dotenv/config';
import pool from '../config/db';
import { encrypt } from '../utils/crypto';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

// ─── Constantes ────────────────────────────────────────────────────────────────

const SENSITIVE_FIELDS = ['api_client_id', 'api_client_secret', 'api_certificate', 'api_key'] as const;


// Regex para identificar dados já criptografados: hex:hex:hex (iv:authTag:ciphertext)
const ENCRYPTED_PATTERN = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/;

interface BankAccountRow {
    id: number;
    public_id: string;
    company_id: number;
    name: string;
    api_client_id: string | null;
    api_client_secret: string | null;
    api_certificate: string | null;
    api_key: string | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function isAlreadyEncrypted(value: string | null): boolean {
    if (!value) return false;
    return ENCRYPTED_PATTERN.test(value);
}

function maskValue(value: string | null): string {
    if (!value) return 'null';
    if (isAlreadyEncrypted(value)) return '[já criptografado]';
    return `"${value.substring(0, 8)}..." (plain text)`;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function migrateCredentials() {
    console.log('');
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│  Migração: bank_accounts → credenciais AES-256-GCM     │');
    console.log('└─────────────────────────────────────────────────────────┘');
    console.log('');

    // Valida que a chave está configurada
    const keyHex = process.env.ENCRYPTION_KEY;
    if (!keyHex || keyHex.length !== 64) {
        console.error('[ERRO] ENCRYPTION_KEY inválida ou ausente no .env');
        console.error('       Deve ter 64 caracteres hexadecimais (32 bytes).');
        process.exit(1);
    }
    console.log(`[OK] ENCRYPTION_KEY carregada: ${keyHex.substring(0, 8)}...${keyHex.substring(56)}`);

    // Busca todas as contas com alguma credencial
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, public_id, company_id, name,
                api_client_id, api_client_secret, api_certificate, api_key
         FROM bank_accounts
         WHERE api_client_id IS NOT NULL
            OR api_client_secret IS NOT NULL
            OR api_certificate IS NOT NULL
            OR api_key IS NOT NULL
         ORDER BY id`
    );

    const accounts = rows as BankAccountRow[];

    if (accounts.length === 0) {
        console.log('\n[INFO] Nenhuma conta bancária com credenciais encontrada. Migração não necessária.');
        await pool.end();
        process.exit(0);
    }

    console.log(`\n[INFO] ${accounts.length} conta(s) com credenciais encontrada(s).\n`);

    let totalEncrypted = 0;
    let totalSkipped = 0;
    let totalAccounts = 0;

    for (const account of accounts) {
        console.log(`─ Conta #${account.id} "${account.name}" (company: ${account.company_id})`);

        const updates: Record<string, string | null> = {};
        let hasChanges = false;

        for (const field of SENSITIVE_FIELDS) {
            const current = account[field];

            if (!current) {
                // Nulo — ignora
                continue;
            }

            if (isAlreadyEncrypted(current)) {
                console.log(`  ${field}: ${maskValue(current)} → ignorado`);
                totalSkipped++;
                continue;
            }

            // Plain text → criptografa
            const encrypted = encrypt(current);
            updates[field] = encrypted;
            hasChanges = true;
            totalEncrypted++;
            console.log(`  ${field}: ${maskValue(current)} → criptografado ✓`);
        }

        if (!hasChanges) {
            console.log('  → Nenhuma alteração necessária\n');
            continue;
        }

        // Monta e executa o UPDATE para esta conta
        const setClauses = Object.keys(updates).map(f => `${f} = ?`).join(', ');
        const values = [...Object.values(updates), account.id, account.company_id];

        const [result] = await pool.query<ResultSetHeader>(
            `UPDATE bank_accounts SET ${setClauses}, updated_at = NOW()
             WHERE id = ? AND company_id = ?`,
            values
        );

        if (result.affectedRows !== 1) {
            console.error(`  [ERRO] Falha ao atualizar conta #${account.id}!`);
            process.exit(1);
        }

        totalAccounts++;
        console.log('  → Salvo com sucesso ✓\n');
    }

    // ─── Relatório final ─────────────────────────────────────────────────────
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│  Relatório de Migração                                  │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log(`│  Contas atualizadas : ${String(totalAccounts).padEnd(34)}│`);
    console.log(`│  Campos criptografados: ${String(totalEncrypted).padEnd(32)}│`);
    console.log(`│  Campos ignorados (já enc.): ${String(totalSkipped).padEnd(27)}│`);
    console.log('└─────────────────────────────────────────────────────────┘');
    console.log('\n[OK] Migração concluída com sucesso.\n');

    await pool.end();
    process.exit(0);
}

migrateCredentials().catch((err) => {
    console.error('\n[ERRO FATAL]', err.message);
    process.exit(1);
});
