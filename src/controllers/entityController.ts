/**
 * entityController.ts
 * ────────────────────
 * Handlers HTTP para customers, suppliers e contacts.
 *
 * A lógica de validação e resposta é idêntica para as duas tabelas;
 * `makeHandlers(table)` a gera uma única vez e os métodos estáticos
 * delegam para as instâncias correspondentes.
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { EntityService } from '../services/entityService';
import { EntityTable, UpdateEntityData } from '../types/Entity';

// ── Zod schema (compartilhado entre customers e suppliers) ────────────────────

const optionalSellerPublicId = z.preprocess(
    (value) => {
        if (typeof value !== 'string') return value;
        const trimmed = value.trim();
        return trimmed === '' ? null : trimmed;
    },
    z.string().uuid('Invalid seller reference').nullable().optional()
);

const baseEntitySchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    cnpj_cpf: z.string().optional(),
    email: z.string().email('Invalid email').optional().or(z.literal('')),
    phone: z.string().optional(),
    zipcode: z.string().nullable().optional(),
    street: z.string().nullable().optional(),
    number: z.string().nullable().optional(),
    complement: z.string().nullable().optional(),
    neighborhood: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    state: z.string().nullable().optional(),
    certificate_base64: z.string().nullable().optional(),
    certificate_url: z.string().nullable().optional(),
    certificate_password: z.string().nullable().optional(),
    certificate_expiration: z.string().nullable().optional(),
    social_contract_base64: z.string().nullable().optional(),
    social_contract_url: z.string().nullable().optional(),
    cnpj_document_base64: z.string().nullable().optional(),
    cnpj_document_url: z.string().nullable().optional(),
});

const customerCreateSchema = baseEntitySchema.extend({
    seller_public_id: optionalSellerPublicId,
    vencimento_dia: z.number().int().min(1).max(31).nullable().optional(),
    limite: z.number().min(0).optional(),
    discount_type: z.enum(['percentage', 'fixed']).nullable().optional(),
    discount_value: z.number().min(0).nullable().optional(),
});

const customerUpdateSchema = customerCreateSchema.partial();
const supplierCreateSchema = baseEntitySchema;
const supplierUpdateSchema = supplierCreateSchema.partial();
const contactCreateSchema = baseEntitySchema.extend({
    birth_date: z.string().nullable().optional(),
});
const contactUpdateSchema = contactCreateSchema.partial();

// ── Factory de handlers ───────────────────────────────────────────────────────

function makeHandlers(table: EntityTable) {
    const crud = EntityService.for(table);
    const createSchema = table === 'customers' ? customerCreateSchema : table === 'contacts' ? contactCreateSchema : supplierCreateSchema;
    const updateSchema = table === 'customers' ? customerUpdateSchema : table === 'contacts' ? contactUpdateSchema : supplierUpdateSchema;
    const notFoundLabel = table === 'customers' ? 'Cliente' : table === 'contacts' ? 'Contato' : 'Fornecedor';

    return {
        async create(req: Request, res: Response): Promise<void> {
            const companyId = req.user!.company_id;
            const parsed = createSchema.safeParse(req.body);

            if (!parsed.success) {
                res.status(400).json({ status: 'error', errors: parsed.error.errors });
                return;
            }

            try {
                const entity = await crud.create(companyId, parsed.data);
                res.status(201).json({ status: 'success', data: entity });
            } catch (error: any) {
                if (error instanceof Error && error.message === 'Seller not found for this company') {
                    res.status(400).json({ status: 'error', message: 'Vendedor informado nao pertence a esta empresa.' });
                    return;
                }

                throw error;
            }
        },

        async list(req: Request, res: Response): Promise<void> {
            const entities = await crud.list(req.user!.company_id);
            res.status(200).json({ status: 'success', data: entities });
        },

        async update(req: Request, res: Response): Promise<void> {
            const companyId = req.user!.company_id;
            const publicId = req.params.id as string;
            const parsed = updateSchema.safeParse(req.body);

            if (!parsed.success) {
                res.status(400).json({ status: 'error', errors: parsed.error.errors });
                return;
            }

            try {
                const entity = await crud.update(publicId, companyId, parsed.data as UpdateEntityData);
                res.status(200).json({ status: 'success', data: entity });
            } catch (error: any) {
                if (error instanceof Error && error.message === 'Seller not found for this company') {
                    res.status(400).json({ status: 'error', message: 'Vendedor informado nao pertence a esta empresa.' });
                    return;
                }

                throw error;
            }
        },

        async delete(req: Request, res: Response): Promise<void> {
            const companyId = req.user!.company_id;
            const publicId = String(req.params.id || '').trim();

            try {
                await crud.delete(publicId, companyId);
                res.status(204).send();
            } catch (error: any) {
                if (error instanceof Error && /not found/i.test(error.message)) {
                    res.status(404).json({ status: 'error', message: `${notFoundLabel} não encontrado.` });
                    return;
                }
                throw error;
            }
        },
    };
}

// ── Instâncias (lazy-safe — criadas uma única vez no load do módulo) ──────────

const supplierHandlers = makeHandlers('suppliers');
const customerHandlers = makeHandlers('customers');
const contactHandlers = makeHandlers('contacts');

// ── Classe pública com handlers estáticos (API idêntica à anterior) ───────────

export class EntityController {

    // ── Suppliers ──────────────────────────────────────────────────────────────

    static createSupplier(req: Request, res: Response): Promise<void> {
        return supplierHandlers.create(req, res);
    }

    static listSuppliers(req: Request, res: Response): Promise<void> {
        return supplierHandlers.list(req, res);
    }

    static updateSupplier(req: Request, res: Response): Promise<void> {
        return supplierHandlers.update(req, res);
    }

    static deleteSupplier(req: Request, res: Response): Promise<void> {
        return supplierHandlers.delete(req, res);
    }

    // ── Customers ──────────────────────────────────────────────────────────────

    static createCustomer(req: Request, res: Response): Promise<void> {
        return customerHandlers.create(req, res);
    }

    static listCustomers(req: Request, res: Response): Promise<void> {
        return customerHandlers.list(req, res);
    }

    static updateCustomer(req: Request, res: Response): Promise<void> {
        return customerHandlers.update(req, res);
    }

    static deleteCustomer(req: Request, res: Response): Promise<void> {
        return customerHandlers.delete(req, res);
    }

    // ── Contacts ──────────────────────────────────────────────────────────────

    static createContact(req: Request, res: Response): Promise<void> {
        return contactHandlers.create(req, res);
    }

    static listContacts(req: Request, res: Response): Promise<void> {
        return contactHandlers.list(req, res);
    }

    static updateContact(req: Request, res: Response): Promise<void> {
        return contactHandlers.update(req, res);
    }

    static deleteContact(req: Request, res: Response): Promise<void> {
        return contactHandlers.delete(req, res);
    }

    static async importCustomersSolidcon(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const payload = req.body?.payload ?? req.body?.items ?? req.body?.data ?? req.body;

            const normalizeItems = (value: any): any[] => {
                if (Array.isArray(value)) return value;
                if (value?.body && Array.isArray(value.body)) return value.body;
                if (value?.items && Array.isArray(value.items)) return value.items;
                if (value?.data && Array.isArray(value.data)) return value.data;
                if (value?.customers && Array.isArray(value.customers)) return value.customers;
                if (value?.data?.items && Array.isArray(value.data.items)) return value.data.items;
                return [];
            };

            const items = normalizeItems(payload);
            if (!items.length) {
                res.status(400).json({ status: 'error', message: 'Nenhum item valido encontrado para importacao.' });
                return;
            }

            const result = await EntityService.importSolidconCustomers(companyId, items);

            res.status(200).json({
                status: 'success',
                data: result,
            });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error?.message || 'Internal Server Error' });
        }
    }
}
