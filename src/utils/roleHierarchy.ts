export const ALLOWED_USER_ROLES = [
    'super_admin',
    'admin',
    'supervisor',
    'manager',
    'seller',
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
    supervisor: 60,
    manager: 50,
    accountant: 30,
    auxiliar_contador: 25,
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
 * Retorna true se o executor tem nível hierárquico superior ao papel alvo.
 * super_admin pode gerenciar qualquer papel.
 * Demais usuários só podem gerenciar papéis com nível estritamente inferior ao seu.
 */
export function canManageRole(callerRole: string, targetRole: string): boolean {
    if (callerRole === 'super_admin') return true;
    return getRoleLevel(callerRole) > getRoleLevel(targetRole);
}
