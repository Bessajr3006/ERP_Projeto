export const APP_TIMEZONE = 'America/Sao_Paulo';

if (!process.env.TZ) {
    process.env.TZ = APP_TIMEZONE;
}
