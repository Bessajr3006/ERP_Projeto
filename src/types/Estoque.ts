export interface ProductCategory {
    id: number;
    public_id: string; // UUID
    company_id: number;
    name: string;
    description?: string;
    image_base64?: string | null;
    idgrupopos?: string | null;
    poscontrol_synced?: boolean;
    active?: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface CreateProductCategoryData {
    name: string;
    description?: string;
    image_base64?: string | null;
    idgrupopos?: string | null;
    poscontrol_synced?: boolean;
    active?: boolean;
}

export interface UpdateProductCategoryData {
    name?: string;
    description?: string;
    image_base64?: string | null;
    idgrupopos?: string | null;
    poscontrol_synced?: boolean;
    active?: boolean;
}

export interface StockType {
    id: number;
    public_id: string;
    company_id: number;
    name: string;
    description?: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface CreateStockTypeData {
    name: string;
    description?: string | null;
}

export interface UpdateStockTypeData {
    name?: string;
    description?: string | null;
}

export interface Manufacturer {
    id: number;
    public_id: string; // UUID
    company_id: number;
    name: string;
    cnpj?: string;
    phone?: string;
    email?: string;
    image_base64?: string;
    created_at: Date;
    updated_at: Date;
}

export interface CreateManufacturerData {
    name: string;
    cnpj?: string;
    phone?: string;
    email?: string;
    image_base64?: string;
}

export interface UpdateManufacturerData {
    name?: string;
    cnpj?: string;
    phone?: string;
    email?: string;
    image_base64?: string;
}

export interface TaxRule {
    id: number;
    public_id: string; // UUID
    company_id: number;
    name: string;
    csosn?: string;
    icms_type?: string;
    service_code?: string;
    cst_icms?: string;
    icms_percentage: number;
    mva_internal_percentage?: number;
    mva_interstate_percentage?: number;
    fecp_percentage: number;
    ipi_percentage: number;
    cst_pis?: string;
    pis_percentage: number;
    cst_cofins?: string;
    cofins_percentage: number;
    iss_percentage: number;
    cst_ibs?: string;
    ibs_percentage: number;
    cst_cbs?: string;
    cbs_percentage: number;
    cst_is?: string;
    is_percentage: number;
    created_at: Date;
    updated_at: Date;
}

export interface CreateTaxRuleData {
    name: string;
    csosn?: string;
    icms_type?: string;
    service_code?: string;
    cst_icms?: string;
    icms_percentage?: number;
    mva_internal_percentage?: number;
    mva_interstate_percentage?: number;
    fecp_percentage?: number;
    ipi_percentage?: number;
    cst_pis?: string;
    pis_percentage?: number;
    cst_cofins?: string;
    cofins_percentage?: number;
    iss_percentage?: number;
    cst_ibs?: string;
    ibs_percentage?: number;
    cst_cbs?: string;
    cbs_percentage?: number;
    cst_is?: string;
    is_percentage?: number;
}

export interface UpdateTaxRuleData {
    name?: string;
    csosn?: string;
    icms_type?: string;
    service_code?: string;
    cst_icms?: string;
    icms_percentage?: number;
    mva_internal_percentage?: number;
    mva_interstate_percentage?: number;
    fecp_percentage?: number;
    ipi_percentage?: number;
    cst_pis?: string;
    pis_percentage?: number;
    cst_cofins?: string;
    cofins_percentage?: number;
    iss_percentage?: number;
    cst_ibs?: string;
    ibs_percentage?: number;
    cst_cbs?: string;
    cbs_percentage?: number;
    cst_is?: string;
    is_percentage?: number;
}

export interface PriceTable {
    id: number;
    public_id: string; // UUID
    company_id: number;
    name: string;
    markup_percentage: number;
    status: 'active' | 'inactive';
    created_at: Date;
    updated_at: Date;
}

export interface CreatePriceTableData {
    name: string;
    markup_percentage?: number;
    status?: 'active' | 'inactive';
}

export interface UpdatePriceTableData {
    name?: string;
    markup_percentage?: number;
    status?: 'active' | 'inactive';
}

export interface Measure {
    id: number;
    public_id: string; // UUID
    company_id: number;
    name: string;
    abbreviation: string;
    idmedidapos?: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface CreateMeasureData {
    name: string;
    abbreviation: string;
    idmedidapos?: string | null;
}

export interface UpdateMeasureData {
    name?: string;
    abbreviation?: string;
    idmedidapos?: string | null;
}

export interface ServiceType {
    id: number;
    public_id: string; // UUID
    company_id: number;
    name: string;
    description?: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface CreateServiceTypeData {
    name: string;
    description?: string | null;
}

export interface UpdateServiceTypeData {
    name?: string;
    description?: string | null;
}

export interface Service {
    id: number;
    public_id: string; // UUID
    company_id: number;
    name: string;
    cost: number;
    tax_percent: number;
    tax_amount: number;
    total_cost: number;
    markup: number;
    price: number;
    description?: string | null;
    service_type_id?: number | null;
    service_type_public_id?: string | null;
    service_type_name?: string | null;
    municipal_tax_reference_id?: string | null;
    municipal_tax_reference_name?: string | null;
    federal_tax_reference_id?: string | null;
    federal_tax_reference_name?: string | null;
    national_tax_code?: string | null;
    municipal_tax_code?: string | null;
    nbs_item?: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface CreateServiceData {
    name: string;
    cost: number;
    tax_percent: number;
    tax_amount: number;
    total_cost: number;
    markup: number;
    price: number;
    description?: string | null;
    service_type_public_id?: string | null;
    municipal_tax_reference_id?: string | null;
    municipal_tax_reference_name?: string | null;
    federal_tax_reference_id?: string | null;
    federal_tax_reference_name?: string | null;
    national_tax_code?: string | null;
    municipal_tax_code?: string | null;
    nbs_item?: string | null;
}

export interface UpdateServiceData {
    name?: string;
    cost?: number;
    tax_percent?: number;
    tax_amount?: number;
    total_cost?: number;
    markup?: number;
    price?: number;
    description?: string | null;
    service_type_public_id?: string | null;
    municipal_tax_reference_id?: string | null;
    municipal_tax_reference_name?: string | null;
    federal_tax_reference_id?: string | null;
    federal_tax_reference_name?: string | null;
    national_tax_code?: string | null;
    municipal_tax_code?: string | null;
    nbs_item?: string | null;
}

export interface ServiceLaunch {
    id: number;
    public_id: string;
    company_id: number;
    customer_id: number;
    service_id?: number | null;
    customer_public_id: string;
    customer_name: string;
    service_public_id?: string | null;
    service_name?: string | null;
    product_id?: number | null;
    product_public_id?: string | null;
    product_name?: string | null;
    type?: 'service' | 'product';
    quantity: number;
    unit_price: number;
    total_price: number;
    observation?: string | null;
    revenue_public_id?: string | null;
    revenue_category_public_id?: string | null;
    revenue_bank_account_public_id?: string | null;
    revenue_date?: string | Date | null;
    revenue_payment_method?: string | null;
    revenue_status?: string | null;
    nfse_status?: 'draft' | 'transmitted';
    nfse_number?: string | null;
    nfse_verification_code?: string | null;
    nfse_issued_at?: Date | string | null;
    checklist?: any | null;
    created_at: Date;
    updated_at: Date;
}

export interface CreateServiceLaunchData {
    customer_public_id: string;
    service_public_id?: string | null;
    product_public_id?: string | null;
    quantity: number;
    unit_price: number;
    observation?: string | null;
    checklist?: any | null;
}

export interface UpdateServiceLaunchData {
    customer_public_id?: string;
    service_public_id?: string | null;
    product_public_id?: string | null;
    quantity?: number;
    unit_price?: number;
    observation?: string | null;
    checklist?: any | null;
}
