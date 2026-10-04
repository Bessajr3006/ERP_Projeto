export interface Company {
    id: number;
    public_id: string; // UUID
    trade_name: string; // Nome fantasia
    company_name?: string; // Razão social
    cnpj?: string;
    tax_regime?: string;
    email?: string;
    phone?: string;
    zipcode?: string;
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;

    certificate_url?: string;
    certificate_password?: string;
    certificate_expiration?: Date | string;
    certificate_name?: string;
    logo_url?: string | null;
    logo_filename?: string | null;
    logo_base64?: string | null;

    api_token?: string;
    swagger_api_token?: string;
    whatsapp_chat_provider?: 'business_qr';
    whatsapp_business_scope?: 'company' | 'user';
    solidcon_api_token?: string;
    solidcon_url_1?: string;
    solidcon_url_2?: string;
    solidcon_url_3?: string;
    solidcon_url_4?: string;
    solidcon_url_5?: string;
    solidcon_customer_cpf?: string;
    solidcon_customer_name?: string;
    serv_solidcon?: string;
    bd_solidcon?: string;
    login_solidcon?: string;
    senha_solidcon?: string;
    serv_dorsal?: string;
    bd_dorsal?: string;
    login_dorsal?: string;
    senha_dorsal?: string;
    cdfilial?: string;
    cdpdv?: string;
    allow_print_without_confirmation?: boolean;
    show_new_measure_button?: boolean;

    is_active?: boolean;
    is_system?: boolean;
    is_general_admin?: boolean;
    is_group_master?: boolean;
    company_group_id?: number | null;
    company_group_public_id?: string | null;
    company_group_name?: string | null;
    created_at?: Date;
    updated_at?: Date;

    ie?: string | null;
    im?: string | null;
    cnae_principal?: string | null;
    crt?: number | null;
    nfe_environment?: number | null;
    nfe_series?: number | null;
    nfe_number?: number | null;
    nfce_series?: number | null;
    nfce_number?: number | null;
    csc_id?: string | null;
    csc_token?: string | null;
    waze_url?: string | null;
    cnpj_document_url?: string | null;
    default_customer_group_id?: number | null;
    default_customer_group_public_id?: string | null;
    default_customer_group_name?: string | null;
    default_bank_account_id?: number | null;
    default_bank_account_public_id?: string | null;
    default_bank_account_name?: string | null;
    default_receivable_type_id?: number | null;
    default_receivable_type_public_id?: string | null;
    default_receivable_type_name?: string | null;
    show_solidcon?: boolean;
    serv_alterdata?: string;
    bd_alterdata?: string;
    login_alterdata?: string;
    senha_alterdata?: string;
    porta_alterdata?: string;
    cdempresa_alterdata?: string;
    show_alterdata?: boolean;
    show_poscontrol?: boolean;
    auto_generate_billets?: boolean | number;
    auto_generate_billets_time?: string | null;
    auto_send_boleto_whatsapp?: boolean | number;
    boleto_send_time?: string | null;
    boleto_send_whatsapp_number?: string | null;
    boleto_send_whatsapp_name?: string | null;
    whatsapp_allow_all_users_active_sender?: boolean | number;
}

export interface IbgeState {
    id: number;
    uf: string;
    name: string;
    region: 'Norte' | 'Nordeste' | 'Centro-Oeste' | 'Sudeste' | 'Sul';
}

export interface CreateCompanyData {
    trade_name: string;
    company_name?: string | undefined;
    cnpj?: string | undefined;
    tax_regime?: string | undefined;
    email?: string | undefined;
    phone?: string | undefined;
    zipcode?: string | undefined;
    street?: string | undefined;
    number?: string | undefined;
    complement?: string | undefined;
    neighborhood?: string | undefined;
    city?: string | undefined;
    state?: string | undefined;
    is_general_admin?: boolean | undefined;
    is_group_master?: boolean | undefined;
    company_group_id?: number | null | undefined;
    company_group_public_id?: string | null | undefined;
    waze_url?: string | null | undefined;
}

export interface UpdateCompanyData {
    trade_name?: string | undefined;
    company_name?: string | undefined;
    cnpj?: string | undefined;
    tax_regime?: string | undefined;
    email?: string | undefined;
    phone?: string | undefined;
    zipcode?: string | undefined;
    street?: string | undefined;
    number?: string | undefined;
    complement?: string | undefined;
    neighborhood?: string | undefined;
    city?: string | undefined;
    state?: string | undefined;
    certificate_base64?: string | undefined;
    certificate_url?: string | undefined;
    certificate_password?: string | undefined;
    certificate_expiration?: string | undefined;
    certificate_name?: string | undefined;
    logo_base64?: string | null | undefined;
    logo_url?: string | null | undefined;
    logo_filename?: string | null | undefined;
    api_token?: string | undefined;
    swagger_api_token?: string | undefined;
    whatsapp_chat_provider?: 'business_qr' | undefined;
    whatsapp_business_scope?: 'company' | 'user' | undefined;
    solidcon_api_token?: string | undefined;
    solidcon_url_1?: string | undefined;
    solidcon_url_2?: string | undefined;
    solidcon_url_3?: string | undefined;
    solidcon_url_4?: string | undefined;
    solidcon_url_5?: string | undefined;
    solidcon_customer_cpf?: string | undefined;
    solidcon_customer_name?: string | undefined;
    serv_solidcon?: string | undefined;
    bd_solidcon?: string | undefined;
    login_solidcon?: string | undefined;
    senha_solidcon?: string | undefined;
    serv_dorsal?: string | undefined;
    bd_dorsal?: string | undefined;
    login_dorsal?: string | undefined;
    senha_dorsal?: string | undefined;
    cdfilial?: string | undefined;
    cdpdv?: string | undefined;
    allow_print_without_confirmation?: boolean | undefined;
    show_new_measure_button?: boolean | undefined;
    is_active?: boolean | undefined;
    is_general_admin?: boolean | undefined;
    is_group_master?: boolean | undefined;
    company_group_id?: number | null | undefined;
    company_group_public_id?: string | null | undefined;

