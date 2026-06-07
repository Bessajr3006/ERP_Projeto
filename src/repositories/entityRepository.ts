import { randomUUID } from 'crypto';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import {
    Entity,
    EntityTable,
    CreateEntityData,
    UpdateEntityData,
} from '../types/Entity';
import { StorageService } from '../utils/storageService';

const BASE_ENTITY_FIELDS = [
    'name', 'cnpj_cpf', 'email', 'phone', 'zipcode', 'street',
    'number', 'complement', 'neighborhood', 'city', 'state',
    'certificate_url', 'certificate_password', 'certificate_expiration',
    'social_contract_url', 'cnpj_document_url',
] as const;

const CUSTOMER_ENTITY_FIELDS = [...BASE_ENTITY_FIELDS, 'vencimento_dia', 'limite', 'seller_user_id'] as const;
const CONTACT_ENTITY_FIELDS = [...BASE_ENTITY_FIELDS, 'birth_date'] as const;

function getPersistedFields(table: EntityTable): readonly string[] {
    if (table === 'customers') return CUSTOMER_ENTITY_FIELDS;
    if (table === 'contacts') return CONTACT_ENTITY_FIELDS;
    return BASE_ENTITY_FIELDS;
}

function getEntityLabel(table: EntityTable): string {
    if (table === 'customers') return 'Customer';
    if (table === 'contacts') return 'Contact';
    return 'Supplier';
}

export class EntityRepository {
    static async resolveCustomerSellerId(companyId: number, sellerPublicId: string | null | undefined): Promise<number | null | undefined> {
        if (sellerPublicId === undefined) return undefined;
        const normalizedSellerPublicId = String(sellerPublicId || '').trim();
        if (!normalizedSellerPublicId) return null;

        const [sellerRows] = await pool.query<RowDataPacket[]>(
            `SELECT id FROM users WHERE public_id = ? AND company_id = ? AND role = 'seller' LIMIT 1`,
            [normalizedSellerPublicId, companyId]
        );
        if (!sellerRows[0]) throw new Error('Seller not found for this company');
        return Number(sellerRows[0].id);
    }

    static buildSelectQuery(table: EntityTable, whereSql: string, tailSql = ''): string {
        if (table === 'customers') {
            return `SELECT c.*, seller.public_id AS seller_public_id, seller.full_name AS seller_name FROM customers c LEFT JOIN users seller ON seller.id = c.seller_user_id AND seller.company_id = c.company_id ${whereSql} ${tailSql}`;
        }
        return `SELECT e.* FROM ${table} e ${whereSql} ${tailSql}`;
    }

    static async getById(table: EntityTable, id: number, companyId: number): Promise<Entity> {
        const tableAlias = table === 'customers' ? 'c' : 'e';
        const label = getEntityLabel(table);
        const [rows] = await pool.query<RowDataPacket[]>(
            this.buildSelectQuery(table, `WHERE ${tableAlias}.id = ? AND ${tableAlias}.company_id = ?`, 'LIMIT 1'),
            [id, companyId]
        );
        if (!rows || rows.length === 0) throw new Error(`${label} not found`);
        return rows[0] as Entity;
    }

    static async getByPublicId(table: EntityTable, publicId: string, companyId: number): Promise<Entity> {
        const tableAlias = table === 'customers' ? 'c' : 'e';
        const label = getEntityLabel(table);
        const [rows] = await pool.query<RowDataPacket[]>(
            this.buildSelectQuery(table, `WHERE ${tableAlias}.public_id = ? AND ${tableAlias}.company_id = ?`, 'LIMIT 1'),
            [publicId, companyId]
        );
        if (!rows || rows.length === 0) throw new Error(`${label} not found`);
        return rows[0] as Entity;
    }

    static async getCustomerByDocument(companyId: number, cnpjCpf: string): Promise<Entity | null> {
        const [rows] = await pool.query<RowDataPacket[]>(
            this.buildSelectQuery('customers', 'WHERE c.cnpj_cpf = ? AND c.company_id = ?', 'LIMIT 1'),
            [cnpjCpf, companyId]
        );
        if (!rows || rows.length === 0) return null;
        return rows[0] as Entity;
    }

    static async assertUniqueDocument(table: EntityTable, cnpjCpf: string, companyId: number, excludeId?: number): Promise<void> {
        const label = getEntityLabel(table);
        const sql = excludeId
            ? `SELECT id FROM ${table} WHERE cnpj_cpf = ? AND company_id = ? AND id != ? LIMIT 1`
            : `SELECT id FROM ${table} WHERE cnpj_cpf = ? AND company_id = ? LIMIT 1`;
        const params = excludeId ? [cnpjCpf, companyId, excludeId] : [cnpjCpf, companyId];
        const [existing] = await pool.query<RowDataPacket[]>(sql, params);
        if (existing && existing.length > 0) throw new Error(`${label} Document already registered for this company`);
    }

