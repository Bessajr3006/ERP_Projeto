import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { DorsalConfig, CreateDorsalConfigData, UpdateDorsalConfigData } from '../types/Company';
import { ExternalDbService } from './externalDbService';

export class DorsalConfigService {
    static async list(companyId: number): Promise<DorsalConfig[]> {
        try {
            const [rows] = await pool.query<RowDataPacket[]>(
                'SELECT id, company_id, name, serv_dorsal, bd_dorsal, login_dorsal, senha_dorsal, cdfilial, cdpdv, is_default, created_at, updated_at FROM company_dorsal_configs WHERE company_id = ? ORDER BY is_default DESC, name ASC, id ASC',
                [companyId]
            );
            return rows as DorsalConfig[];
        } catch (err) {
            return [];
        }
    }

    static async getById(id: number, companyId: number): Promise<DorsalConfig | null> {
        try {
            const [rows] = await pool.query<RowDataPacket[]>(
                'SELECT id, company_id, name, serv_dorsal, bd_dorsal, login_dorsal, senha_dorsal, cdfilial, cdpdv, is_default, created_at, updated_at FROM company_dorsal_configs WHERE id = ? AND company_id = ? LIMIT 1',
                [id, companyId]
            );
            return (rows[0] as DorsalConfig) || null;
        } catch (err) {
            return null;
        }
    }

    static async create(companyId: number, data: CreateDorsalConfigData): Promise<DorsalConfig> {
        const name = (data.name || '').trim();
        const servDorsal = (data.serv_dorsal || '').trim();
        const bdDorsal = (data.bd_dorsal || '').trim();
        const loginDorsal = (data.login_dorsal || '').trim();
        const senhaDorsal = data.senha_dorsal || '';
        const cdfilial = data.cdfilial !== undefined ? (String(data.cdfilial || '').trim() || null) : null;
        const cdpdv = data.cdpdv !== undefined ? (String(data.cdpdv || '').trim() || null) : null;
        let isDefault = (data.is_default === true || data.is_default === 1 || String(data.is_default) === '1') ? 1 : 0;

        if (!name) {
            throw new Error('O nome da conexão é obrigatório.');
        }
        if (!servDorsal) {
            throw new Error('O servidor Dorsal (IP/Host) é obrigatório.');
        }
        if (!bdDorsal) {
            throw new Error('O banco de dados Dorsal é obrigatório.');
        }
        if (!loginDorsal) {
            throw new Error('O login Dorsal é obrigatório.');
        }

        // If this is the first config for this company, make it default automatically
        const [existing] = await pool.query<RowDataPacket[]>(
            'SELECT COUNT(*) as count FROM company_dorsal_configs WHERE company_id = ?',
            [companyId]
        );
        if ((existing[0]?.count || 0) === 0) {
            isDefault = 1;
        }

        if (isDefault) {
            await pool.query('UPDATE company_dorsal_configs SET is_default = 0 WHERE company_id = ?', [companyId]);
        }

        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO company_dorsal_configs (company_id, name, serv_dorsal, bd_dorsal, login_dorsal, senha_dorsal, cdfilial, cdpdv, is_default)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [companyId, name, servDorsal, bdDorsal, loginDorsal, senhaDorsal, cdfilial, cdpdv, isDefault]
        );

        if (isDefault) {
            await pool.query(
                `UPDATE companies 
                 SET serv_dorsal = ?, bd_dorsal = ?, login_dorsal = ?, senha_dorsal = ?,
                     cdfilial = COALESCE(?, cdfilial), cdpdv = COALESCE(?, cdpdv)
                 WHERE id = ?`,
                [servDorsal, bdDorsal, loginDorsal, senhaDorsal, cdfilial, cdpdv, companyId]
            );
        }

