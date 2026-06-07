import pool from '../config/db';
import { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';

export type JobRow = RowDataPacket & {
    id: number;
    type: string;
    payload: any;
    status: string;
};

export class WhatsappJobRepository {
    /**
     * Executes a callback within a database transaction.
     */
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

    /**
     * Add a job to the queue
     */
    static async enqueueJob(type: string, payload: any): Promise<number> {
        const [result] = await pool.query<ResultSetHeader>(
            'INSERT INTO whatsapp_jobs (type, payload, status) VALUES (?, ?, ?)',
            [type, JSON.stringify(payload), 'pending']
        );
        return result.insertId;
    }

    /**
     * Fetch the next pending job safely within a transaction lock
     */
    static async lockNextPendingJob(conn: PoolConnection): Promise<JobRow | null> {
        const [rows] = await conn.query<JobRow[]>(
            "SELECT * FROM whatsapp_jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1 FOR UPDATE"
        );
        const job = rows[0];
        if (!job) return null;

        await conn.query("UPDATE whatsapp_jobs SET status = 'processing' WHERE id = ?", [job.id]);
        return job;
    }

    /**
     * Mark a job as completed
     */
    static async markJobCompleted(id: number): Promise<void> {
        await pool.query(
            "UPDATE whatsapp_jobs SET status = 'completed', processed_at = CURRENT_TIMESTAMP WHERE id = ?",
            [id]
        );
    }

    /**
     * Mark a job as failed with an error message
     */
    static async markJobFailed(id: number, errorMsg: string): Promise<void> {
        await pool.query(
            "UPDATE whatsapp_jobs SET status = 'failed', error_message = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?",
            [errorMsg, id]
        );
    }
}