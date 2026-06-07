import 'dotenv/config';
import { RowDataPacket } from 'mysql2/promise';
import pool from '../config/db';

const TARGET_MODULES = ['buyers', 'service_providers'] as const;
const TARGET_ROLES = ['admin', 'super_admin'] as const;

type CompanyRow = RowDataPacket & {
    id: number;
    is_system: 0 | 1 | boolean;
};

type CountRow = RowDataPacket & {
    total: number;
};

export async function runMigration35(): Promise<void> {
    console.log('');
    console.log('┌──────────────────────────────────────────────────────────────┐');
    console.log('│  Migration 35: people modules for admin menus               │');
    console.log('└──────────────────────────────────────────────────────────────┘');
    console.log('');

    const [companies] = await pool.query<CompanyRow[]>(
        `SELECT id, is_system
         FROM companies
         ORDER BY id ASC`
    );

    for (const company of companies) {
        for (const role of TARGET_ROLES) {
            if (role === 'super_admin' && !company.is_system) {
                continue;
            }

            if (role !== 'super_admin' && company.is_system) {
                continue;
            }

            for (const module of TARGET_MODULES) {
                const [rows] = await pool.query<CountRow[]>(
                    `SELECT COUNT(*) AS total
                     FROM role_permissions
                     WHERE company_id = ? AND role = ? AND module = ?`,
                    [company.id, role, module]
                );

                if (Number(rows[0]?.total || 0) > 0) {
                    console.log(`[SKIP] ${module} already granted for role ${role} in company ${company.id}`);
                    continue;
                }

                await pool.query(
                    `INSERT INTO role_permissions (company_id, role, module, can_view)
                     VALUES (?, ?, ?, TRUE)`,
                    [company.id, role, module]
                );

                console.log(`[OK] ${module} granted for role ${role} in company ${company.id}`);
            }
        }
    }

    console.log('[OK] Migration 35 completed successfully.');
}

if (require.main === module) {
    runMigration35()
        .catch((error) => {
            console.error('[FAIL] Migration 35 failed:', error);
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
