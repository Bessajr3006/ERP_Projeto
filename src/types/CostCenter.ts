export interface CostCenter {
    id: number;
    public_id: string;
    company_id: number;
    name: string;
    description: string | null;
    is_active: number | boolean;
    created_at: string | Date;
    updated_at: string | Date;
}

export interface CreateCostCenterData {
    name: string;
    description?: string | null | undefined;
    is_active?: boolean | number | undefined;
}

export interface UpdateCostCenterData {
    name?: string | undefined;
    description?: string | null | undefined;
    is_active?: boolean | number | undefined;
}
