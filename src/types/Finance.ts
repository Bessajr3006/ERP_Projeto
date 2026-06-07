export interface Category {
    id: number;
    public_id: string; // UUID
    company_id: number;
    name: string;
    type: 'income' | 'expense';
    created_at: Date;
    updated_at: Date;
}

export interface CreateCategoryData {
    name: string;
    type: 'income' | 'expense';
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
