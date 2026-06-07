import 'dotenv/config';
import { RowDataPacket } from 'mysql2/promise';
import pool from '../config/db';

const SELLER_MODULES = ['dashboard', 'sales', 'customers', 'sellers'] as const;

type CompanyRow = RowDataPacket & {
    id: number;
};

type CountRow = RowDataPacket & {
    total: number;
};

export async function runMigration24(): Promise<void> {
    console.log('');
    console.log('┌──────────────────────────────────────────────────────────────┐');
    console.log('│  Migration 24: default seller role permissions              │');
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
             WHERE company_id = ? AND role = 'seller'`,
            [company.id]
        );

        const total = Number(rows[0]?.total || 0);
        if (total > 0) {
            console.log(`[SKIP] seller permissions already exist for company ${company.id}`);
            continue;
        }

        for (const module of SELLER_MODULES) {
            await pool.query(
                `INSERT INTO role_permissions (company_id, role, module, can_view)
                 VALUES (?, 'seller', ?, TRUE)`,
                [company.id, module]
            );
        }

        console.log(`[OK] default seller permissions created for company ${company.id}`);
    }

    console.log('[OK] Migration 24 completed successfully.');
}

if (require.main === module) {
    runMigration24()
        .catch((error) => {
            console.error('[FAIL] Migration 24 failed:', error);
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
