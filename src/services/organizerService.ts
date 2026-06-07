import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool from '../config/db';
import { OrganizerState, OrganizerStateRecord } from '../types/Organizer';

type OrganizerStateRow = RowDataPacket & {
    company_id: number;
    state_json: string;
    created_at: Date | string;
    updated_at: Date | string;
};

function parseState(value: string): OrganizerState {
    try {
        const parsed = JSON.parse(value);
        if (parsed && Array.isArray(parsed.boards)) {
            return parsed as OrganizerState;
        }
    } catch (_error) {
        // fall through
    }

    return { boards: [] };
}

function mapState(row: OrganizerStateRow): OrganizerStateRecord {
    return {
        company_id: row.company_id,
        state: parseState(row.state_json),
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

export class OrganizerService {
    static async getByCompany(companyId: number): Promise<OrganizerStateRecord | null> {
        const [rows] = await pool.query<OrganizerStateRow[]>(
            `SELECT company_id, state_json, created_at, updated_at FROM organizer_states WHERE company_id = ? LIMIT 1`,
            [companyId]
        );

        const row = rows[0];
        return row ? mapState(row) : null;
    }

    static async upsert(companyId: number, state: OrganizerState): Promise<OrganizerStateRecord> {
        await pool.query<ResultSetHeader>(
            `INSERT INTO organizer_states (company_id, state_json)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE state_json = VALUES(state_json), updated_at = NOW()`,
            [companyId, JSON.stringify(state)]
        );

        const saved = await this.getByCompany(companyId);
        if (!saved) {
            return {
                company_id: companyId,
                state,
                created_at: new Date(),
                updated_at: new Date(),
            };
        }

        return saved;
    }
}