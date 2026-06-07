export type UserRole = string;

export interface User {
    id: number;
    public_id: string; // UUID
    company_id: number; // For foreign key reference strictly inside service logic
    email: string;
    password_hash: string;
    full_name: string;
    cpf_cnpj?: string | null;
    phone?: string | null;
    zipcode?: string | null;
    street?: string | null;
    number?: string | null;
    complement?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    default_page?: string | null;
    whatsapp_auto_reply_mode?: 'automatic' | 'manual' | null;
    role: UserRole;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface UserRegistrationData {
    company_id: number;
    email: string;
    passwordRaw: string;
    full_name: string;
    cpf_cnpj?: string | null;
    phone?: string | null;
    zipcode?: string | null;
    street?: string | null;
    number?: string | null;
    complement?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    default_page?: string | null;
    whatsapp_auto_reply_mode?: 'automatic' | 'manual' | null;
}

export interface UserLoginData {
    email: string;
    passwordRaw: string;
}

export interface AuthResult {
    token: string;
    user: {
        public_id: string;
        email: string;
        full_name: string;
        role: UserRole;
        company_id: number;
        default_page?: string | null;
    };
}
