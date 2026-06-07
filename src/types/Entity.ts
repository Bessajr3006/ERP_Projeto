/**
 * Entity.ts
 * ─────────
 * Tipos canônicos para entidades (Clientes e Fornecedores).
 *
 * Clientes e fornecedores compartilham quase todas as colunas. Mantemos
 * uma única interface `Entity` com campos opcionais para as diferenças
 * específicas de cada módulo.
 *
 * Se no futuro Customer ou Supplier precisarem divergir, basta substituir
 * o alias pelo tipo concreto sem quebrar o restante do código.
 */

// ── Tipo de tabela -----------------------------------------------------------------

export type EntityTable = 'customers' | 'suppliers' | 'contacts';

// ── Registro retornado pelo banco --------------------------------------------------

export interface Entity {
    id: number;
    public_id: string;       // UUID
    company_id: number;
    name: string;
    cnpj_cpf?: string;
    email?: string;
    birth_date?: string | null;
    phone?: string;
    vencimento_dia?: number | null;
    limite?: number;
    zipcode?: string;
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    certificate_url?: string;
    certificate_password?: string;
    certificate_expiration?: string;
    social_contract_url?: string;
    cnpj_document_url?: string;
    seller_public_id?: string | null;
    seller_name?: string | null;
    created_at: Date;
    updated_at: Date;
}

// ── Payloads de escrita ------------------------------------------------------------

export interface CreateEntityData {
    name: string;
    cnpj_cpf?: string | undefined;
    email?: string | undefined;
    birth_date?: string | null | undefined;
    phone?: string | undefined;
    vencimento_dia?: number | null | undefined;
    limite?: number | undefined;
    zipcode?: string | null | undefined;
    street?: string | null | undefined;
    number?: string | null | undefined;
    complement?: string | null | undefined;
    neighborhood?: string | null | undefined;
    city?: string | null | undefined;
    state?: string | null | undefined;
    certificate_base64?: string | null | undefined;
    certificate_url?: string | null | undefined;
    certificate_password?: string | null | undefined;
    certificate_expiration?: string | null | undefined;
    social_contract_base64?: string | null | undefined;
    social_contract_url?: string | null | undefined;
    cnpj_document_base64?: string | null | undefined;
    cnpj_document_url?: string | null | undefined;
    seller_public_id?: string | null | undefined;
}

export type UpdateEntityData = Partial<CreateEntityData>;

// ── Aliases retrocompatíveis (evita quebrar imports existentes) --------------------

/** @deprecated Use `Entity` direto */
export type Supplier = Entity;
/** @deprecated Use `Entity` direto */
export type Customer = Entity;
/** @deprecated Use `Entity` direto */
export type Contact = Entity;

/** @deprecated Use `CreateEntityData` direto */
export type CreateSupplierData = CreateEntityData;
/** @deprecated Use `CreateEntityData` direto */
export type CreateCustomerData = CreateEntityData;
/** @deprecated Use `CreateEntityData` direto */
export type CreateContactData = CreateEntityData;

/** @deprecated Use `UpdateEntityData` direto */
export type UpdateSupplierData = UpdateEntityData;
/** @deprecated Use `UpdateEntityData` direto */
export type UpdateCustomerData = UpdateEntityData;
/** @deprecated Use `UpdateEntityData` direto */
export type UpdateContactData = UpdateEntityData;
