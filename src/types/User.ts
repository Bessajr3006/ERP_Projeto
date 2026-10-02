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
    whatsapp_enable_manual_billing?: boolean | number | null;
    whatsapp_auto_send_boleto?: boolean | number | null;
    role: UserRole;
    is_active: boolean;
    is_default_declaration_signer?: boolean | number | null;
    current_session_token?: string | null;
    current_session_ip?: string | null;
    current_session_location?: string | null;
    current_session_user_agent?: string | null;
    current_session_at?: Date | null;
    last_activity_at?: Date | null;
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
    whatsapp_enable_manual_billing?: boolean | number | null;
    whatsapp_auto_send_boleto?: boolean | number | null;
    is_default_declaration_signer?: boolean | number | null;
    role?: UserRole;
}

export interface UserLoginData {
    email: string;
    passwordRaw: string;
    force?: boolean | undefined;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
}

export interface ActiveSessionInfo {
    ip: string | null;
    location: string | null;
    user_agent: string | null;
    logged_at: Date | string | null;
    formatted_time?: string | undefined;
}

export interface AuthResult {
    token: string;
    user: {
        public_id: string;
        email: string;
        full_name: string;
        role: UserRole;
        company_id: number;
        default_page?: string | null | undefined;
        group_master_company_id?: number | null | undefined;
        general_admin_company_id?: number | null | undefined;
    };
}
