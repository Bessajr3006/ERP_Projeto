export interface CardConfiguration {
    id: number;
    public_id: string;
    company_id: number;
    receivable_type_id: number;
    card_brand_id: number | null;
    payment_type: string;
    tax_rate: number;
    due_days: number;
    service_fee: number;
    created_at?: Date;
    updated_at?: Date;

    // Joined fields
    receivable_type_name?: string;
    card_brand_name?: string;
    card_brand_public_id?: string;
}

export interface CreateCardConfigurationData {
    receivable_type_id: number;
    card_brand_id: number | null;
    payment_type: string;
    tax_rate: number;
    due_days: number;
    service_fee: number;
}

export interface UpdateCardConfigurationData {
    receivable_type_id?: number | undefined;
    card_brand_id?: number | null | undefined;
    payment_type?: string | undefined;
    tax_rate?: number | undefined;
    due_days?: number | undefined;
    service_fee?: number | undefined;
}
