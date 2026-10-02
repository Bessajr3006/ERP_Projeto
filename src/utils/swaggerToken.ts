import { randomBytes, createHash } from 'crypto';

/**
 * Calcula o hash SHA-256 do token Swagger para armazenamento seguro no banco (M1).
 */
export function hashSwaggerToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Gera um novo token Swagger seguro no formato 'swg_' + 64 caracteres hexadecimais
 * e retorna tanto o token puro (para visualização única) quanto o hash para o banco.
 */
export function generateSwaggerToken(): { rawToken: string; tokenHash: string } {
    const rawToken = `swg_${randomBytes(32).toString('hex')}`;
    const tokenHash = hashSwaggerToken(rawToken);
    return { rawToken, tokenHash };
}
