import 'dotenv/config';
import { RowDataPacket } from 'mysql2/promise';
import pool from '../config/db';

const BUYER_MODULES = ['dashboard', 'purchases', 'suppliers', 'buyers'] as const;
const SERVICE_PROVIDER_MODULES = ['dashboard', 'service_providers'] as const;

type CompanyRow = RowDataPacket & {
    id: number;
};

type CountRow = RowDataPacket & {
    total: number;
};

async function ensureRoleModules(companyId: number, role: 'buyer' | 'service_provider', modules: readonly string[]) {
    const [rows] = await pool.query<CountRow[]>(
        `SELECT COUNT(*) AS total
         FROM role_permissions
         WHERE company_id = ? AND role = ?`,
        [companyId, role]
    );

    if (Number(rows[0]?.total || 0) > 0) {
        console.log(`[SKIP] ${role} permissions already exist for company ${companyId}`);
        return;
    }

    for (const module of modules) {
        await pool.query(
            `INSERT INTO role_permissions (company_id, role, module, can_view)
             VALUES (?, ?, ?, TRUE)`,
            [companyId, role, module]
        );
    }

    console.log(`[OK] default ${role} permissions created for company ${companyId}`);
}

export async function runMigration36(): Promise<void> {
    console.log('');
    console.log('┌──────────────────────────────────────────────────────────────┐');
    console.log('│  Migration 36: default people role permissions              │');
    console.log('└──────────────────────────────────────────────────────────────┘');
    console.log('');

    const [companies] = await pool.query<CompanyRow[]>(
        `SELECT id
         FROM companies
         WHERE is_system = FALSE
         ORDER BY id ASC`
    );

    for (const company of companies) {
        await ensureRoleModules(company.id, 'buyer', BUYER_MODULES);
        await ensureRoleModules(company.id, 'service_provider', SERVICE_PROVIDER_MODULES);
    }

    console.log('[OK] Migration 36 completed successfully.');
}

if (require.main === module) {
    runMigration36()
        .catch((error) => {
            console.error('[FAIL] Migration 36 failed:', error);
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
