export const ALLOWED_USER_ROLES = [
    'super_admin',
    'admin',
    'admin_basic',
    'supervisor',
    'manager',
    'financial',
    'seller',
    'operator',
    'pix_operator',
    'accountant',
    'auxiliar_contador',
    'socio',
    'buyer',
    'service_provider',
    'solidcon',
    'user'
] as const;

export type AllowedUserRole = typeof ALLOWED_USER_ROLES[number];

export const ROLE_LEVELS: Record<string, number> = {
    super_admin: 100,
    admin: 80,
    admin_basic: 70,
    supervisor: 60,
    manager: 50,
    financial: 30,
    accountant: 30,
    auxiliar_contador: 25,
    operator: 20,
    pix_operator: 20,
    socio: 20,
    seller: 20,
    buyer: 20,
    service_provider: 20,
    solidcon: 20,
    user: 10,
};

export function getRoleLevel(role?: string | null): number {
    if (!role) return 0;
    return ROLE_LEVELS[role] ?? 10;
}

/**
 * Retorna true se o executor tem permissão para gerenciar o papel alvo.
 * - super_admin pode gerenciar qualquer papel (incluindo outros super_admin).
 * - admin pode gerenciar qualquer papel dentro da empresa (incluindo outros admin), exceto super_admin.
 * - Demais papéis só podem gerenciar papéis com nível estritamente inferior ao seu.
 */
export function canManageRole(callerRole: string, targetRole: string): boolean {
    if (callerRole === 'super_admin') return true;
    if (targetRole === 'super_admin') return false;
    if (callerRole === 'admin') return true;
    return getRoleLevel(callerRole) > getRoleLevel(targetRole);
}
