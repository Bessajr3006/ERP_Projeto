import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { SolidconConfig, CreateSolidconConfigData, UpdateSolidconConfigData } from '../types/Company';
import { ExternalDbService } from './externalDbService';
import { encrypt, decrypt } from '../utils/crypto';

export class SolidconConfigService {
    static async list(companyId: number): Promise<SolidconConfig[]> {
        try {
            const [rows] = await pool.query<RowDataPacket[]>(
                'SELECT id, company_id, name, serv_solidcon, bd_solidcon, login_solidcon, senha_solidcon, cdfilial, cdpdv, is_default, created_at, updated_at FROM company_solidcon_configs WHERE company_id = ? ORDER BY is_default DESC, name ASC, id ASC',
                [companyId]
            );
            return (rows as SolidconConfig[]).map(r => ({
                ...r,
                senha_solidcon: r.senha_solidcon ? (decrypt(r.senha_solidcon) ?? '') : ''
            }));
        } catch (err) {
            return [];
        }
    }

    static async getById(id: number, companyId: number): Promise<SolidconConfig | null> {
        try {
            const [rows] = await pool.query<RowDataPacket[]>(
                'SELECT id, company_id, name, serv_solidcon, bd_solidcon, login_solidcon, senha_solidcon, cdfilial, cdpdv, is_default, created_at, updated_at FROM company_solidcon_configs WHERE id = ? AND company_id = ? LIMIT 1',
                [id, companyId]
            );
            if (!rows || rows.length === 0) return null;
            const config = rows[0] as SolidconConfig;
            if (config.senha_solidcon) {
                config.senha_solidcon = decrypt(config.senha_solidcon) ?? '';
            }
            return config;
        } catch (err) {
            return null;
        }
    }

    static async create(companyId: number, data: CreateSolidconConfigData): Promise<SolidconConfig> {
        const name = (data.name || '').trim();
        const servSolidcon = (data.serv_solidcon || '').trim();
        const bdSolidcon = (data.bd_solidcon || '').trim();
        const loginSolidcon = (data.login_solidcon || '').trim();
        const rawSenha = data.senha_solidcon || '';
        const senhaSolidcon = rawSenha ? encrypt(rawSenha) : '';
        const cdfilial = data.cdfilial !== undefined ? (String(data.cdfilial || '').trim() || null) : null;
        const cdpdv = data.cdpdv !== undefined ? (String(data.cdpdv || '').trim() || null) : null;
        let isDefault = (data.is_default === true || data.is_default === 1 || String(data.is_default) === '1') ? 1 : 0;

        if (!name) {
            throw new Error('O nome da conexão é obrigatório.');
        }
        if (!servSolidcon) {
            throw new Error('O servidor Solidcon (IP/Host) é obrigatório.');
        }
        if (!bdSolidcon) {
            throw new Error('O banco de dados Solidcon é obrigatório.');
        }
        if (!loginSolidcon) {
            throw new Error('O login Solidcon é obrigatório.');
        }

        // If this is the first config for this company, make it default automatically
        const [existing] = await pool.query<RowDataPacket[]>(
            'SELECT COUNT(*) as count FROM company_solidcon_configs WHERE company_id = ?',
            [companyId]
        );
        if ((existing[0]?.count || 0) === 0) {
            isDefault = 1;
        }

        if (isDefault) {
            await pool.query('UPDATE company_solidcon_configs SET is_default = 0 WHERE company_id = ?', [companyId]);
        }

        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO company_solidcon_configs (company_id, name, serv_solidcon, bd_solidcon, login_solidcon, senha_solidcon, cdfilial, cdpdv, is_default)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [companyId, name, servSolidcon, bdSolidcon, loginSolidcon, senhaSolidcon, cdfilial, cdpdv, isDefault]
        );

        if (isDefault) {
            await pool.query(
                `UPDATE companies 
                 SET serv_solidcon = ?, bd_solidcon = ?, login_solidcon = ?, senha_solidcon = ?,
                     cdfilial = COALESCE(?, cdfilial), cdpdv = COALESCE(?, cdpdv)
                 WHERE id = ?`,
                [servSolidcon, bdSolidcon, loginSolidcon, senhaSolidcon, cdfilial, cdpdv, companyId]
            );
        }

