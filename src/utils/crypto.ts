/**
 * Utilitário de criptografia de campos sensíveis com AES-256-GCM.
 *
 * Por que AES-256-GCM e não AES-256-CBC?
 * - GCM inclui autenticação (AEAD): detecta adulteração dos dados no banco.
 * - Cada encrypt gera um IV único de 12 bytes — sem risco de reutilização.
 * - Padrão recomendado pelo NIST para novas implementações.
 *
 * Formato armazenado no banco (texto): iv:authTag:ciphertext (tudo em hex)
 *
 * ENCRYPTION_KEY: deve ser uma string hexadecimal de 64 caracteres (32 bytes = 256 bits).
 * Gere com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;      // 12 bytes é o padrão recomendado para GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const ENCRYPTED_PATTERN = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/;

function getKey(): Buffer {
    const keyHex = process.env.ENCRYPTION_KEY;

    if (!keyHex) {
        throw new Error(
            '[Crypto] ENCRYPTION_KEY não definida no .env. ' +
            'Gere com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
        );
    }

    if (keyHex.length !== 64) {
        throw new Error(
            `[Crypto] ENCRYPTION_KEY inválida: esperado 64 caracteres hex (32 bytes), recebido ${keyHex.length}.`
        );
    }

    return Buffer.from(keyHex, 'hex');
}

/**
 * Criptografa um valor usando AES-256-GCM.
 * Retorna null se o valor for null ou undefined.
 */
export function encrypt(plaintext: string | null | undefined): string | null {
    if (plaintext == null) return null;

    const key = getKey();
    const iv = randomBytes(IV_LENGTH);

    const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

    const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final()
    ]);

    const authTag = cipher.getAuthTag();

    // Formato: iv:authTag:ciphertext (tudo em hex, separado por ':')
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Descriptografa um valor previamente criptografado com encrypt().
 * Retorna null se o valor for null, undefined ou vazio.
 * Lança erro se o authTag falhar (dados adulterados).
 */
export function decrypt(ciphertext: string | null | undefined): string | null {
    if (!ciphertext) return null;

    // Allow legacy/plain values without crashing (migration script can fix later)
    if (!ENCRYPTED_PATTERN.test(ciphertext)) {
        return ciphertext;
    }

    const parts = ciphertext.split(':');

    if (parts.length !== 3) {
        throw new Error('[Crypto] Formato de dado criptografado inválido.');
    }

    const [ivHex, authTagHex, encryptedHex] = [parts[0]!, parts[1]!, parts[2]!] as [string, string, string];
    const key = getKey();

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');

    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final() // lança erro se autenticação falhar
    ]);

    return decrypted.toString('utf8');
}

/**
 * Criptografa um objeto de campos sensíveis.
 * Passa campos não-sensíveis intactos.
 */
export function encryptFields<T extends Record<string, any>>(
    data: T,
    sensitiveKeys: (keyof T)[]
): T {
    const result = { ...data };
    for (const key of sensitiveKeys) {
        if (key in result) {
            (result as any)[key] = encrypt(result[key]);
        }
    }
    return result;
}

/**
 * Descriptografa um objeto de campos sensíveis.
 * Passa campos não-sensíveis intactos.
 */
export function decryptFields<T extends Record<string, any>>(
    data: T,
    sensitiveKeys: (keyof T)[]
): T {
    const result = { ...data };
    for (const key of sensitiveKeys) {
        if (key in result) {
            (result as any)[key] = decrypt(result[key]);
        }
    }
    return result;
}
