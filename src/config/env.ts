import 'dotenv/config';
import { z } from 'zod';

const FORBIDDEN_PLACEHOLDERS = new Set([
    'change_me',
    'troque_esta_senha',
    'troque_por_um_segredo_longo',
    'chave_hexadecimal_64_chars',
    'gere_uma_chave_hexadecimal_com_64_caracteres',
    'dev_jwt_secret_change_me',
    'dev_encryption_key_change_me',
    'fallback_secret_key_change_me_in_production',
    'erp_keystones_jwt_2026_default_change_me',
    'd29900758b6b5e78698dc47e0830f863d49fc92331f882bb89bf0925fab7148c',
    '0000000000000000000000000000000000000000000000000000000000000000',
    '30mariafn@'
]);

function isPlaceholder(val: string): boolean {
    const normalized = val.trim().toLowerCase();
    if (FORBIDDEN_PLACEHOLDERS.has(normalized)) return true;
    if (normalized.startsWith('change_me')) return true;
    return false;
}

export const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
    PORT: z.preprocess((v) => (v ? parseInt(String(v), 10) : 3000), z.number()).default(3000),
    DB_HOST: z.string().default('localhost'),
    DB_PORT: z.preprocess((v) => (v ? parseInt(String(v), 10) : 3306), z.number()).default(3306),
    DB_NAME: z.string().default('bessa_erp'),
    DB_USER: z.string().default('erp_app'),
    DB_PASSWORD: z.string({
        required_error: 'DB_PASSWORD é obrigatória',
    }).min(1, 'DB_PASSWORD não pode ser vazia')
      .refine((v) => !isPlaceholder(v), {
          message: 'DB_PASSWORD não pode conter valores de exemplo ou senhas inseguras conhecidas'
      }),
    DB_MIGRATION_USER: z.string().optional(),
    DB_MIGRATION_PASSWORD: z.string().optional(),
    JWT_SECRET: z.string({
        required_error: 'JWT_SECRET é obrigatória',
    }).min(32, 'JWT_SECRET deve ter no mínimo 32 caracteres')
      .refine((v) => !isPlaceholder(v), {
          message: 'JWT_SECRET não pode ser um valor de exemplo/placeholder'
      }),
    JWT_EXPIRES_IN: z.string().default('8h'),
    SALT_ROUNDS: z.preprocess((v) => (v ? parseInt(String(v), 10) : 10), z.number()).default(10),
    ENCRYPTION_KEY: z.string({
        required_error: 'ENCRYPTION_KEY é obrigatória',
    }).length(64, 'ENCRYPTION_KEY deve ter exatamente 64 caracteres hexadecimais (32 bytes AES-256)')
      .regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY deve conter apenas caracteres hexadecimais (0-9, a-f)')
      .refine((v) => !isPlaceholder(v), {
          message: 'ENCRYPTION_KEY não pode ser uma chave de exemplo/placeholder ou vazia'
      }),
    CORS_ORIGINS: z.string().optional(),
    SWAGGER_ENABLED: z.string().optional().default('false'),
    ASAAS_WEBHOOK_ACCESS_TOKEN: z.string().optional(),
    INTER_WEBHOOK_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function validateEnv(): Env {
    if (cachedEnv) return cachedEnv;

    const result = envSchema.safeParse(process.env);
    if (!result.success) {
        console.error('================================================================');
        console.error('❌ ERRO CRÍTICO NA VALIDAÇÃO DE VARIÁVEIS DE AMBIENTE:');
        console.error('================================================================');
        const formatted = result.error.format();
        for (const [key, issues] of Object.entries(formatted)) {
            if (key === '_errors') continue;
            const issueList = (issues as any)?._errors || [];
            if (issueList.length > 0) {
                console.error(`  • ${key}: ${issueList.join('; ')}`);
            }
        }
        console.error('================================================================');
        console.error('A aplicação foi impedida de inicializar por motivos de segurança.');
        console.error('Configure as variáveis no seu .env ou nas variáveis do Portainer/Docker.');
        console.error('================================================================');
        process.exit(1);
    }

    cachedEnv = result.data;
    return cachedEnv;
}
