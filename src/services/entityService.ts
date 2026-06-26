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

    static async listCustomersBySeller(companyId: number, sellerPublicId: string): Promise<Customer[]> {
        return EntityRepository.listCustomersBySeller(companyId, sellerPublicId) as Promise<Customer[]>;
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

    static bulkUpdateCustomers(companyId: number, data: {
        customerIds: string[],
        seller_public_id?: string | null | undefined,
        vencimento_dia?: number | null | undefined,
        limite?: number | undefined
    }): Promise<number> {
        return EntityRepository.bulkUpdateCustomers(companyId, data);
    }

    static bulkDeleteCustomers(companyId: number, customerIds: string[]): Promise<number> {
        return EntityRepository.bulkDeleteCustomers(companyId, customerIds);
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

        const parseBrazilianAddress = (addressStr: string) => {
            const result: {
                street?: string;
                number?: string;
                complement?: string;
                neighborhood?: string;
                city?: string;
                state?: string;
                zipcode?: string;
            } = {};

            if (!addressStr || typeof addressStr !== 'string') return result;

            let workingStr = addressStr.trim();

            // 1. Extrair CEP: 01021-000 ou 01021000
            const cepRegex = /\b(\d{5}-\d{3}|\d{8})\b/;
            const cepMatch = workingStr.match(cepRegex);
            if (cepMatch && cepMatch[1]) {
                result.zipcode = cepMatch[1].replace('-', '');
                workingStr = workingStr.replace(cepRegex, '').trim();
            }

            // 2. Extrair Estado (UF): e.g. " - SP", ", SP", "/SP"
            const stateRegex = /\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/i;
            const stateMatch = workingStr.match(stateRegex);
            if (stateMatch && stateMatch[1]) {
                result.state = stateMatch[1].toUpperCase();
                workingStr = workingStr.replace(stateRegex, '').trim();
            }

            // Limpar pontuações extras
            workingStr = workingStr.replace(/,\s*,/g, ',').replace(/-\s*-/g, '-').trim();

            // 3. Dividir por vírgula ou hífen
            let parts = workingStr.split(',').map(p => p.trim()).filter(Boolean);

            if (parts.length >= 2) {
                // Caso com vírgula: normalmente Parte 0 é Rua + Número (ou só Rua)
                const streetPart = parts[0];
                if (streetPart) {
                    const numRegex = /\s+(\d+|s\/n|S\/N|s\/nº)\b$/i;
                    const numMatch = streetPart.match(numRegex);
                    if (numMatch && numMatch[1]) {
                        result.street = streetPart.replace(numRegex, '').trim();
                        result.number = numMatch[1].trim();
                    } else {
                        result.street = streetPart;
                    }
                }

                // Se a parte 1 começar com número, pode ser o número e o complemento
                if (!result.number && parts[1]) {
                    const numStartMatch = parts[1].match(/^(\d+|s\/n|S\/N|s\/nº)\b/i);
                    if (numStartMatch && numStartMatch[1]) {
                        result.number = numStartMatch[1];
                        const comp = parts[1].replace(/^(\d+|s\/n|S\/N|s\/nº)\b/i, '').replace(/^[\s,-/]+/, '').trim();
                        if (comp) {
                            result.complement = comp;
                        }
                        parts.splice(1, 1);
                    }
                }

                // Tratar partes restantes
                if (parts.length >= 2) {
                    const lastPart = parts[parts.length - 1];
                    if (lastPart) {
                        result.city = lastPart;
                    }
                    parts.pop();

                    if (parts.length >= 2) {
                        const nextLastPart = parts[parts.length - 1];
                        if (nextLastPart) {
                            result.neighborhood = nextLastPart;
                        }
                        parts.pop();

                        if (parts.length >= 2) {
                            result.complement = parts.slice(1).join(', ').trim();
                        }
                    } else if (parts.length === 1 && parts[0]) {
                        result.neighborhood = parts[0];
                    }
                } else if (parts.length === 1 && parts[0]) {
                    result.neighborhood = parts[0];
                }
            } else {
                // Caso sem vírgula: tenta por hífen
                parts = workingStr.split('-').map(p => p.trim()).filter(Boolean);
                if (parts.length >= 2) {
                    const streetPart = parts[0];
                    if (streetPart) {
                        const numRegex = /\s+(\d+|s\/n|S\/N|s\/nº)\b$/i;
                        const numMatch = streetPart.match(numRegex);
                        if (numMatch && numMatch[1]) {
                            result.street = streetPart.replace(numRegex, '').trim();
                            result.number = numMatch[1].trim();
                        } else {
                            result.street = streetPart;
                        }
                    }

                    if (parts.length >= 3) {
                        const lastPart = parts[parts.length - 1];
                        const nextLastPart = parts[parts.length - 2];
                        if (lastPart) result.city = lastPart;
                        if (nextLastPart) result.neighborhood = nextLastPart;
                        if (parts.length > 3) {
                            result.complement = parts.slice(1, parts.length - 2).join(' - ').trim();
                        }
                    } else if (parts[1]) {
                        result.neighborhood = parts[1];
                    }
                } else {
                    // Sem delimitadores: tenta encontrar o padrão "Nome 123"
                    const numRegex = /\s+(\d+|s\/n|S\/N|s\/nº)\b/i;
                    const numMatch = workingStr.match(numRegex);
                    if (numMatch && numMatch[1] && numMatch.index !== undefined) {
                        result.street = workingStr.substring(0, numMatch.index).trim();
                        result.number = numMatch[1].trim();
                        const rest = workingStr.substring(numMatch.index + numMatch[0].length).trim();
                        if (rest) {
                            result.complement = rest;
                        }
                    } else {
                        result.street = workingStr;
                    }
                }
            }

            const cleanResult: {
                street?: string;
                number?: string;
                complement?: string;
                neighborhood?: string;
                city?: string;
                state?: string;
                zipcode?: string;
            } = {};

            const setCleaned = (key: keyof typeof cleanResult, val?: string) => {
                if (!val) return;
                let s = val.trim();
                if (s.startsWith('-') || s.startsWith(',') || s.startsWith('/')) s = s.substring(1).trim();
                if (s.endsWith('-') || s.endsWith(',') || s.endsWith('/')) s = s.substring(0, s.length - 1).trim();
                if (s) {
                    cleanResult[key] = s;
                }
            };

            setCleaned('street', result.street);
            setCleaned('number', result.number);
            setCleaned('complement', result.complement);
            setCleaned('neighborhood', result.neighborhood);
            setCleaned('city', result.city);
            setCleaned('state', result.state);
            setCleaned('zipcode', result.zipcode);

            return cleanResult;
        };

        const mapSolidconItem = (payload: any): CreateEntityData | null => {
            const name = normalizeText(pickValue(payload, ['cliente', 'name', 'nome', 'razao_social', 'razao', 'nome_fantasia', 'fantasia']));
            if (!name) return null;

            const docRaw = pickValue(payload, ['cnpj', 'cpf', 'cnpj_cpf', 'documento', 'doc', 'cpf_cnpj']);
            const docDigits = onlyDigits(docRaw);

            let zipcode = normalizeText(pickValue(payload, ['cep', 'zipcode'])) || undefined;
            let street = normalizeText(pickValue(payload, ['logradouro', 'rua', 'street', 'endereco', 'address'])) || undefined;
            let number = normalizeText(pickValue(payload, ['numero', 'number'])) || undefined;
            let complement = normalizeText(pickValue(payload, ['complemento', 'complement'])) || undefined;
            let neighborhood = normalizeText(pickValue(payload, ['bairro', 'neighborhood'])) || undefined;
            let city = normalizeText(pickValue(payload, ['cidade', 'city'])) || undefined;
            let state = normalizeText(pickValue(payload, ['estado', 'uf', 'state'])) || undefined;
            let cd_municipio: number | undefined = undefined;

            const parseCdMunicipio = (val: any): number | undefined => {
                if (val === undefined || val === null || val === '') return undefined;
                const num = Number(val);
                return isNaN(num) ? undefined : num;
            };

            cd_municipio = parseCdMunicipio(pickValue(payload, ['cdMunicipio', 'cd_municipio']));

            // Se existir um objeto "endereco" aninhado (padrão Solidcon)
            if (payload && typeof payload.endereco === 'object' && payload.endereco !== null) {
                const end = payload.endereco;
                zipcode = normalizeText(pickValue(end, ['cep', 'zipcode'])) || zipcode;
                street = normalizeText(pickValue(end, ['logradouro', 'rua', 'street', 'endereco', 'address'])) || street;
                number = normalizeText(pickValue(end, ['numero', 'number'])) || number;
                complement = normalizeText(pickValue(end, ['complemento', 'complement'])) || complement;
                neighborhood = normalizeText(pickValue(end, ['bairro', 'neighborhood'])) || neighborhood;
                city = normalizeText(pickValue(end, ['cidade', 'city'])) || city;
                state = normalizeText(pickValue(end, ['estado', 'uf', 'state'])) || state;
                cd_municipio = parseCdMunicipio(pickValue(end, ['cdMunicipio', 'cd_municipio'])) ?? cd_municipio;
            }

            // Se o street conter uma string de endereço completa (ex: possui vírgula ou hífen ou número)
            // e os outros campos essenciais estiverem em branco, tenta parsear o endereço.
            if (street && (!number || !neighborhood || !city || !state || !zipcode)) {
                const parsed = parseBrazilianAddress(street);
                if (parsed.street) {
                    street = parsed.street;
                    if (!number) number = parsed.number;
                    if (!complement) complement = parsed.complement;
                    if (!neighborhood) neighborhood = parsed.neighborhood;
                    if (!city) city = parsed.city;
                    if (!state) state = parsed.state;
                    if (!zipcode) zipcode = parsed.zipcode;
                }
            }

            return {
                name,
                cnpj_cpf: docDigits || undefined,
                email: normalizeText(pickValue(payload, ['email', 'email_principal'])) || undefined,
                phone: normalizeText(pickValue(payload, ['telefone', 'phone', 'celular', 'fone', 'telefone_principal'])) || undefined,
                zipcode,
                street,
                number,
                complement,
                neighborhood,
                city,
                state,
                cd_municipio,
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
