export interface ProductType {
    id: number;
    public_id: string;
    company_id: number;
    name: string;
    description?: string | null;
    idprodutotipopos?: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface CreateProductTypeData {
    name: string;
    description?: string | null;
    idprodutotipopos?: string | null;
}

export interface UpdateProductTypeData {
    name?: string;
    description?: string | null;
    idprodutotipopos?: string | null;
}
