
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';

export type SefazJobRow = RowDataPacket & {
    id: number;
    company_id: number;
    type: string;
    payload: any;
    status: string;
    result: any;
};

export class SefazJobRepository {
    static async withTransaction<T>(callback: (conn: PoolConnection) => Promise<T>): Promise<T> {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            const result = await callback(conn);
            await conn.commit();
            return result;
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    static async enqueueJob(companyId: number, type: string, payload: any): Promise<number> {
        const [result] = await pool.query<ResultSetHeader>(
            'INSERT INTO sefaz_jobs (company_id, type, payload, status) VALUES (?, ?, ?, ?)',
            [companyId, type, JSON.stringify(payload), 'pending']
        );
        return result.insertId;
    }

    static async lockNextPendingJob(conn: PoolConnection): Promise<SefazJobRow | null> {
        const [rows] = await conn.query<SefazJobRow[]>(
            "SELECT * FROM sefaz_jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1 FOR UPDATE"
        );
        const job = rows[0];
        if (!job) return null;

        await conn.query("UPDATE sefaz_jobs SET status = 'processing' WHERE id = ?", [job.id]);
        return job;
    }

    static async markJobCompleted(id: number, resultData: any): Promise<void> {
        await pool.query(
            "UPDATE sefaz_jobs SET status = 'completed', result = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?",
            [JSON.stringify(resultData), id]
        );
    }

    static async markJobFailed(id: number, errorMsg: string): Promise<void> {
        await pool.query(
            "UPDATE sefaz_jobs SET status = 'failed', error_message = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?",
            [errorMsg, id]
        );
    }

    static async getPendingJobsCountByCompany(companyId: number): Promise<number> {
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT COUNT(*) as total FROM sefaz_jobs WHERE company_id = ? AND status IN ('pending', 'processing')",
            [companyId]
        );
        return (rows[0] as any).total;
    }
}
