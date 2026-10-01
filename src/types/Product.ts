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
    product_type_id?: number | null;
    manufacturer_id?: number | null;
    tax_rule_id?: number | null;
    measure_id?: number | null;
    stock_type_name?: string | null;
    stock_type_public_id?: string | null;
    product_type_name?: string | null;
    product_type_pos_id?: string | null;
    category_name?: string | null;
    category_pos_id?: string | null;
    image_base64?: string | null;
    measure_pos_id?: string | null;

    image_url?: string | null;
    idprodutopos?: string | null;
    status_pos_id?: string | null;
    poscontrol_synced?: boolean;
    active: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface CreateProductData {
    name: string;
    description?: string | null | undefined;
    sku?: string | null | undefined;
    ean?: string | null | undefined;
    external_code?: string | null | undefined;
    is_imported?: boolean | undefined;
    ncm?: string | null | undefined;
    cest?: string | null | undefined;
    cost_price?: number | undefined;
    selling_price?: number | undefined;
    is_promotional?: boolean | undefined;
    promotional_price?: number | undefined;
    initial_stock?: number | undefined;
    min_stock?: number | undefined;
    max_stock?: number | undefined;
    category_id?: number | null | undefined;
    stock_type_id?: number | null | undefined;
    product_type_id?: number | null | undefined;
    manufacturer_id?: number | null | undefined;
    tax_rule_id?: number | null | undefined;
    measure_id?: number | null | undefined;
    image_base64?: string | null | undefined;
    image_url?: string | null | undefined;
    idprodutopos?: string | null | undefined;
    status_pos_id?: string | null | undefined;
    poscontrol_synced?: boolean | undefined;
    active?: boolean | undefined;
}

export interface UpdateProductData {
    name?: string;
    description?: string | null;
    sku?: string | null;
    ean?: string | null;
    external_code?: string | null;
    is_imported?: boolean;
    ncm?: string | null;
    cest?: string | null;
    cost_price?: number;
    selling_price?: number;
    is_promotional?: boolean;
    promotional_price?: number;
    min_stock?: number | undefined;
    max_stock?: number | undefined;
    category_id?: number | null | undefined;
    stock_type_id?: number | null | undefined;
    product_type_id?: number | null | undefined;
    manufacturer_id?: number | null | undefined;
    tax_rule_id?: number | null | undefined;
    measure_id?: number | null | undefined;
    image_base64?: string | null | undefined;
    image_url?: string | null | undefined;
    idprodutopos?: string | null | undefined;
    status_pos_id?: string | null | undefined;
    poscontrol_synced?: boolean | undefined;
    active?: boolean | undefined;
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
