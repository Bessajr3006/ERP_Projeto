export interface CustomerGroup {
    id: number;
    public_id: string;
    company_id: number;
    name: string;
    created_at?: Date;
    updated_at?: Date;
}

export interface CreateCustomerGroupData {
    name: string;
}

export interface UpdateCustomerGroupData {
    name?: string | undefined;
}
