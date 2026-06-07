import pool from '../config/db';
import logger from '../config/logger';

const MAX_PASSES = 10;

export default async function runMigration() {
    let conn;
    try {
        conn = await pool.getConnection();

        logger.info('Running migration: run_migration_47_whatsapp_normalize_alias_history');

        let aliasPass = 0;
        let aliasUpdates = 0;
        while (aliasPass < MAX_PASSES) {
            const [result]: any = await conn.query(
                `UPDATE whatsapp_business_phone_aliases a
                 JOIN whatsapp_business_phone_aliases b
                   ON a.company_id = b.company_id
                  AND a.owner_type = b.owner_type
                  AND a.owner_id = b.owner_id
                  AND a.canonical_phone = b.alias_phone
                 SET a.canonical_phone = b.canonical_phone,
                     a.updated_at = CURRENT_TIMESTAMP
                 WHERE a.canonical_phone <> b.canonical_phone`
            );

            const changed = Number(result?.affectedRows || 0);
            aliasUpdates += changed;
            aliasPass += 1;
            if (!changed) break;
        }

        let messagePass = 0;
        let messageUpdates = 0;
        while (messagePass < MAX_PASSES) {
            const [result]: any = await conn.query(
                `UPDATE whatsapp_business_messages m
                 JOIN whatsapp_business_phone_aliases a
                   ON m.company_id = a.company_id
                  AND m.owner_type = a.owner_type
                  AND m.owner_id = a.owner_id
                  AND m.contact_phone = a.alias_phone
                 SET m.contact_phone = a.canonical_phone,
                     m.updated_at = CURRENT_TIMESTAMP
                 WHERE m.contact_phone <> a.canonical_phone`
            );

            const changed = Number(result?.affectedRows || 0);
            messageUpdates += changed;
            messagePass += 1;
            if (!changed) break;
        }

        logger.info(
            {
                aliasPasses: aliasPass,
                aliasUpdates,
                messagePasses: messagePass,
                messageUpdates,
            },
            'Migration run_migration_47_whatsapp_normalize_alias_history finished successfully!'
        );
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_47_whatsapp_normalize_alias_history');
        throw err;
    } finally {
        if (conn) conn.release();
    }
}
