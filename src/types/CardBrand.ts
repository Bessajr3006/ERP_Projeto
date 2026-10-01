export interface CardBrand {
    id: number;
    public_id: string;
    company_id: number;
    name: string;
    created_at?: Date;
    updated_at?: Date;
}

export interface CreateCardBrandData {
    name: string;
}

export interface UpdateCardBrandData {
    name?: string | undefined;
}