    ie?: string | null | undefined;
    im?: string | null | undefined;
    cnae_principal?: string | null | undefined;
    crt?: number | null | undefined;
    nfe_environment?: number | null | undefined;
    nfe_series?: number | null | undefined;
    nfe_number?: number | null | undefined;
    nfce_series?: number | null | undefined;
    nfce_number?: number | null | undefined;
    csc_id?: string | null | undefined;
    csc_token?: string | null | undefined;
    waze_url?: string | null | undefined;
    cnpj_document_url?: string | null | undefined;
    cnpj_document_uploads?: { name?: string | undefined; base64: string; attachedAt?: string | undefined; filename?: string | undefined }[] | undefined;
    default_customer_group_public_id?: string | null | undefined;
    default_bank_account_public_id?: string | null | undefined;
    default_receivable_type_public_id?: string | null | undefined;
    show_solidcon?: boolean | undefined;
    serv_alterdata?: string | undefined;
    bd_alterdata?: string | undefined;
    login_alterdata?: string | undefined;
    senha_alterdata?: string | undefined;
    porta_alterdata?: string | undefined;
    cdempresa_alterdata?: string | undefined;
    show_alterdata?: boolean | undefined;
    show_poscontrol?: boolean | undefined;
    auto_generate_billets?: boolean | number | undefined;
    auto_generate_billets_time?: string | null | undefined;
}

export interface SolidconConfig {
    id: number;
    company_id: number;
    name: string;
    serv_solidcon: string;
    bd_solidcon: string;
    login_solidcon: string;
    senha_solidcon?: string;
    cdfilial?: string | null;
    cdpdv?: string | null;
    is_default?: boolean | number;
    created_at?: Date | string;
    updated_at?: Date | string;
}

export interface CreateSolidconConfigData {
    name: string;
    serv_solidcon: string;
    bd_solidcon: string;
    login_solidcon: string;
    senha_solidcon: string;
    cdfilial?: string | null;
    cdpdv?: string | null;
    is_default?: boolean | number;
}

export interface UpdateSolidconConfigData {
    name?: string;
    serv_solidcon?: string;
    bd_solidcon?: string;
    login_solidcon?: string;
    senha_solidcon?: string;
    cdfilial?: string | null;
    cdpdv?: string | null;
    is_default?: boolean | number;
}

export interface DorsalConfig {
    id: number;
    company_id: number;
    name: string;
    serv_dorsal: string;
    bd_dorsal: string;
    login_dorsal: string;
    senha_dorsal?: string;
    cdfilial?: string | null;
    cdpdv?: string | null;
    is_default?: boolean | number;
    created_at?: Date | string;
    updated_at?: Date | string;
}

export interface CreateDorsalConfigData {
    name: string;
    serv_dorsal: string;
    bd_dorsal: string;
    login_dorsal: string;
    senha_dorsal: string;
    cdfilial?: string | null;
    cdpdv?: string | null;
    is_default?: boolean | number;
}

export interface UpdateDorsalConfigData {
    name?: string;
    serv_dorsal?: string;
    bd_dorsal?: string;
    login_dorsal?: string;
    senha_dorsal?: string;
    cdfilial?: string | null;
    cdpdv?: string | null;
    is_default?: boolean | number;
}

export interface AlterdataConfig {
    id: number;
    company_id: number;
    name: string;
    serv_alterdata: string;
    porta_alterdata?: string | null;
    bd_alterdata: string;
    cdempresa_alterdata?: string | null;
    login_alterdata: string;
    senha_alterdata?: string;
    is_default?: boolean | number;
    created_at?: Date | string;
    updated_at?: Date | string;
}

export interface CreateAlterdataConfigData {
    name: string;
    serv_alterdata: string;
    porta_alterdata?: string | null;
    bd_alterdata: string;
    cdempresa_alterdata?: string | null;
    login_alterdata: string;
    senha_alterdata: string;
    is_default?: boolean | number;
}

export interface UpdateAlterdataConfigData {
    name?: string;
    serv_alterdata?: string;
    porta_alterdata?: string | null;
    bd_alterdata?: string;
    cdempresa_alterdata?: string | null;
    login_alterdata?: string;
    senha_alterdata?: string;
    is_default?: boolean | number;
}


