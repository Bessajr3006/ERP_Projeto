import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { AlterdataConfig, CreateAlterdataConfigData, UpdateAlterdataConfigData } from '../types/Company';
import { ExternalDbService } from './externalDbService';
import { encrypt, decrypt } from '../utils/crypto';

export class AlterdataConfigService {
    static async list(companyId: number): Promise<AlterdataConfig[]> {
        try {
            const [rows] = await pool.query<RowDataPacket[]>(
                'SELECT id, company_id, name, serv_alterdata, porta_alterdata, bd_alterdata, cdempresa_alterdata, login_alterdata, senha_alterdata, is_default, created_at, updated_at FROM company_alterdata_configs WHERE company_id = ? ORDER BY is_default DESC, name ASC, id ASC',
                [companyId]
            );
            return (rows as AlterdataConfig[]).map(r => ({
                ...r,
                senha_alterdata: r.senha_alterdata ? (decrypt(r.senha_alterdata) ?? '') : ''
            }));
        } catch (err) {
            return [];
        }
    }

    static async getById(id: number, companyId: number): Promise<AlterdataConfig | null> {
        try {
            const [rows] = await pool.query<RowDataPacket[]>(
                'SELECT id, company_id, name, serv_alterdata, porta_alterdata, bd_alterdata, cdempresa_alterdata, login_alterdata, senha_alterdata, is_default, created_at, updated_at FROM company_alterdata_configs WHERE id = ? AND company_id = ? LIMIT 1',
                [id, companyId]
            );
            if (!rows || rows.length === 0) return null;
            const config = rows[0] as AlterdataConfig;
            if (config.senha_alterdata) {
                config.senha_alterdata = decrypt(config.senha_alterdata) ?? '';
            }
            return config;
        } catch (err) {
            return null;
        }
    }

    static async create(companyId: number, data: CreateAlterdataConfigData): Promise<AlterdataConfig> {
        const name = (data.name || '').trim();
        const servAlterdata = (data.serv_alterdata || '').trim();
        const portaAlterdata = (data.porta_alterdata || '1433').trim();
        const bdAlterdata = (data.bd_alterdata || '').trim();
        const cdempresaAlterdata = data.cdempresa_alterdata !== undefined ? (String(data.cdempresa_alterdata || '').trim() || null) : null;
        const loginAlterdata = (data.login_alterdata || '').trim();
        const rawSenha = data.senha_alterdata || '';
        const senhaAlterdata = rawSenha ? encrypt(rawSenha) : '';
        let isDefault = (data.is_default === true || data.is_default === 1 || String(data.is_default) === '1') ? 1 : 0;

        if (!name) {
            throw new Error('O nome da conexão é obrigatório.');
        }
        if (!servAlterdata) {
            throw new Error('O servidor Alterdata (IP/Host) é obrigatório.');
        }
        if (!bdAlterdata) {
            throw new Error('O banco de dados Alterdata é obrigatório.');
        }
        if (!loginAlterdata) {
            throw new Error('O login Alterdata é obrigatório.');
        }

        // If this is the first config for this company, make it default automatically
        const [existing] = await pool.query<RowDataPacket[]>(
            'SELECT COUNT(*) as count FROM company_alterdata_configs WHERE company_id = ?',
            [companyId]
        );
        if ((existing[0]?.count || 0) === 0) {
            isDefault = 1;
        }

        if (isDefault) {
            await pool.query('UPDATE company_alterdata_configs SET is_default = 0 WHERE company_id = ?', [companyId]);
        }

        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO company_alterdata_configs (company_id, name, serv_alterdata, porta_alterdata, bd_alterdata, cdempresa_alterdata, login_alterdata, senha_alterdata, is_default)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [companyId, name, servAlterdata, portaAlterdata, bdAlterdata, cdempresaAlterdata, loginAlterdata, senhaAlterdata, isDefault]
        );

        if (isDefault) {
            await pool.query(
                `UPDATE companies 
                 SET serv_alterdata = ?, porta_alterdata = ?, bd_alterdata = ?, cdempresa_alterdata = ?, login_alterdata = ?, senha_alterdata = ?
                 WHERE id = ?`,
                [servAlterdata, portaAlterdata, bdAlterdata, cdempresaAlterdata, loginAlterdata, senhaAlterdata, companyId]
            );
        }

