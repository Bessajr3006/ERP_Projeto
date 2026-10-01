import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface PosControlConfig {
    id: number;
    company_id: number;
    subscription_key: string | null;
    ocp_apim_subscription_key: string | null;
    url_token: string | null;
    url_productgroups_post: string | null;
    poscontrol_username: string | null;
    poscontrol_password: string | null;
    created_at?: Date;
    updated_at?: Date;
}

export class PosControlConfigService {
    static async list(companyId: number): Promise<PosControlConfig[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM company_poscontrol_configs WHERE company_id = ? ORDER BY id DESC',
            [companyId]
        );
        return (rows as PosControlConfig[]).map(config => {
            if (!config.ocp_apim_subscription_key && config.subscription_key) {
                config.ocp_apim_subscription_key = config.subscription_key;
            }
            return config;
        });
    }

    static async getById(companyId: number, id: number): Promise<PosControlConfig | null> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM company_poscontrol_configs WHERE id = ? AND company_id = ? LIMIT 1',
            [id, companyId]
        );
        if (!rows || rows.length === 0) return null;
        const config = rows[0] as PosControlConfig;
        if (!config.ocp_apim_subscription_key && config.subscription_key) {
            config.ocp_apim_subscription_key = config.subscription_key;
        }
        return config;
    }

    static async create(companyId: number, data: { subscription_key?: string | null, ocp_apim_subscription_key?: string | null, url_token?: string | null, url_productgroups_post?: string | null, poscontrol_username?: string | null, poscontrol_password?: string | null }): Promise<PosControlConfig> {
        const [result] = await pool.query<ResultSetHeader>(
            'INSERT INTO company_poscontrol_configs (company_id, subscription_key, ocp_apim_subscription_key, url_token, url_productgroups_post, poscontrol_username, poscontrol_password) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [companyId, data.subscription_key || null, data.ocp_apim_subscription_key || null, data.url_token || null, data.url_productgroups_post || null, data.poscontrol_username || null, data.poscontrol_password || null]
        );
        const newId = result.insertId;
        const config = await this.getById(companyId, newId);
        if (!config) throw new Error('Failed to create PosControl config');
        return config;
    }

    static async update(companyId: number, id: number, data: { subscription_key?: string | null, ocp_apim_subscription_key?: string | null, url_token?: string | null, url_productgroups_post?: string | null, poscontrol_username?: string | null, poscontrol_password?: string | null }): Promise<PosControlConfig> {
        const existing = await this.getById(companyId, id);
        if (!existing) throw new Error('Config not found');

        const subKey = data.subscription_key !== undefined ? data.subscription_key : existing.subscription_key;
        const ocpKey = data.ocp_apim_subscription_key !== undefined ? data.ocp_apim_subscription_key : existing.ocp_apim_subscription_key;
        const urlTok = data.url_token !== undefined ? data.url_token : existing.url_token;
        const urlPgPost = data.url_productgroups_post !== undefined ? data.url_productgroups_post : existing.url_productgroups_post;
        const uName = data.poscontrol_username !== undefined ? data.poscontrol_username : existing.poscontrol_username;
        const uPass = data.poscontrol_password !== undefined ? data.poscontrol_password : existing.poscontrol_password;

        await pool.query(
            'UPDATE company_poscontrol_configs SET subscription_key = ?, ocp_apim_subscription_key = ?, url_token = ?, url_productgroups_post = ?, poscontrol_username = ?, poscontrol_password = ? WHERE id = ? AND company_id = ?',
            [subKey || null, ocpKey || null, urlTok || null, urlPgPost || null, uName || null, uPass || null, id, companyId]
        );

        const updated = await this.getById(companyId, id);
        if (!updated) throw new Error('Failed to update PosControl config');
        return updated;
    }

    static async delete(companyId: number, id: number): Promise<void> {
        const existing = await this.getById(companyId, id);
        if (!existing) throw new Error('Config not found');

        await pool.query(
            'DELETE FROM company_poscontrol_configs WHERE id = ? AND company_id = ?',
            [id, companyId]
        );
    }
}
