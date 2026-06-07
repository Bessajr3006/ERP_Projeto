/**
 * entityService.ts
 * ────────────────
 * CRUD genérico para entidades (customers / suppliers).
 *
 * Clientes e fornecedores compartilham a maior parte da estrutura.
 * Onde houver diferenças, elas são tratadas por configuração sem
 * duplicar toda a lógica.
 *
 * Método auxiliar privado `crudFor(table)` retorna um objeto com as
 * cinco operações fundamentais. Os métodos públicos nomeados
 * (createSupplier, listCustomers…) delegate para ele, preservando
 * 100 % da API interna que o controller já usa.
 */

import pool from '../config/db';
import { RowDataPacket } from 'mysql2/promise';
import { EntityRepository } from '../repositories/entityRepository';
import {
    Entity,
    EntityTable,
    CreateEntityData,
    UpdateEntityData,
    Supplier,
    Customer,
} from '../types/Entity';

function crudFor(table: EntityTable) {
    return {
        create(companyId: number, data: CreateEntityData): Promise<Entity> {
            return EntityRepository.create(table, companyId, data);
        },
        list(companyId: number): Promise<Entity[]> {
            return EntityRepository.list(table, companyId);
        },
        getByPublicId(publicId: string, companyId: number): Promise<Entity> {
            return EntityRepository.getByPublicId(table, publicId, companyId);
        },
        update(publicId: string, companyId: number, data: UpdateEntityData): Promise<Entity> {
            return EntityRepository.update(table, publicId, companyId, data);
        },
        delete(publicId: string, companyId: number): Promise<void> {
            return EntityRepository.delete(table, publicId, companyId);
        },
    };
}

// ── Instâncias por tabela (singletons reutilizáveis) ──────────────────────────

const supplierCrud = crudFor('suppliers');
const customerCrud = crudFor('customers');

// ── API pública preservada (nomes idênticos aos anteriores) ───────────────────

export class EntityService {

    // ── Suppliers ──────────────────────────────────────────────────────────────

    static createSupplier(companyId: number, data: CreateEntityData): Promise<Supplier> {
        return supplierCrud.create(companyId, data);
    }

    static listSuppliers(companyId: number): Promise<Supplier[]> {
        return supplierCrud.list(companyId);
    }

    static getSupplierByPublicId(publicId: string, companyId: number): Promise<Supplier> {
        return supplierCrud.getByPublicId(publicId, companyId);
    }

