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
        async update(publicId: string, companyId: number, data: UpdateEntityData): Promise<Entity> {
            const entity = await EntityRepository.update(table, publicId, companyId, data);
            if (table === 'customers' && (data.only_pix === 1 || data.only_pix === true)) {
                try {
                    const { FinanceService } = await import('./financeService');
                    await FinanceService.cancelOpenBoletosAndSwitchToPixForCustomer(companyId, (entity as any).id);
                } catch (err) {
                    console.error('[crudFor:customers:update] Erro ao cancelar boletos em aberto e migrar para PIX:', err);
                }
            }
            return entity;
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

    static async bulkUpdateCustomers(companyId: number, data: {
        customerIds: string[],
        seller_public_id?: string | null | undefined,
        customer_group_public_id?: string | null | undefined,
        vencimento_dia?: number | null | undefined,
        limite?: number | undefined,
        only_pix?: number | boolean | null | undefined,
        only_solidcon_baixa?: number | boolean | null | undefined,
        exempt_interest_fine?: number | boolean | null | undefined,
        hide_in_revenues_grid?: number | boolean | null | undefined
    }): Promise<number> {
        const count = await EntityRepository.bulkUpdateCustomers(companyId, data);
        if (data.only_pix === 1 || data.only_pix === true) {
            try {
                if (data.customerIds && data.customerIds.length > 0) {
                    const { FinanceService } = await import('./financeService');
                    const placeholders = data.customerIds.map(() => '?').join(', ');
                    const [custRows]: any = await pool.query(
                        `SELECT id FROM customers WHERE company_id = ? AND public_id IN (${placeholders})`,
                        [companyId, ...data.customerIds]
                    );
                    for (const row of custRows) {
                        await FinanceService.cancelOpenBoletosAndSwitchToPixForCustomer(companyId, row.id);
                    }
                }
            } catch (err) {
                console.error('[bulkUpdateCustomers] Erro ao cancelar boletos em aberto e migrar para PIX:', err);
            }
        }
        return count;
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
        const [companies] = await pool.query<RowDataPacket[]>(
            `SELECT cg.public_id AS default_customer_group_public_id 
             FROM companies c 
             LEFT JOIN customer_groups cg ON cg.id = c.default_customer_group_id 
             WHERE c.id = ? LIMIT 1`,
            [companyId]
        );
        const defaultGroupPublicId = companies[0]?.default_customer_group_public_id || null;
        const normalizeText = (value: any): string => String(value ?? '').trim();
        const onlyAlphanumeric = (value: any): string => String(value ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
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
            const name = normalizeText(pickValue(payload, [
                'cliente', 'name', 'nome', 'razao_social', 'razao', 
                'nome_fantasia', 'fantasia', 'nmPessoa', 'nmRazaoSocial'
            ]));
            if (!name) return null;

            const docRaw = pickValue(payload, [
                'cnpj', 'cpf', 'cnpj_cpf', 'documento', 'doc', 'cpf_cnpj',
                'nrCgc', 'nrCnpj', 'nrCpf', 'nrCgcCpf', 'nrCpfCgc', 'nrDocumento'
            ]);
            let docDigits = onlyAlphanumeric(docRaw);
            if (docDigits.length > 0) {
                if (docDigits.length <= 11) {
                    docDigits = docDigits.padStart(11, '0');
                } else if (docDigits.length <= 14) {
                    docDigits = docDigits.padStart(14, '0');
                }
            }

            const trade_name = normalizeText(pickValue(payload, ['trade_name', 'nome_fantasia', 'fantasia', 'nmFantasia'])) || undefined;
            const inscricao_estadual = normalizeText(pickValue(payload, ['inscricao_estadual', 'ie', 'InscricaoEstadual', 'nrInscricaoEstadual', 'nrIe'])) || undefined;
            const inscricao_municipal = normalizeText(pickValue(payload, ['inscricao_municipal', 'im', 'InscricaoMunicipal', 'nrInscricaoMunicipal', 'nrIm'])) || undefined;

            let zipcode = normalizeText(pickValue(payload, ['cep', 'zipcode', 'nrCep', 'CEP'])) || undefined;
            let street = normalizeText(pickValue(payload, ['logradouro', 'rua', 'street', 'endereco', 'address', 'dsLogradouro', 'dsEndereco', 'nmEndereco', 'Endereco'])) || undefined;
            let number = normalizeText(pickValue(payload, ['numero', 'number', 'nrEndereco', 'Numero'])) || undefined;
            let complement = normalizeText(pickValue(payload, ['complemento', 'complement', 'dsComplemento', 'Complemento'])) || undefined;
            let neighborhood = normalizeText(pickValue(payload, ['bairro', 'neighborhood', 'nmBairro', 'Bairro'])) || undefined;
            let city = normalizeText(pickValue(payload, ['cidade', 'city', 'nmCidade', 'Cidade'])) || undefined;
            let state = normalizeText(pickValue(payload, ['estado', 'uf', 'state', 'sgEstado', 'UF', 'Estado'])) || undefined;
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
                zipcode = normalizeText(pickValue(end, ['cep', 'zipcode', 'nrCep', 'CEP'])) || zipcode;
                street = normalizeText(pickValue(end, ['logradouro', 'rua', 'street', 'endereco', 'address', 'dsLogradouro', 'dsEndereco'])) || street;
                number = normalizeText(pickValue(end, ['numero', 'number', 'nrEndereco', 'Numero'])) || number;
                complement = normalizeText(pickValue(end, ['complemento', 'complement', 'dsComplemento', 'Complemento'])) || complement;
                neighborhood = normalizeText(pickValue(end, ['bairro', 'neighborhood', 'nmBairro', 'Bairro'])) || neighborhood;
                city = normalizeText(pickValue(end, ['cidade', 'city', 'nmCidade', 'Cidade'])) || city;
                state = normalizeText(pickValue(end, ['estado', 'uf', 'state', 'sgEstado', 'UF', 'Estado'])) || state;
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
                trade_name,
                cnpj_cpf: docDigits || undefined,
                inscricao_estadual,
                inscricao_municipal,
                email: normalizeText(pickValue(payload, ['email', 'email_principal', 'dsEmail'])) || undefined,
                phone: normalizeText(pickValue(payload, ['telefone', 'phone', 'celular', 'fone', 'telefone_principal', 'nrTelefone', 'nrCelular', 'Celular', 'Telefone'])) || undefined,
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

        const processedKeys = new Set<string>();
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
                const nameKey = mapped.name.toLowerCase().trim();
                const uniqueKey = docKey || `name:${nameKey}`;
                if (processedKeys.has(uniqueKey)) {
                    result.skipped += 1;
                    result.errors.push({ index, reason: `Cliente duplicado no lote (${mapped.name})` });
                    continue;
                }
                processedKeys.add(uniqueKey);

                let existing = null;
                if (docKey) {
                    existing = await EntityRepository.getCustomerByDocument(companyId, docKey);
                }
                if (!existing && nameKey) {
                    existing = await EntityRepository.getCustomerByName(companyId, mapped.name);
                }

                if (existing) {
                    // Atualiza SOMENTE os dados cadastrais básicos vindos do Solidcon.
                    // Todos os parâmetros configurados no Keystone (Grupo de Clientes, Vendedor, Limite de Crédito,
                    // Dia de Vencimento, Descontos, Somente PIX, Trava Baixa Solidcon, Isenção Juros/Multa,
                    // Grupos de Atividades, Contratos, Certificados, Anexos e Anotações) são rigorosamente PRESERVADOS!
                    const updatePayload: UpdateEntityData = {};
                    if (mapped.name && mapped.name.trim()) updatePayload.name = mapped.name.trim();
                    if (mapped.trade_name && mapped.trade_name.trim()) updatePayload.trade_name = mapped.trade_name.trim();
                    if (mapped.cnpj_cpf && mapped.cnpj_cpf.trim()) updatePayload.cnpj_cpf = mapped.cnpj_cpf.trim();
                    if (mapped.inscricao_estadual && mapped.inscricao_estadual.trim()) updatePayload.inscricao_estadual = mapped.inscricao_estadual.trim();
                    if (mapped.inscricao_municipal && mapped.inscricao_municipal.trim()) updatePayload.inscricao_municipal = mapped.inscricao_municipal.trim();
                    if (mapped.email && mapped.email.trim()) updatePayload.email = mapped.email.trim();
                    if (mapped.phone && mapped.phone.trim()) updatePayload.phone = mapped.phone.trim();
                    if (mapped.zipcode && mapped.zipcode.trim()) updatePayload.zipcode = mapped.zipcode.trim();
                    if (mapped.street && mapped.street.trim()) updatePayload.street = mapped.street.trim();
                    if (mapped.number && mapped.number.trim()) updatePayload.number = mapped.number.trim();
                    if (mapped.complement && mapped.complement.trim()) updatePayload.complement = mapped.complement.trim();
                    if (mapped.neighborhood && mapped.neighborhood.trim()) updatePayload.neighborhood = mapped.neighborhood.trim();
                    if (mapped.city && mapped.city.trim()) updatePayload.city = mapped.city.trim();
                    if (mapped.state && mapped.state.trim()) updatePayload.state = mapped.state.trim();
                    if (mapped.cd_municipio !== undefined && mapped.cd_municipio !== null) updatePayload.cd_municipio = mapped.cd_municipio;

                    await EntityRepository.update('customers', existing.public_id, companyId, updatePayload);
                    result.updated += 1;
                    continue;
                }

                // Para novos clientes, atribui o grupo padrão da empresa (se configurado)
                const createPayload: CreateEntityData = {
                    ...mapped,
                    customer_group_public_id: defaultGroupPublicId || undefined,
                };
                await EntityRepository.create('customers', companyId, createPayload);
                result.created += 1;
            } catch (error: any) {
                result.skipped += 1;
                result.errors.push({ index, reason: error?.message || 'Falha ao importar item.' });
            }
        }

        return result;
    }

    static async importSolidconSuppliers(companyId: number, items: any[]): Promise<{ created: number; updated: number; skipped: number; errors: Array<{ index: number; reason: string }> }> {
        const result = { created: 0, updated: 0, skipped: 0, errors: [] as Array<{ index: number; reason: string }> };
        const normalizeText = (value: any): string => String(value ?? '').trim();
        const onlyAlphanumeric = (value: any): string => String(value ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
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

            const cepRegex = /\b(\d{5}-\d{3}|\d{8})\b/;
            const cepMatch = workingStr.match(cepRegex);
            if (cepMatch && cepMatch[1]) {
                result.zipcode = cepMatch[1].replace('-', '');
                workingStr = workingStr.replace(cepRegex, '').trim();
            }

            const stateRegex = /\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/i;
            const stateMatch = workingStr.match(stateRegex);
            if (stateMatch && stateMatch[1]) {
                result.state = stateMatch[1].toUpperCase();
                workingStr = workingStr.replace(stateRegex, '').trim();
            }

            workingStr = workingStr.replace(/,\s*,/g, ',').replace(/-\s*-/g, '-').trim();

            let parts = workingStr.split(',').map(p => p.trim()).filter(Boolean);

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

        const mapSolidconSupplierItem = (payload: any): CreateEntityData | null => {
            const name = normalizeText(pickValue(payload, [
                'fornecedor', 'supplier', 'cliente', 'name', 'nome', 
                'razao_social', 'razao', 'nome_fantasia', 'fantasia', 
                'nmPessoa', 'nmRazaoSocial', 'nmFantasia',
                'historicoParcela', 'historicoBaixa', 'Historico', 'historico'
            ]));
            if (!name) return null;

            const docRaw = pickValue(payload, ['cnpj', 'cpf', 'cnpj_cpf', 'documento', 'doc', 'cpf_cnpj', 'nrCgc', 'nrCnpj', 'nrCpf', 'nrCgcCpf', 'nrCpfCgc', 'nrDocumento']);
            let docDigits = onlyAlphanumeric(docRaw);
            if (docDigits.length > 0) {
                if (docDigits.length <= 11) {
                    docDigits = docDigits.padStart(11, '0');
                } else if (docDigits.length <= 14) {
                    docDigits = docDigits.padStart(14, '0');
                }
            }

            let zipcode = normalizeText(pickValue(payload, ['cep', 'zipcode', 'nrCep', 'CEP'])) || undefined;
            let street = normalizeText(pickValue(payload, ['logradouro', 'rua', 'street', 'endereco', 'address', 'dsLogradouro', 'dsEndereco', 'nmEndereco', 'Endereco'])) || undefined;
            let number = normalizeText(pickValue(payload, ['numero', 'number', 'nrEndereco', 'Numero'])) || undefined;
            let complement = normalizeText(pickValue(payload, ['complemento', 'complement', 'dsComplemento', 'Complemento'])) || undefined;
            let neighborhood = normalizeText(pickValue(payload, ['bairro', 'neighborhood', 'nmBairro', 'Bairro'])) || undefined;
            let city = normalizeText(pickValue(payload, ['cidade', 'city', 'nmCidade', 'Cidade'])) || undefined;
            let state = normalizeText(pickValue(payload, ['estado', 'uf', 'state', 'sgEstado', 'UF', 'Estado'])) || undefined;
            let cd_municipio: number | undefined = undefined;

            const parseCdMunicipio = (val: any): number | undefined => {
                if (val === undefined || val === null || val === '') return undefined;
                const num = Number(val);
                return isNaN(num) ? undefined : num;
            };

            cd_municipio = parseCdMunicipio(pickValue(payload, ['cdMunicipio', 'cd_municipio']));

            if (payload && typeof payload.endereco === 'object' && payload.endereco !== null) {
                const end = payload.endereco;
                zipcode = normalizeText(pickValue(end, ['cep', 'zipcode', 'nrCep', 'CEP'])) || zipcode;
                street = normalizeText(pickValue(end, ['logradouro', 'rua', 'street', 'endereco', 'address', 'dsLogradouro', 'dsEndereco'])) || street;
                number = normalizeText(pickValue(end, ['numero', 'number', 'nrEndereco', 'Numero'])) || number;
                complement = normalizeText(pickValue(end, ['complemento', 'complement', 'dsComplemento', 'Complemento'])) || complement;
                neighborhood = normalizeText(pickValue(end, ['bairro', 'neighborhood', 'nmBairro', 'Bairro'])) || neighborhood;
                city = normalizeText(pickValue(end, ['cidade', 'city', 'nmCidade', 'Cidade'])) || city;
                state = normalizeText(pickValue(end, ['estado', 'uf', 'state', 'sgEstado', 'UF', 'Estado'])) || state;
                cd_municipio = parseCdMunicipio(pickValue(end, ['cdMunicipio', 'cd_municipio'])) ?? cd_municipio;
            }

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
                trade_name: normalizeText(pickValue(payload, ['trade_name', 'nome_fantasia', 'fantasia', 'nmFantasia', 'nmPessoa'])) || undefined,
                cnpj_cpf: docDigits || undefined,
                inscricao_estadual: normalizeText(pickValue(payload, ['inscricao_estadual', 'ie', 'InscricaoEstadual', 'nrInscricaoEstadual'])) || undefined,
                inscricao_municipal: normalizeText(pickValue(payload, ['inscricao_municipal', 'im', 'InscricaoMunicipal', 'nrInscricaoMunicipal'])) || undefined,
                email: normalizeText(pickValue(payload, ['email', 'email_principal', 'dsEmail'])) || undefined,
                phone: normalizeText(pickValue(payload, ['telefone', 'phone', 'celular', 'fone', 'telefone_principal', 'nrTelefone', 'nrCelular', 'Celular', 'Telefone'])) || undefined,
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

        const processedKeys = new Set<string>();
        for (let index = 0; index < items.length; index += 1) {
            const item = items[index];
            try {
                const mapped = mapSolidconSupplierItem(item);
                if (!mapped) {
                    result.skipped += 1;
                    result.errors.push({ index, reason: 'Item sem nome válido.' });
                    continue;
                }

                const docKey = mapped.cnpj_cpf ? String(mapped.cnpj_cpf) : '';
                const nameKey = mapped.name.toLowerCase().trim();
                const uniqueKey = docKey || `name:${nameKey}`;
                if (processedKeys.has(uniqueKey)) {
                    result.skipped += 1;
                    result.errors.push({ index, reason: `Fornecedor duplicado no lote (${mapped.name})` });
                    continue;
                }
                processedKeys.add(uniqueKey);

                let existing = null;
                if (docKey) {
                    existing = await EntityRepository.getSupplierByDocument(companyId, docKey);
                }
                if (!existing && nameKey) {
                    existing = await EntityRepository.getSupplierByName(companyId, mapped.name);
                }

                if (existing) {
                    const updatePayload: UpdateEntityData = {};
                    if (mapped.name && mapped.name.trim()) updatePayload.name = mapped.name.trim();
                    if (mapped.trade_name && mapped.trade_name.trim()) updatePayload.trade_name = mapped.trade_name.trim();
                    if (mapped.cnpj_cpf && mapped.cnpj_cpf.trim()) updatePayload.cnpj_cpf = mapped.cnpj_cpf.trim();
                    if (mapped.inscricao_estadual && mapped.inscricao_estadual.trim()) updatePayload.inscricao_estadual = mapped.inscricao_estadual.trim();
                    if (mapped.inscricao_municipal && mapped.inscricao_municipal.trim()) updatePayload.inscricao_municipal = mapped.inscricao_municipal.trim();
                    if (mapped.email && mapped.email.trim()) updatePayload.email = mapped.email.trim();
                    if (mapped.phone && mapped.phone.trim()) updatePayload.phone = mapped.phone.trim();
                    if (mapped.zipcode && mapped.zipcode.trim()) updatePayload.zipcode = mapped.zipcode.trim();
                    if (mapped.street && mapped.street.trim()) updatePayload.street = mapped.street.trim();
                    if (mapped.number && mapped.number.trim()) updatePayload.number = mapped.number.trim();
                    if (mapped.complement && mapped.complement.trim()) updatePayload.complement = mapped.complement.trim();
                    if (mapped.neighborhood && mapped.neighborhood.trim()) updatePayload.neighborhood = mapped.neighborhood.trim();
                    if (mapped.city && mapped.city.trim()) updatePayload.city = mapped.city.trim();
                    if (mapped.state && mapped.state.trim()) updatePayload.state = mapped.state.trim();
                    if (mapped.cd_municipio !== undefined && mapped.cd_municipio !== null) updatePayload.cd_municipio = mapped.cd_municipio;

                    await EntityRepository.update('suppliers', existing.public_id, companyId, updatePayload);
                    result.updated += 1;
                    continue;
                }

                await EntityRepository.create('suppliers', companyId, mapped);
                result.created += 1;
            } catch (error: any) {
                result.skipped += 1;
                result.errors.push({ index, reason: error?.message || 'Falha ao importar item.' });
            }
        }

        return result;
    }
}
