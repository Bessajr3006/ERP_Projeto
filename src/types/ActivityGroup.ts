export interface ActivityGroup {
    id: number;
    public_id: string;
    company_id: number;
    name: string;
    monthly_fee?: number | null;
    due_day?: number | null;
    operation_cost?: number | null;
    created_at?: Date;
    updated_at?: Date;
}

export interface CreateActivityGroupData {
    name: string;
    monthly_fee?: number | null | undefined;
    due_day?: number | null | undefined;
    operation_cost?: number | null | undefined;
}

export interface UpdateActivityGroupData {
    name?: string | undefined;
    monthly_fee?: number | null | undefined;
    due_day?: number | null | undefined;
    operation_cost?: number | null | undefined;
}