        const created = await this.getById(result.insertId, companyId);
        return created!;
    }

    static async update(companyId: number, id: number, data: UpdateDorsalConfigData): Promise<DorsalConfig> {
        const current = await this.getById(id, companyId);
        if (!current) {
            throw new Error('Configuração Dorsal não encontrada.');
        }

        const name = data.name !== undefined ? (data.name || '').trim() : current.name;
        const servDorsal = data.serv_dorsal !== undefined ? (data.serv_dorsal || '').trim() : current.serv_dorsal;
        const bdDorsal = data.bd_dorsal !== undefined ? (data.bd_dorsal || '').trim() : current.bd_dorsal;
        const loginDorsal = data.login_dorsal !== undefined ? (data.login_dorsal || '').trim() : current.login_dorsal;
        const senhaDorsal = (data.senha_dorsal !== undefined && data.senha_dorsal !== '') 
            ? data.senha_dorsal 
            : current.senha_dorsal;
        const cdfilial = data.cdfilial !== undefined ? (String(data.cdfilial || '').trim() || null) : current.cdfilial;
        const cdpdv = data.cdpdv !== undefined ? (String(data.cdpdv || '').trim() || null) : current.cdpdv;
        const isDefault = data.is_default !== undefined 
            ? ((data.is_default === true || data.is_default === 1 || String(data.is_default) === '1') ? 1 : 0) 
            : (current.is_default ? 1 : 0);

        if (!name) {
            throw new Error('O nome da conexão não pode ser vazio.');
        }
        if (!servDorsal) {
            throw new Error('O servidor Dorsal (IP/Host) não pode ser vazio.');
        }
        if (!bdDorsal) {
            throw new Error('O banco de dados Dorsal não pode ser vazio.');
        }
        if (!loginDorsal) {
            throw new Error('O login Dorsal não pode ser vazio.');
        }

        if (isDefault && !current.is_default) {
            await pool.query('UPDATE company_dorsal_configs SET is_default = 0 WHERE company_id = ?', [companyId]);
        }

        await pool.query(
            `UPDATE company_dorsal_configs 
              SET name = ?, serv_dorsal = ?, bd_dorsal = ?, login_dorsal = ?, senha_dorsal = ?, cdfilial = ?, cdpdv = ?, is_default = ?
              WHERE id = ? AND company_id = ?`,
            [name, servDorsal, bdDorsal, loginDorsal, senhaDorsal, cdfilial, cdpdv, isDefault, id, companyId]
        );

        if (isDefault) {
            await pool.query(
                `UPDATE companies 
                 SET serv_dorsal = ?, bd_dorsal = ?, login_dorsal = ?, senha_dorsal = ?,
                     cdfilial = COALESCE(?, cdfilial), cdpdv = COALESCE(?, cdpdv)
                 WHERE id = ?`,
                [servDorsal, bdDorsal, loginDorsal, senhaDorsal, cdfilial, cdpdv, companyId]
            );
        }

        const updated = await this.getById(id, companyId);
        return updated!;
    }

    static async delete(companyId: number, id: number): Promise<void> {
        const current = await this.getById(id, companyId);
        if (!current) {
            throw new Error('Configuração Dorsal não encontrada.');
        }

        await pool.query('DELETE FROM company_dorsal_configs WHERE id = ? AND company_id = ?', [id, companyId]);

        // If the deleted one was default, set another remaining one as default if exists
        if (current.is_default) {
            const [remaining] = await pool.query<RowDataPacket[]>(
                'SELECT id, serv_dorsal, bd_dorsal, login_dorsal, senha_dorsal, cdfilial, cdpdv FROM company_dorsal_configs WHERE company_id = ? ORDER BY id ASC LIMIT 1',
                [companyId]
            );
            if (remaining.length > 0 && remaining[0]) {
                const nextDefault = remaining[0];
                await pool.query('UPDATE company_dorsal_configs SET is_default = 1 WHERE id = ?', [nextDefault.id]);
                await pool.query(
                    `UPDATE companies 
                     SET serv_dorsal = ?, bd_dorsal = ?, login_dorsal = ?, senha_dorsal = ?,
                         cdfilial = COALESCE(?, cdfilial), cdpdv = COALESCE(?, cdpdv)
                     WHERE id = ?`,
                    [nextDefault.serv_dorsal, nextDefault.bd_dorsal, nextDefault.login_dorsal, nextDefault.senha_dorsal, nextDefault.cdfilial, nextDefault.cdpdv, companyId]
                );
            }
        }
    }

    static async testConnection(data: {
        serv_dorsal?: string;
        bd_dorsal?: string;
        login_dorsal?: string;
        senha_dorsal?: string;
    }): Promise<{ success: boolean; message: string; details?: any }> {
        return await ExternalDbService.testDorsalConnection({
            host: data.serv_dorsal,
            database: data.bd_dorsal,
            user: data.login_dorsal,
            password: data.senha_dorsal
        });
    }
}
