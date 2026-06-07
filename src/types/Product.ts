export interface Product {
    id: number;
    public_id: string; // UUID
    company_id: number;
    name: string;
    description?: string;
    sku?: string;
    ean?: string;
    external_code?: string;
    is_imported?: boolean;
    ncm?: string;
    cest?: string;
    cost_price: number;
    selling_price: number;
    is_promotional?: boolean;
    promotional_price?: number;
    current_stock: number;
    min_stock: number;
    max_stock: number;
    category_id?: number | null;
    stock_type_id?: number | null;
    manufacturer_id?: number | null;
    tax_rule_id?: number | null;
    measure_id?: number | null;
    stock_type_name?: string | null;
    image_base64?: string | null;
    image_url?: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface CreateProductData {
    name: string;
    description?: string | undefined;
    sku?: string | undefined;
    ean?: string | undefined;
    external_code?: string | undefined;
    is_imported?: boolean | undefined;
    ncm?: string | undefined;
    cest?: string | undefined;
    cost_price?: number | undefined;
    selling_price?: number | undefined;
    is_promotional?: boolean | undefined;
    promotional_price?: number | undefined;
    initial_stock?: number | undefined;
    min_stock?: number | undefined;
    max_stock?: number | undefined;
    category_id?: number | null | undefined;
    stock_type_id?: number | null | undefined;
    manufacturer_id?: number | null | undefined;
    tax_rule_id?: number | null | undefined;
    measure_id?: number | null | undefined;
    image_base64?: string | null | undefined;
    image_url?: string | null | undefined;
}

export interface UpdateProductData {
    name?: string;
    description?: string;
    sku?: string;
    ean?: string;
    external_code?: string;
    is_imported?: boolean;
    ncm?: string;
    cest?: string;
    cost_price?: number;
    selling_price?: number;
    is_promotional?: boolean;
    promotional_price?: number;
    min_stock?: number | undefined;
    max_stock?: number | undefined;
    category_id?: number | null | undefined;
    stock_type_id?: number | null | undefined;
    manufacturer_id?: number | null | undefined;
    tax_rule_id?: number | null | undefined;
    measure_id?: number | null | undefined;
    image_base64?: string | null | undefined;
    image_url?: string | null | undefined;
}

export type MovementType = 'in' | 'out';

export interface InventoryMovement {
    id: number;
    company_id: number;
    product_id: number;
    type: MovementType;
    quantity: number;
    purchase_id?: number;
    sale_id?: number;
    date: Date;
}
