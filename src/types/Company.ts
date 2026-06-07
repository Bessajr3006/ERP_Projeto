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
    allow_print_without_confirmation?: boolean;

    is_active?: boolean;
    is_system?: boolean;
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
    allow_print_without_confirmation?: boolean | undefined;
    is_active?: boolean | undefined;

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
}
