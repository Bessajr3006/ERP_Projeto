export interface ReceivableType {
    id: number;
    public_id: string;
    company_id: number;
    name: string;
    bank_account_id: number;
    created_at?: Date;
    updated_at?: Date;
    
    // Joined field
    bank_account_name?: string;
}

export interface CreateReceivableTypeData {
    name: string;
    bank_account_id: number;
}

export interface UpdateReceivableTypeData {
    name?: string | undefined;
    bank_account_id?: number | undefined;
}
