export type BankAccountType = 'checking' | 'savings' | 'cash';

export interface BankAccount {
    id: number;
    public_id: string; // UUID
    company_id: number;
    name: string;
    institution?: string;
    type: BankAccountType;
    initial_balance: number;
    current_balance: number;
    agency_number?: string | null;
    account_number?: string | null;
    pix_key?: string | null;
    api_client_id?: string | null;
    api_client_secret?: string | null;
    api_certificate?: string | null;
    api_key?: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface CreateBankAccountData {
    name: string;
    institution?: string | undefined;
    type?: BankAccountType | undefined;
    initial_balance?: number | undefined;
    agency_number?: string | null | undefined;
    account_number?: string | null | undefined;
    pix_key?: string | null | undefined;
    api_client_id?: string | null | undefined;
    api_client_secret?: string | null | undefined;
    api_certificate?: string | null | undefined;
    api_key?: string | null | undefined;
}

export interface UpdateBankAccountData {
    name?: string | undefined;
    institution?: string | undefined;
    type?: BankAccountType | undefined;
    current_balance?: number | undefined;
    agency_number?: string | null | undefined;
    account_number?: string | null | undefined;
    pix_key?: string | null | undefined;
    api_client_id?: string | null | undefined;
    api_client_secret?: string | null | undefined;
    api_certificate?: string | null | undefined;
    api_key?: string | null | undefined;
}
