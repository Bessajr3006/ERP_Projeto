export interface Category {
    id: number;
    public_id: string; // UUID
    company_id: number;
    name: string;
    type: 'income' | 'expense';
    finance_category_type_id?: number | null;
    finance_category_type_public_id?: string | null;
    finance_category_type_name?: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface CreateCategoryData {
    name: string;
    type: 'income' | 'expense';
    finance_category_type_public_id?: string | null | undefined;
}

export interface FinanceCategoryType {
    id: number;
    public_id: string; // UUID
    company_id: number;
    name: string;
    description?: string | null | undefined;
    created_at: Date;
    updated_at: Date;
}

export interface CreateFinanceCategoryTypeData {
    name: string;
    description?: string | null | undefined;
}

export type TransactionStatus = 'pending' | 'paid' | 'cancelled';
export type TransactionType = 'income' | 'expense';

export interface Transaction {
    id: number;
    public_id: string; // UUID
    company_id: number;
    bank_account_id: number;
    category_id: number;
    user_id: number;
    purchase_id?: number;
    sale_id?: number;
    description: string;
    amount: number;
    type: TransactionType;
    date: Date;
    status: TransactionStatus;
    created_at: Date;
    updated_at: Date;
}
