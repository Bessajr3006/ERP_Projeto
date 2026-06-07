export type OrderStatus = 'pending' | 'progress' | 'completed' | 'cancelled' | 'separated' | 'invoiced';

export interface PurchaseOrder {
    id: number;
    public_id: string; // UUID
    company_id: number;
    supplier_id: number;
    total_amount: number;
    status: OrderStatus;
    date: Date;
    created_at: Date;
    updated_at: Date;
}

export interface PurchaseItem {
    id: number;
    purchase_id: number;
    product_id: number;
    quantity: number;
    unit_price: number;
    total_price: number;
}

export interface CreatePurchaseItemData {
    product_public_id: string;
    quantity: number;
    unit_price: number;
}

export interface CreatePurchaseData {
    supplier_public_id: string;
    bank_account_public_id: string; // Needs a bank to execute the expense
    category_public_id: string; // Financial Category
    date: string | Date;
    items: CreatePurchaseItemData[];
}

export interface SalesOrder {
    id: number;
    public_id: string; // UUID
    company_id: number;
    customer_id?: number | null;
    total_amount: number;
    status: OrderStatus;
    date: Date;
    nfe_key?: string | null;
    nfe_issue_date?: Date | string | null;
    nfe_header_json?: string | null;
    delivery_address?: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface SalesItem {
    id: number;
    sale_id: number;
    product_id: number;
    quantity: number;
    unit_price: number;
    total_price: number;
    xml_item_data?: string | null;
}

export interface CreateSalesItemData {
    product_public_id: string;
    quantity: number;
    unit_price: number;
    xml_item_data?: Record<string, any> | string | null | undefined;
}

export interface CreateSalesPaymentData {
    method: string; // 'pix', 'credit', 'debit', 'cash', etc
    amount: number;
}

export interface CreateSalesData {
    customer_public_id?: string | null | undefined;
    delivery_address?: string | null | undefined;
    bank_account_public_id: string; // Needs a bank to receive the income
    category_public_id: string; // Financial Category
    date: string | Date;
    nfe_key?: string | null | undefined;
    nfe_issue_date?: string | Date | null | undefined;
    nfe_header_json?: Record<string, any> | string | null | undefined;
    items: CreateSalesItemData[];
    payments?: CreateSalesPaymentData[] | undefined;
}
