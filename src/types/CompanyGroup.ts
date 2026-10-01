export interface CompanyGroup {
    id: number;
    public_id: string;
    name: string;
    created_at?: Date;
    updated_at?: Date;
}

export interface CreateCompanyGroupData {
    name: string;
}

export interface UpdateCompanyGroupData {
    name?: string | undefined;
}
