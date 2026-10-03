/**
 * Tipos do módulo Odontograma (numeração dentária FDI / ISO 3950).
 */

/** Dentes permanentes: quadrantes 1-4, posições 1-8. */
export const FDI_PERMANENT_TEETH: readonly number[] = [
    18, 17, 16, 15, 14, 13, 12, 11,
    21, 22, 23, 24, 25, 26, 27, 28,
    48, 47, 46, 45, 44, 43, 42, 41,
    31, 32, 33, 34, 35, 36, 37, 38,
];

/** Dentes decíduos: quadrantes 5-8, posições 1-5. */
export const FDI_DECIDUOUS_TEETH: readonly number[] = [
    55, 54, 53, 52, 51,
    61, 62, 63, 64, 65,
    85, 84, 83, 82, 81,
    71, 72, 73, 74, 75,
];

export const FDI_ALL_TEETH: ReadonlySet<number> = new Set<number>([...FDI_PERMANENT_TEETH, ...FDI_DECIDUOUS_TEETH]);

export function isValidFdiToothCode(code: number): boolean {
    return Number.isInteger(code) && FDI_ALL_TEETH.has(code);
}

export const DENTITIONS = ['permanent', 'deciduous', 'mixed'] as const;
export type Dentition = typeof DENTITIONS[number];

export const TOOTH_CONDITIONS = ['present', 'absent', 'extracted', 'implant', 'unerupted', 'retained'] as const;
export type ToothCondition = typeof TOOTH_CONDITIONS[number];

export const PROCEDURE_REGIONS = ['tooth', 'upper_arch', 'lower_arch', 'quadrant', 'mouth'] as const;
export type ProcedureRegion = typeof PROCEDURE_REGIONS[number];

/** M=mesial, D=distal, O=oclusal, I=incisal, V=vestibular, L=lingual, P=palatina */
export const TOOTH_FACES = ['M', 'D', 'O', 'I', 'V', 'L', 'P'] as const;
export type ToothFace = typeof TOOTH_FACES[number];

export const PROCEDURE_STATUSES = ['existing', 'planned', 'quoted', 'approved', 'done', 'cancelled'] as const;
export type ProcedureStatus = typeof PROCEDURE_STATUSES[number];

export interface DentalChartInput {
    customer_public_id: string;
    dentition?: Dentition | undefined;
    notes?: string | null | undefined;
}

export interface DentalChartUpdateInput {
    dentition?: Dentition | undefined;
    notes?: string | null | undefined;
}

export interface DentalToothInput {
    tooth_code: number;
    condition: ToothCondition;
    notes?: string | null | undefined;
}

export interface DentalProcedureInput {
    tooth_code?: number | null | undefined;
    region?: ProcedureRegion | undefined;
    faces?: ToothFace[] | undefined;
    service_public_id?: string | null | undefined;
    unit_price?: number | null | undefined;
    status?: 'existing' | 'planned' | 'cancelled' | undefined;
    professional_user_id?: string | null | undefined;
    planned_at?: string | null | undefined;
    notes?: string | null | undefined;
}

export interface DentalQuoteInput {
    procedure_public_ids: string[];
    seller_public_id?: string | null | undefined;
    date?: string | null | undefined;
    validity_date?: string | null | undefined;
    observation?: string | null | undefined;
    payment_terms?: string | null | undefined;
}

export interface DentalPerformInput {
    professional_user_id?: string | null | undefined;
    performed_at?: string | null | undefined;
    notes?: string | null | undefined;
}

export interface DentalProcedureRow {
    id: number;
    public_id: string;
    company_id: number;
    chart_id: number;
    customer_id: number;
    tooth_code: number | null;
    region: ProcedureRegion;
    faces: string | null;
    service_id: number | null;
    unit_price: number;
    status: ProcedureStatus;
    sales_order_id: number | null;
    sales_item_id: number | null;
    professional_user_id: number | null;
    planned_at: string | null;
    performed_at: string | null;
    notes: string | null;
}