        const created = await this.getById(result.insertId, companyId);
        return created!;
    }

    static async update(companyId: number, id: number, data: UpdateSolidconConfigData): Promise<SolidconConfig> {
        const current = await this.getById(id, companyId);
        if (!current) {
            throw new Error('Configuração Solidcon não encontrada.');
        }

        const name = data.name !== undefined ? (data.name || '').trim() : current.name;
        const servSolidcon = data.serv_solidcon !== undefined ? (data.serv_solidcon || '').trim() : current.serv_solidcon;
        const bdSolidcon = data.bd_solidcon !== undefined ? (data.bd_solidcon || '').trim() : current.bd_solidcon;
        const loginSolidcon = data.login_solidcon !== undefined ? (data.login_solidcon || '').trim() : current.login_solidcon;
        const rawSenha = (data.senha_solidcon !== undefined && data.senha_solidcon !== '') 
            ? data.senha_solidcon 
            : current.senha_solidcon;
        const senhaSolidcon = rawSenha ? encrypt(rawSenha) : '';
        const cdfilial = data.cdfilial !== undefined ? (String(data.cdfilial || '').trim() || null) : current.cdfilial;
        const cdpdv = data.cdpdv !== undefined ? (String(data.cdpdv || '').trim() || null) : current.cdpdv;
        const isDefault = data.is_default !== undefined 
            ? ((data.is_default === true || data.is_default === 1 || String(data.is_default) === '1') ? 1 : 0) 
            : (current.is_default ? 1 : 0);

        if (!name) {
            throw new Error('O nome da conexão não pode ser vazio.');
        }
        if (!servSolidcon) {
            throw new Error('O servidor Solidcon (IP/Host) não pode ser vazio.');
        }
        if (!bdSolidcon) {
            throw new Error('O banco de dados Solidcon não pode ser vazio.');
        }
        if (!loginSolidcon) {
            throw new Error('O login Solidcon não pode ser vazio.');
        }

        if (isDefault && !current.is_default) {
            await pool.query('UPDATE company_solidcon_configs SET is_default = 0 WHERE company_id = ?', [companyId]);
        }

        await pool.query(
            `UPDATE company_solidcon_configs 
              SET name = ?, serv_solidcon = ?, bd_solidcon = ?, login_solidcon = ?, senha_solidcon = ?, cdfilial = ?, cdpdv = ?, is_default = ?
              WHERE id = ? AND company_id = ?`,
            [name, servSolidcon, bdSolidcon, loginSolidcon, senhaSolidcon, cdfilial, cdpdv, isDefault, id, companyId]
        );

        if (isDefault) {
            await pool.query(
                `UPDATE companies 
                 SET serv_solidcon = ?, bd_solidcon = ?, login_solidcon = ?, senha_solidcon = ?,
                     cdfilial = COALESCE(?, cdfilial), cdpdv = COALESCE(?, cdpdv)
                 WHERE id = ?`,
                [servSolidcon, bdSolidcon, loginSolidcon, senhaSolidcon, cdfilial, cdpdv, companyId]
            );
        }

        const updated = await this.getById(id, companyId);
        return updated!;
    }

    static async delete(companyId: number, id: number): Promise<void> {
        const current = await this.getById(id, companyId);
        if (!current) {
            throw new Error('Configuração Solidcon não encontrada.');
        }

        await pool.query('DELETE FROM company_solidcon_configs WHERE id = ? AND company_id = ?', [id, companyId]);

        // If the deleted one was default, set another remaining one as default if exists
        if (current.is_default) {
            const [remaining] = await pool.query<RowDataPacket[]>(
                'SELECT id, serv_solidcon, bd_solidcon, login_solidcon, senha_solidcon, cdfilial, cdpdv FROM company_solidcon_configs WHERE company_id = ? ORDER BY id ASC LIMIT 1',
                [companyId]
            );
            if (remaining.length > 0 && remaining[0]) {
                const nextDefault = remaining[0];
                await pool.query('UPDATE company_solidcon_configs SET is_default = 1 WHERE id = ?', [nextDefault.id]);
                await pool.query(
                    `UPDATE companies 
                     SET serv_solidcon = ?, bd_solidcon = ?, login_solidcon = ?, senha_solidcon = ?,
                         cdfilial = COALESCE(?, cdfilial), cdpdv = COALESCE(?, cdpdv)
                     WHERE id = ?`,
                    [nextDefault.serv_solidcon, nextDefault.bd_solidcon, nextDefault.login_solidcon, nextDefault.senha_solidcon, nextDefault.cdfilial, nextDefault.cdpdv, companyId]
                );
            }
        }
    }

    static async testConnection(data: {
        serv_solidcon?: string;
        bd_solidcon?: string;
        login_solidcon?: string;
        senha_solidcon?: string;
    }): Promise<{ success: boolean; message: string; details?: any }> {
        const rawPassword = data.senha_solidcon ? decrypt(data.senha_solidcon) : data.senha_solidcon;
        return await ExternalDbService.testSolidconConnection({
            host: data.serv_solidcon,
            database: data.bd_solidcon,
            user: data.login_solidcon,
            password: rawPassword
        });
    }
}
