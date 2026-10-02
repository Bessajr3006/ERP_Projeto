/**
 * Serializadores e DTOs para sanitização de dados sensíveis retornados pela API (A2, A3, M1).
 *
 * Garante que segredos nunca sejam vazados em endpoints como:
 * - /auth/me
 * - GET /users e GET /users/:id
 * - GET /companies e GET /companies/:id
 * - Configurações de terceiros (Solidcon, Dorsal, Alterdata, POSControl, Banco Inter/Asaas)
 */

const FORBIDDEN_USER_KEYS = new Set([
    'password',
    'password_hash',
    'passwordRaw',
    'raw_password',
    'current_session_token',
    'face_descriptor',
    'facial_vector',
    'face_embedding',
    'descriptor'
]);

const FORBIDDEN_COMPANY_KEYS = new Set([
    'certificate_password',
    'swagger_api_token',
    'api_token',
    'solidcon_api_token',
    'csc_token',
    'serv_solidcon',
    'bd_solidcon',
    'login_solidcon',
    'senha_solidcon',
    'serv_dorsal',
    'bd_dorsal',
    'login_dorsal',
    'senha_dorsal',
    'serv_alterdata',
    'porta_alterdata',
    'bd_alterdata',
    'cdempresa_alterdata',
    'login_alterdata',
    'senha_alterdata'
]);

export function serializeSafeUser<T extends Record<string, any>>(user: T | null | undefined): Record<string, any> | null {
    if (!user) return null;

    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(user)) {
        if (!FORBIDDEN_USER_KEYS.has(key)) {
            sanitized[key] = value;
        }
    }

    // Flag segura para indicação de biometria facial sem vazar vetor
    if ('face_descriptor' in user) {
        sanitized.has_face_registered = Boolean((user as any).face_descriptor);
    }

    return sanitized;
}

export function serializeSafeUsers<T extends Record<string, any>>(users: T[] | null | undefined): Record<string, any>[] {
    if (!Array.isArray(users)) return [];
    return users.map(u => serializeSafeUser(u)).filter(Boolean) as Record<string, any>[];
}

export function serializeSafeCompany<T extends Record<string, any>>(company: T | null | undefined): Record<string, any> | null {
    if (!company) return null;

    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(company)) {
        if (!FORBIDDEN_COMPANY_KEYS.has(key)) {
            sanitized[key] = value;
        }
    }

    // Flags informativas seguras sem vazar segredos
    sanitized.has_certificate_password = Boolean((company as any).certificate_password);
    sanitized.has_swagger_token = Boolean((company as any).swagger_api_token);
    sanitized.has_solidcon_configured = Boolean((company as any).serv_solidcon || (company as any).senha_solidcon);
    sanitized.has_dorsal_configured = Boolean((company as any).serv_dorsal || (company as any).senha_dorsal);
    sanitized.has_alterdata_configured = Boolean((company as any).serv_alterdata || (company as any).senha_alterdata);

    return sanitized;
}

export function serializeSafeCompanies<T extends Record<string, any>>(companies: T[] | null | undefined): Record<string, any>[] {
    if (!Array.isArray(companies)) return [];
    return companies.map(c => serializeSafeCompany(c)).filter(Boolean) as Record<string, any>[];
}

export function serializeSafePosControlConfig<T extends Record<string, any>>(config: T | null | undefined): Record<string, any> | null {
    if (!config) return null;
    const { poscontrol_password, subscription_key, ocp_apim_subscription_key, ...safe } = config as any;
    return {
        ...safe,
        has_password: Boolean(poscontrol_password),
        has_subscription_key: Boolean(subscription_key || ocp_apim_subscription_key)
    };
}

export function serializeSafeSolidconConfig<T extends Record<string, any>>(config: T | null | undefined): Record<string, any> | null {
    if (!config) return null;
    const { senha_solidcon, ...safe } = config as any;
    return {
        ...safe,
        has_password: Boolean(senha_solidcon)
    };
}

export function serializeSafeDorsalConfig<T extends Record<string, any>>(config: T | null | undefined): Record<string, any> | null {
    if (!config) return null;
    const { senha_dorsal, ...safe } = config as any;
    return {
        ...safe,
        has_password: Boolean(senha_dorsal)
    };
}

export function serializeSafeAlterdataConfig<T extends Record<string, any>>(config: T | null | undefined): Record<string, any> | null {
    if (!config) return null;
    const { senha_alterdata, ...safe } = config as any;
    return {
        ...safe,
        has_password: Boolean(senha_alterdata)
    };
}

export function serializeSafeBankAccount<T extends Record<string, any>>(account: T | null | undefined): Record<string, any> | null {
    if (!account) return null;
    const {
        api_client_secret,
        api_certificate,
        api_key,
        webhook_secret,
        webhook_certificate,
        webhook_key,
        asaas_api_key,
        asaas_webhook_token,
        ...safe
    } = account as any;

    return {
        ...safe,
        has_api_credentials: Boolean(api_client_secret || api_key || asaas_api_key),
        has_api_certificate: Boolean(api_certificate)
    };
}
