import pool from '../config/db';
import { RowDataPacket } from 'mysql2/promise';

export class PermissionRepository {
    static async getByRole(companyId: number, role: string) {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT module, can_view FROM role_permissions WHERE company_id = ? AND role = ?',
            [companyId, role]
        );
        return rows;
    }

    static async updateByRole(companyId: number, role: string, permissions: { module: string, can_view: boolean }[]) {
        const conn = await pool.getConnection();
        
        try {
            await conn.beginTransaction();

            await conn.query(
                'DELETE FROM role_permissions WHERE company_id = ? AND role = ?',
                [companyId, role]
            );

            if (permissions && permissions.length > 0) {
                const values = permissions.map(p => [companyId, role, p.module, p.can_view ? 1 : 0]);
                await conn.query(
                    'INSERT INTO role_permissions (company_id, role, module, can_view) VALUES ?',
                    [values]
                );
            }

            await conn.commit();
            return true;
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    static async updateByRoleAllCompanies(role: string, permissions: { module: string, can_view: boolean }[], includeCompanyId?: number) {
        const conn = await pool.getConnection();

        try {
            await conn.beginTransaction();

            const [companyRows] = await conn.query<RowDataPacket[]>(
                `SELECT id FROM companies WHERE is_system = FALSE OR id = ?`,
                [includeCompanyId || 0]
            );

            if (!companyRows.length) {
                await conn.commit();
                return { updatedCompanies: 0 };
            }

            const companyIds = Array.from(new Set(companyRows.map((row) => Number(row.id))));

            await conn.query(
                `DELETE FROM role_permissions WHERE role = ? AND company_id IN (?)`,
                [role, companyIds]
            );

            if (permissions && permissions.length > 0) {
                const values: Array<[number, string, string, number]> = [];
                for (const companyId of companyIds) {
                    for (const permission of permissions) {
                        values.push([companyId, role, permission.module, permission.can_view ? 1 : 0]);
                    }
                }

                await conn.query(
                    'INSERT INTO role_permissions (company_id, role, module, can_view) VALUES ?',
                    [values]
                );
            }

            await conn.commit();
            return { updatedCompanies: companyIds.length };
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }
}