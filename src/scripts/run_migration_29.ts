import 'dotenv/config';
import { RowDataPacket } from 'mysql2/promise';
import pool from '../config/db';

const ACCOUNTANT_MODULES = ['dashboard', 'company', 'accountant'] as const;

type CompanyRow = RowDataPacket & {
    id: number;
};

type CountRow = RowDataPacket & {
    total: number;
};

export async function runMigration29(): Promise<void> {
    console.log('');
    console.log('┌──────────────────────────────────────────────────────────────┐');
    console.log('│  Migration 29: default accountant role permissions          │');
    console.log('└──────────────────────────────────────────────────────────────┘');
    console.log('');

    const [companies] = await pool.query<CompanyRow[]>(
        `SELECT id
         FROM companies
         WHERE is_system = FALSE
         ORDER BY id ASC`
    );

    for (const company of companies) {
        const [rows] = await pool.query<CountRow[]>(
            `SELECT COUNT(*) AS total
             FROM role_permissions
             WHERE company_id = ? AND role = 'accountant'`,
            [company.id]
        );

        if (Number(rows[0]?.total || 0) > 0) {
            console.log(`[SKIP] accountant permissions already exist for company ${company.id}`);
            continue;
        }

        for (const module of ACCOUNTANT_MODULES) {
            await pool.query(
                `INSERT INTO role_permissions (company_id, role, module, can_view)
                 VALUES (?, 'accountant', ?, TRUE)`,
                [company.id, module]
            );
        }

        console.log(`[OK] default accountant permissions created for company ${company.id}`);
    }

    console.log('[OK] Migration 29 completed successfully.');
}

if (require.main === module) {
    runMigration29()
        .catch((error) => {
            console.error('[FAIL] Migration 29 failed:', error);
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