    static async create(table: EntityTable, companyId: number, data: CreateEntityData): Promise<Entity> {
        if (data.cnpj_cpf) await this.assertUniqueDocument(table, data.cnpj_cpf, companyId);

        const publicId = randomUUID();
        let certUrl = data.certificate_url ?? null;
        if (!certUrl && data.certificate_base64) {
            const saved = StorageService.saveBase64('documents', data.certificate_base64);
            certUrl = saved ? saved.url : null;
        }

        let socialDestUrl = data.social_contract_url ?? null;
        if (!socialDestUrl && data.social_contract_base64) {
            const saved = StorageService.saveBase64('documents', data.social_contract_base64);
            socialDestUrl = saved ? saved.url : null;
        }

        let cnpjDestUrl = data.cnpj_document_url ?? null;
        if (!cnpjDestUrl && data.cnpj_document_base64) {
            const saved = StorageService.saveBase64('documents', data.cnpj_document_base64);
            cnpjDestUrl = saved ? saved.url : null;
        }

        const persistedFields = getPersistedFields(table);
        const persistedValues: Record<string, any> = Object.fromEntries(persistedFields.map((field) => [field, (data as any)[field] ?? null]));
        persistedValues.certificate_url = certUrl;
        persistedValues.social_contract_url = socialDestUrl;
        persistedValues.cnpj_document_url = cnpjDestUrl;

        if (table === 'customers') {
            persistedValues.seller_user_id = (await this.resolveCustomerSellerId(companyId, data.seller_public_id)) ?? null;
            persistedValues.limite = data.limite ?? 0;
        }

        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO ${table} (public_id, company_id, ${persistedFields.join(', ')}) VALUES (?, ?, ${persistedFields.map(() => '?').join(', ')})`,
            [publicId, companyId, ...persistedFields.map((field) => persistedValues[field] ?? null)]
        );

        if (result.affectedRows !== 1) throw new Error(`Failed to create entity`);
        return this.getById(table, result.insertId, companyId);
    }

    static async list(table: EntityTable, companyId: number): Promise<Entity[]> {
        const tableAlias = table === 'customers' ? 'c' : 'e';
        const [rows] = await pool.query<RowDataPacket[]>(
            this.buildSelectQuery(table, `WHERE ${tableAlias}.company_id = ?`, `ORDER BY ${tableAlias}.name ASC`),
            [companyId]
        );
        return rows as Entity[];
    }

    static async update(table: EntityTable, publicId: string, companyId: number, data: UpdateEntityData): Promise<Entity> {
        const label = getEntityLabel(table);
        const [currentRows] = await pool.query<RowDataPacket[]>(
            `SELECT id, cnpj_cpf, certificate_url, social_contract_url, cnpj_document_url FROM ${table} WHERE public_id = ? AND company_id = ? LIMIT 1`,
            [publicId, companyId]
        );

        if (!currentRows || currentRows.length === 0) throw new Error(`${label} not found`);

        const currentId: number = currentRows[0]!.id;
        const currentCnpj: string | null = currentRows[0]!.cnpj_cpf;

        if (data.cnpj_cpf && data.cnpj_cpf !== currentCnpj) {
            await this.assertUniqueDocument(table, data.cnpj_cpf, companyId, currentId);
        }

        const updates: string[] = [];
        const values: any[] = [];
        const currentEnt = currentRows[0] as Record<string, any>;

        if (data.certificate_base64 !== undefined) {
            if (currentEnt.certificate_url) StorageService.delete(currentEnt.certificate_url);
            const saved = StorageService.saveBase64('documents', data.certificate_base64);
            updates.push('certificate_url = ?'); values.push(saved ? saved.url : null);
        } else if (data.certificate_url !== undefined) {
            updates.push('certificate_url = ?'); values.push(data.certificate_url || null);
        }

        if (data.social_contract_base64 !== undefined) {
            if (currentEnt.social_contract_url) StorageService.delete(currentEnt.social_contract_url);
            const saved = StorageService.saveBase64('documents', data.social_contract_base64);
            updates.push('social_contract_url = ?'); values.push(saved ? saved.url : null);
        } else if (data.social_contract_url !== undefined) {
            updates.push('social_contract_url = ?'); values.push(data.social_contract_url || null);
        }

        if (data.cnpj_document_base64 !== undefined) {
            if (currentEnt.cnpj_document_url) StorageService.delete(currentEnt.cnpj_document_url);
            const saved = StorageService.saveBase64('documents', data.cnpj_document_base64);
            updates.push('cnpj_document_url = ?'); values.push(saved ? saved.url : null);
        } else if (data.cnpj_document_url !== undefined) {
            updates.push('cnpj_document_url = ?'); values.push(data.cnpj_document_url || null);
        }

        for (const field of getPersistedFields(table)) {
            if (['certificate_url', 'social_contract_url', 'cnpj_document_url'].includes(field)) continue;
            const val = (data as any)[field];
            if (val !== undefined) {
                updates.push(`${field} = ?`);
                values.push(val);
            }
        }

        if (table === 'customers' && data.seller_public_id !== undefined) {
            updates.push('seller_user_id = ?');
            values.push(await this.resolveCustomerSellerId(companyId, data.seller_public_id));
        }

        if (updates.length > 0) {
            values.push(currentId, companyId);
            await pool.query<ResultSetHeader>(`UPDATE ${table} SET ${updates.join(', ')} WHERE id = ? AND company_id = ?`, values);
        }

        return this.getById(table, currentId, companyId);
    }

    static async delete(table: EntityTable, publicId: string, companyId: number): Promise<void> {
        await this.getByPublicId(table, publicId, companyId);
        const label = getEntityLabel(table);
        const [result] = await pool.query<ResultSetHeader>(
            `DELETE FROM ${table} WHERE public_id = ? AND company_id = ?`,
            [publicId, companyId]
        );
        if (result.affectedRows !== 1) throw new Error(`Failed to delete ${label.toLowerCase()}`);
    }
}