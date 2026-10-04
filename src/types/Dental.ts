export type DentalDentition = 'permanent' | 'deciduous' | 'mixed';

export type ToothCondition = 'present' | 'absent' | 'extracted' | 'implant' | 'unerupted' | 'retained';
export type DentalToothCondition = ToothCondition;

export type DentalFace = 'M' | 'D' | 'O' | 'I' | 'V' | 'L' | 'P';

export type DentalRegion = 'tooth' | 'upper_arch' | 'lower_arch' | 'quadrant' | 'mouth';

export type DentalProcedureStatus = 'existing' | 'planned' | 'quoted' | 'approved' | 'done' | 'cancelled';

export interface DentalChartTooth {
    id: number;
    public_id: string;
    company_id: number;
    chart_id: number;
    tooth_code: number;
    condition: ToothCondition;
    notes: string | null;
    is_deleted?: boolean | number | undefined;
    created_at: Date | string;
    updated_at: Date | string | null;
}

export interface DentalProcedure {
    id: number;
    public_id: string;
    company_id: number;
    chart_id: number;
    customer_id: number;
    customer_public_id?: string | undefined;
    tooth_code: number | null;
    region: DentalRegion;
    faces: string | null;
    service_id: number | null;
    service_public_id?: string | null | undefined;
    service_name?: string | null | undefined;
    unit_price: number;
    status: DentalProcedureStatus;
    sales_order_id: number | null;
    sales_order_public_id?: string | null | undefined;
    sales_order_status?: string | null | undefined;
    sales_item_id: number | null;
    professional_user_id: number | null;
    professional_user_public_id?: string | null | undefined;
    professional_user_name?: string | null | undefined;
    planned_at: Date | string | null;
    performed_at: Date | string | null;
    notes: string | null;
    created_by_user_id: number | null;
    is_deleted?: boolean | number | undefined;
    created_at: Date | string;
    updated_at: Date | string | null;
}

export interface DentalChart {
    id: number;
    public_id: string;
    company_id: number;
    customer_id: number;
    customer_public_id?: string | undefined;
    customer_name?: string | undefined;
    dentition: DentalDentition;
    notes: string | null;
    is_deleted?: boolean | number | undefined;
    created_at: Date | string;
    updated_at: Date | string | null;
    teeth?: DentalChartTooth[] | undefined;
    procedures?: DentalProcedure[] | undefined;
}

export interface DentalChartDetails extends DentalChart {
    teeth: DentalChartTooth[];
    procedures: DentalProcedure[];
}

export interface CreateDentalChartInput {
    customer_public_id: string;
    dentition?: DentalDentition | undefined;
    notes?: string | null | undefined;
}

export interface UpdateDentalChartInput {
    dentition?: DentalDentition | undefined;
    notes?: string | null | undefined;
}

export interface UpdateToothConditionInput {
    tooth_code: number;
    condition: ToothCondition;
    notes?: string | null | undefined;
}

export interface CreateDentalProcedureInput {
    tooth_code?: number | null | undefined;
    region?: DentalRegion | undefined;
    faces?: DentalFace[] | string | null | undefined;
    service_public_id?: string | null | undefined;
    service_id?: number | null | undefined;
    unit_price?: number | undefined;
    status?: DentalProcedureStatus | undefined;
    professional_user_public_id?: string | null | undefined;
    planned_at?: string | Date | null | undefined;
    performed_at?: string | Date | null | undefined;
    notes?: string | null | undefined;
}

export interface UpdateDentalProcedureInput {
    tooth_code?: number | null | undefined;
    region?: DentalRegion | undefined;
    faces?: DentalFace[] | string | null | undefined;
    service_public_id?: string | null | undefined;
    unit_price?: number | undefined;
    status?: DentalProcedureStatus | undefined;
    professional_user_public_id?: string | null | undefined;
    planned_at?: string | Date | null | undefined;
    performed_at?: string | Date | null | undefined;
    notes?: string | null | undefined;
}

export interface PerformDentalProcedureInput {
    professional_user_public_id?: string | null | undefined;
    performed_at?: string | Date | null | undefined;
}

export interface CreateDentalQuoteInput {
    procedure_public_ids: string[];
    seller_public_id?: string | null | undefined;
    validity_date?: string | null | undefined;
    observation?: string | null | undefined;
    payment_terms?: string | null | undefined;
}

export type CreateDentalChartQuoteInput = CreateDentalQuoteInput;

export interface ApproveQuoteInstallmentInput {
    amount: number;
    due_date: string;
    payment_method: 'pix' | 'credit' | 'debit' | 'cash' | 'transfer' | 'boleto';
}

export interface ApproveQuoteInput {
    bank_account_public_id: string;
    category_public_id: string;
    installments: ApproveQuoteInstallmentInput[];
}

export type ApproveQuoteData = ApproveQuoteInput;
