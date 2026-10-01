export interface Employee {
    id: number;
    public_id: string;
    company_id: number;
    name: string;
    cpf?: string | null | undefined;
    rg?: string | null | undefined;
    birth_date?: string | null | undefined;
    admission_date?: string | null | undefined;
    resignation_date?: string | null | undefined;
    salary: number;
    position?: string | null | undefined;
    phone?: string | null | undefined;
    email?: string | null | undefined;
    address?: string | null | undefined;
    city?: string | null | undefined;
    state?: string | null | undefined;
    zip_code?: string | null | undefined;
    status: 'active' | 'inactive';
    created_at?: Date | undefined;
    updated_at?: Date | undefined;
}

export interface CreateEmployeeData {
    name: string;
    cpf?: string | null | undefined;
    rg?: string | null | undefined;
    birth_date?: string | null | undefined;
    admission_date?: string | null | undefined;
    resignation_date?: string | null | undefined;
    salary?: number | undefined;
    position?: string | null | undefined;
    phone?: string | null | undefined;
    email?: string | null | undefined;
    address?: string | null | undefined;
    city?: string | null | undefined;
    state?: string | null | undefined;
    zip_code?: string | null | undefined;
    status?: 'active' | 'inactive' | undefined;
}

export interface UpdateEmployeeData {
    name?: string | undefined;
    cpf?: string | null | undefined;
    rg?: string | null | undefined;
    birth_date?: string | null | undefined;
    admission_date?: string | null | undefined;
    resignation_date?: string | null | undefined;
    salary?: number | undefined;
    position?: string | null | undefined;
    phone?: string | null | undefined;
    email?: string | null | undefined;
    address?: string | null | undefined;
    city?: string | null | undefined;
    state?: string | null | undefined;
    zip_code?: string | null | undefined;
    status?: 'active' | 'inactive' | undefined;
}
