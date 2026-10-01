export interface CardDebit {
    id: number;
    public_id: string; // UUID
    company_id: number;
    date: string | Date;
    description: string;
    period: string; // YYYY-MM
    value: number;
    card_name?: string | null;
    card_number?: string | null;
    due_date?: string | Date | null;
    card_expense_id?: number | null;
    card_expense_public_id?: string | null;
    card_expense_description?: string | null;
    tempo?: string | null;
    category_id?: number | null;
    category_public_id?: string | null;
    category_name?: string | null;
    observation?: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface CreateCardDebitData {
    date: string;
    description: string;
    period: string;
    value: number;
    card_name?: string | null | undefined;
    card_number?: string | null | undefined;
    due_date?: string | null | undefined;
    card_expense_public_id?: string | null | undefined;
    tempo?: string | null | undefined;
    category_public_id?: string | null | undefined;
    observation?: string | null | undefined;
}

export interface UpdateCardDebitData {
    date?: string | undefined;
    description?: string | undefined;
    period?: string | undefined;
    value?: number | undefined;
    card_name?: string | null | undefined;
    card_number?: string | null | undefined;
    due_date?: string | null | undefined;
    card_expense_public_id?: string | null | undefined;
    tempo?: string | null | undefined;
    category_public_id?: string | null | undefined;
    observation?: string | null | undefined;
}