        const created = await this.getById(result.insertId, companyId);
        return created!;
    }

    static async update(companyId: number, id: number, data: UpdateAlterdataConfigData): Promise<AlterdataConfig> {
        const current = await this.getById(id, companyId);
        if (!current) {
            throw new Error('Configuração Alterdata não encontrada.');
        }

        const name = data.name !== undefined ? (data.name || '').trim() : current.name;
        const servAlterdata = data.serv_alterdata !== undefined ? (data.serv_alterdata || '').trim() : current.serv_alterdata;
        const portaAlterdata = data.porta_alterdata !== undefined ? (data.porta_alterdata || '1433').trim() : (current.porta_alterdata || '1433');
        const bdAlterdata = data.bd_alterdata !== undefined ? (data.bd_alterdata || '').trim() : current.bd_alterdata;
        const cdempresaAlterdata = data.cdempresa_alterdata !== undefined ? (String(data.cdempresa_alterdata || '').trim() || null) : current.cdempresa_alterdata;
        const loginAlterdata = data.login_alterdata !== undefined ? (data.login_alterdata || '').trim() : current.login_alterdata;
        const rawSenha = (data.senha_alterdata !== undefined && data.senha_alterdata !== '') 
            ? data.senha_alterdata 
            : current.senha_alterdata;
        const senhaAlterdata = rawSenha ? encrypt(rawSenha) : '';
        const isDefault = data.is_default !== undefined 
            ? ((data.is_default === true || data.is_default === 1 || String(data.is_default) === '1') ? 1 : 0) 
            : (current.is_default ? 1 : 0);

        if (!name) {
            throw new Error('O nome da conexão não pode ser vazio.');
        }
        if (!servAlterdata) {
            throw new Error('O servidor Alterdata (IP/Host) não pode ser vazio.');
        }
        if (!bdAlterdata) {
            throw new Error('O banco de dados Alterdata não pode ser vazio.');
        }
        if (!loginAlterdata) {
            throw new Error('O login Alterdata não pode ser vazio.');
        }

        if (isDefault && !current.is_default) {
            await pool.query('UPDATE company_alterdata_configs SET is_default = 0 WHERE company_id = ?', [companyId]);
        }

        await pool.query(
            `UPDATE company_alterdata_configs 
              SET name = ?, serv_alterdata = ?, porta_alterdata = ?, bd_alterdata = ?, cdempresa_alterdata = ?, login_alterdata = ?, senha_alterdata = ?, is_default = ?
              WHERE id = ? AND company_id = ?`,
            [name, servAlterdata, portaAlterdata, bdAlterdata, cdempresaAlterdata, loginAlterdata, senhaAlterdata, isDefault, id, companyId]
        );

        if (isDefault) {
            await pool.query(
                `UPDATE companies 
                 SET serv_alterdata = ?, porta_alterdata = ?, bd_alterdata = ?, cdempresa_alterdata = ?, login_alterdata = ?, senha_alterdata = ?
                 WHERE id = ?`,
                [servAlterdata, portaAlterdata, bdAlterdata, cdempresaAlterdata, loginAlterdata, senhaAlterdata, companyId]
            );
        }

        const updated = await this.getById(id, companyId);
        return updated!;
    }

    static async delete(companyId: number, id: number): Promise<void> {
        const current = await this.getById(id, companyId);
        if (!current) {
            throw new Error('Configuração Alterdata não encontrada.');
        }

        await pool.query('DELETE FROM company_alterdata_configs WHERE id = ? AND company_id = ?', [id, companyId]);

        // If the deleted one was default, set another remaining one as default if exists
        if (current.is_default) {
            const [remaining] = await pool.query<RowDataPacket[]>(
                'SELECT id, serv_alterdata, porta_alterdata, bd_alterdata, cdempresa_alterdata, login_alterdata, senha_alterdata FROM company_alterdata_configs WHERE company_id = ? ORDER BY id ASC LIMIT 1',
                [companyId]
            );
            if (remaining.length > 0 && remaining[0]) {
                const nextDefault = remaining[0];
                await pool.query('UPDATE company_alterdata_configs SET is_default = 1 WHERE id = ?', [nextDefault.id]);
                await pool.query(
                    `UPDATE companies 
                     SET serv_alterdata = ?, porta_alterdata = ?, bd_alterdata = ?, cdempresa_alterdata = ?, login_alterdata = ?, senha_alterdata = ?
                     WHERE id = ?`,
                    [nextDefault.serv_alterdata, nextDefault.porta_alterdata, nextDefault.bd_alterdata, nextDefault.cdempresa_alterdata, nextDefault.login_alterdata, nextDefault.senha_alterdata, companyId]
                );
            }
        }
    }

    static async testConnection(data: {
        serv_alterdata?: string;
        porta_alterdata?: string;
        bd_alterdata?: string;
        login_alterdata?: string;
        senha_alterdata?: string;
    }): Promise<{ success: boolean; message: string; details?: any }> {
        const rawPassword = data.senha_alterdata ? decrypt(data.senha_alterdata) : data.senha_alterdata;
        return await ExternalDbService.testAlterdataConnection({
            host: data.serv_alterdata,
            port: data.porta_alterdata,
            database: data.bd_alterdata,
            user: data.login_alterdata,
            password: rawPassword
        });
    }
}
