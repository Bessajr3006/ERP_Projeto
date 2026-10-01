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
    trade_name?: string | null;
    contact?: string | null;
    opening_date?: string | null;
    tax_regime?: string | null;
    cnpj_cpf?: string;
    inscricao_estadual?: string | null;
    inscricao_municipal?: string | null;
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
    certificate_name?: string;
    social_contract_url?: string;
    cnpj_document_url?: string;
    seller_public_id?: string | null;
    seller_name?: string | null;
    customer_group_public_id?: string | null;
    customer_group_name?: string | null;
    discount_type?: 'percentage' | 'fixed' | null;
    discount_value?: number | null;
    cd_municipio?: number | null;
    only_pix?: number | boolean | null;
    only_solidcon_baixa?: number | boolean | null;
    exempt_interest_fine?: number | boolean | null;
    hide_in_revenues_grid?: number | boolean | null;
    is_registered_as_company?: number | boolean;
    activity_groups?: { public_id: string; name: string }[] | null;
    created_at: Date;
    updated_at: Date;
}

// ── Payloads de escrita ------------------------------------------------------------

export interface CreateEntityData {
    name: string;
    trade_name?: string | null | undefined;
    contact?: string | null | undefined;
    opening_date?: string | null | undefined;
    tax_regime?: string | null | undefined;
    cnpj_cpf?: string | undefined;
    inscricao_estadual?: string | null | undefined;
    inscricao_municipal?: string | null | undefined;
    email?: string | undefined;
    birth_date?: string | null | undefined;
    phone?: string | undefined;
    phone_landline?: string | null | undefined;
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
    certificate_name?: string | null | undefined;
    social_contract_base64?: string | null | undefined;
    social_contract_url?: string | null | undefined;
    cnpj_document_base64?: any;
    cnpj_document_url?: any;
    cnpj_document_uploads?: any;
    seller_public_id?: string | null | undefined;
    customer_group_public_id?: string | null | undefined;
    discount_type?: 'percentage' | 'fixed' | null | undefined;
    discount_value?: number | null | undefined;
    cd_municipio?: number | null | undefined;
    only_pix?: number | boolean | null | undefined;
    only_solidcon_baixa?: number | boolean | null | undefined;
    exempt_interest_fine?: number | boolean | null | undefined;
    hide_in_revenues_grid?: number | boolean | null | undefined;
    company_user?: any;
    register_as_company?: boolean | string | undefined;
    activity_groups_public_ids?: string[] | null | undefined;
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