    /** @internal Usado em tests e purchaseService por id numérico. */
    static async getSupplierById(id: number, companyId: number): Promise<Supplier> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM suppliers WHERE id = ? AND company_id = ? LIMIT 1',
            [id, companyId],
        );
        if (!rows || rows.length === 0) throw new Error('Supplier not found');
        return rows[0] as Supplier;
    }

    static updateSupplier(
        publicId: string,
        companyId: number,
        data: UpdateEntityData,
    ): Promise<Supplier> {
        return supplierCrud.update(publicId, companyId, data);
    }

    static deleteSupplier(publicId: string, companyId: number): Promise<void> {
        return supplierCrud.delete(publicId, companyId);
    }

    // ── Customers ──────────────────────────────────────────────────────────────

    static createCustomer(companyId: number, data: CreateEntityData): Promise<Customer> {
        return customerCrud.create(companyId, data);
    }

    static listCustomers(companyId: number): Promise<Customer[]> {
        return customerCrud.list(companyId);
    }

    static getCustomerByPublicId(publicId: string, companyId: number): Promise<Customer> {
        return customerCrud.getByPublicId(publicId, companyId);
    }

    /** @internal Usado em orderService por id numérico. */
    static async getCustomerById(id: number, companyId: number): Promise<Customer> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM customers WHERE id = ? AND company_id = ? LIMIT 1',
            [id, companyId],
        );
        if (!rows || rows.length === 0) throw new Error('Customer not found');
        return rows[0] as Customer;
    }

    static updateCustomer(
        publicId: string,
        companyId: number,
        data: UpdateEntityData,
    ): Promise<Customer> {
        return customerCrud.update(publicId, companyId, data);
    }

    static deleteCustomer(publicId: string, companyId: number): Promise<void> {
        return customerCrud.delete(publicId, companyId);
    }

    // ── Acesso genérico (novo — útil para novos módulos) ───────────────────────

    /**
     * Retorna o CRUD completo para qualquer tabela de entidade.
     * Útil para módulos que recebem a tabela como string dinâmica.
     *
     * @example
     * const crud = EntityService.for('customers');
     * const list = await crud.list(companyId);
     */
    static for(table: EntityTable) {
        return crudFor(table);
    }

    static async importSolidconCustomers(companyId: number, items: any[]): Promise<{ created: number; updated: number; skipped: number; errors: Array<{ index: number; reason: string }> }> {
        const result = { created: 0, updated: 0, skipped: 0, errors: [] as Array<{ index: number; reason: string }> };

        const normalizeText = (value: any): string => String(value ?? '').trim();
        const onlyDigits = (value: any): string => String(value ?? '').replace(/\D/g, '');
        const pickValue = (payload: any, keys: string[]): any => {
            for (const key of keys) {
                if (payload && payload[key] !== undefined && payload[key] !== null && payload[key] !== '') {
                    return payload[key];
                }
            }
            return undefined;
        };
        const mapSolidconItem = (payload: any): CreateEntityData | null => {
            const name = normalizeText(pickValue(payload, ['cliente', 'name', 'nome', 'razao_social', 'razao', 'nome_fantasia', 'fantasia']));
            if (!name) return null;

            const docRaw = pickValue(payload, ['cnpj', 'cpf', 'cnpj_cpf', 'documento', 'doc', 'cpf_cnpj']);
            const docDigits = onlyDigits(docRaw);

            return {
                name,
                cnpj_cpf: docDigits || undefined,
                email: normalizeText(pickValue(payload, ['email', 'email_principal'])) || undefined,
                phone: normalizeText(pickValue(payload, ['telefone', 'phone', 'celular', 'fone', 'telefone_principal'])) || undefined,
                zipcode: normalizeText(pickValue(payload, ['cep', 'zipcode'])) || undefined,
                street: normalizeText(pickValue(payload, ['logradouro', 'rua', 'street', 'endereco', 'address'])) || undefined,
                number: normalizeText(pickValue(payload, ['numero', 'number'])) || undefined,
                complement: normalizeText(pickValue(payload, ['complemento', 'complement'])) || undefined,
                neighborhood: normalizeText(pickValue(payload, ['bairro', 'neighborhood'])) || undefined,
                city: normalizeText(pickValue(payload, ['cidade', 'city'])) || undefined,
                state: normalizeText(pickValue(payload, ['estado', 'uf', 'state'])) || undefined,
            };
        };

        const processedDocs = new Set<string>();
        for (let index = 0; index < items.length; index += 1) {
            const item = items[index];
            try {
                const mapped = mapSolidconItem(item);
                if (!mapped) {
                    result.skipped += 1;
                    result.errors.push({ index, reason: 'Item sem nome valido.' });
                    continue;
                }

                const docKey = mapped.cnpj_cpf ? String(mapped.cnpj_cpf) : '';
                if (docKey && processedDocs.has(docKey)) {
                    result.skipped += 1;
                    continue;
                }
                if (docKey) {
                    processedDocs.add(docKey);
                }

                let existing = null;
                if (docKey) {
                    existing = await EntityRepository.getCustomerByDocument(companyId, docKey);
                }

                if (existing) {
                    await EntityRepository.update('customers', existing.public_id, companyId, mapped);
                    result.updated += 1;
                    continue;
                }

                await EntityRepository.create('customers', companyId, mapped);
                result.created += 1;
            } catch (error: any) {
                result.skipped += 1;
                result.errors.push({ index, reason: error?.message || 'Falha ao importar item.' });
            }
        }

        return result;
    }
}
