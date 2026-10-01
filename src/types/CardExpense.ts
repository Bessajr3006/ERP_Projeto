export interface CardExpense {
    id: number;
    public_id: string; // UUID
    company_id: number;
    date: string | Date;
    description: string;
    period: string; // YYYY-MM
    value: number;
    tempo?: string | null;
    category_id?: number | null;
    category_public_id?: string | null;
    category_name?: string | null;
    card_debit_id?: number | null;
    card_debit_public_id?: string | null;
    card_debit_description?: string | null;
    observation?: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface CreateCardExpenseData {
    date: string;
    description: string;
    period: string;
    value: number;
    tempo?: string | null | undefined;
    category_public_id?: string | null | undefined;
    card_debit_public_id?: string | null | undefined;
    observation?: string | null | undefined;
}

export interface UpdateCardExpenseData {
    date?: string | undefined;
    description?: string | undefined;
    period?: string | undefined;
    value?: number | undefined;
    tempo?: string | null | undefined;
    category_public_id?: string | null | undefined;
    card_debit_public_id?: string | null | undefined;
    observation?: string | null | undefined;
}
