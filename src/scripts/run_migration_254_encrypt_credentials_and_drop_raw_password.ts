import 'dotenv/config';
import pool from '../config/db';
import logger from '../config/logger';
import { RowDataPacket } from 'mysql2/promise';
import { encrypt } from '../utils/crypto';
import { hashSwaggerToken } from '../utils/swaggerToken';

const ENCRYPTED_PATTERN = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/i;

export async function runMigration254EncryptCredentialsAndDropRawPassword(): Promise<void> {
    logger.info('Running migration: run_migration_254_encrypt_credentials_and_drop_raw_password');
    let conn;
    try {
        conn = await pool.getConnection();

        // 1. Drop users.raw_password if exists
        try {
            const [cols] = await conn.query<RowDataPacket[]>(
                `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'raw_password'`
            );
            if (cols.length > 0) {
                logger.info('[Migration 254] Dropping column users.raw_password...');
                await conn.query(`ALTER TABLE users DROP COLUMN raw_password`);
                logger.info('[Migration 254] Column users.raw_password dropped successfully.');
            } else {
                logger.info('[Migration 254] Column users.raw_password already dropped.');
            }
        } catch (colErr) {
            logger.warn({ colErr }, '[Migration 254] Warning while checking/dropping users.raw_password');
        }

        // 2. Encrypt companies sensitive fields (certificate_password, senha_solidcon, senha_dorsal, senha_alterdata)
        // and hash swagger_api_token with SHA-256
        try {
            const [companies] = await conn.query<RowDataPacket[]>(
                `SELECT id, certificate_password, senha_solidcon, senha_dorsal, senha_alterdata, swagger_api_token 
                 FROM companies`
            );
            for (const comp of companies) {
                const updates: string[] = [];
                const values: any[] = [];

                if (comp.certificate_password && !ENCRYPTED_PATTERN.test(comp.certificate_password)) {
                    updates.push('certificate_password = ?');
                    values.push(encrypt(comp.certificate_password));
                }
                if (comp.senha_solidcon && !ENCRYPTED_PATTERN.test(comp.senha_solidcon)) {
                    updates.push('senha_solidcon = ?');
                    values.push(encrypt(comp.senha_solidcon));
                }
                if (comp.senha_dorsal && !ENCRYPTED_PATTERN.test(comp.senha_dorsal)) {
                    updates.push('senha_dorsal = ?');
                    values.push(encrypt(comp.senha_dorsal));
                }
                if (comp.senha_alterdata && !ENCRYPTED_PATTERN.test(comp.senha_alterdata)) {
                    updates.push('senha_alterdata = ?');
                    values.push(encrypt(comp.senha_alterdata));
                }
                if (comp.swagger_api_token && !SHA256_HEX_PATTERN.test(comp.swagger_api_token)) {
                    updates.push('swagger_api_token = ?');
                    values.push(hashSwaggerToken(comp.swagger_api_token));
                }

                if (updates.length > 0) {
                    values.push(comp.id);
                    await conn.query(`UPDATE companies SET ${updates.join(', ')} WHERE id = ?`, values);
                }
            }
            logger.info(`[Migration 254] Processed ${companies.length} companies for encryption and Swagger token hashing.`);
        } catch (compErr) {
            logger.warn({ compErr }, '[Migration 254] Warning while encrypting companies fields');
        }

        // 3. Encrypt company_poscontrol_configs (poscontrol_password, subscription_key, ocp_apim_subscription_key)
        try {
            const [tableExists] = await conn.query<RowDataPacket[]>(
                `SHOW TABLES LIKE 'company_poscontrol_configs'`
            );
            if (tableExists.length > 0) {
                const [configs] = await conn.query<RowDataPacket[]>(
                    `SELECT id, poscontrol_password, subscription_key, ocp_apim_subscription_key FROM company_poscontrol_configs`
                );
                for (const cfg of configs) {
                    const updates: string[] = [];
                    const values: any[] = [];

                    if (cfg.poscontrol_password && !ENCRYPTED_PATTERN.test(cfg.poscontrol_password)) {
                        updates.push('poscontrol_password = ?');
                        values.push(encrypt(cfg.poscontrol_password));
                    }
                    if (cfg.subscription_key && !ENCRYPTED_PATTERN.test(cfg.subscription_key)) {
                        updates.push('subscription_key = ?');
                        values.push(encrypt(cfg.subscription_key));
                    }
                    if (cfg.ocp_apim_subscription_key && !ENCRYPTED_PATTERN.test(cfg.ocp_apim_subscription_key)) {
                        updates.push('ocp_apim_subscription_key = ?');
                        values.push(encrypt(cfg.ocp_apim_subscription_key));
                    }

                    if (updates.length > 0) {
                        values.push(cfg.id);
                        await conn.query(`UPDATE company_poscontrol_configs SET ${updates.join(', ')} WHERE id = ?`, values);
                    }
                }
                logger.info(`[Migration 254] Encrypted credentials in company_poscontrol_configs.`);
            }
        } catch (posErr) {
            logger.warn({ posErr }, '[Migration 254] Warning while encrypting company_poscontrol_configs');
        }

        // 4. Encrypt company_solidcon_configs (senha_solidcon)
        try {
            const [tableExists] = await conn.query<RowDataPacket[]>(
                `SHOW TABLES LIKE 'company_solidcon_configs'`
            );
            if (tableExists.length > 0) {
                const [configs] = await conn.query<RowDataPacket[]>(
                    `SELECT id, senha_solidcon FROM company_solidcon_configs`
                );
                for (const cfg of configs) {
                    if (cfg.senha_solidcon && !ENCRYPTED_PATTERN.test(cfg.senha_solidcon)) {
                        await conn.query(
                            `UPDATE company_solidcon_configs SET senha_solidcon = ? WHERE id = ?`,
                            [encrypt(cfg.senha_solidcon), cfg.id]
                        );
                    }
                }
                logger.info(`[Migration 254] Encrypted credentials in company_solidcon_configs.`);
            }
        } catch (solErr) {
            logger.warn({ solErr }, '[Migration 254] Warning while encrypting company_solidcon_configs');
        }

        // 5. Encrypt company_dorsal_configs (senha_dorsal)
        try {
            const [tableExists] = await conn.query<RowDataPacket[]>(
                `SHOW TABLES LIKE 'company_dorsal_configs'`
            );
            if (tableExists.length > 0) {
                const [configs] = await conn.query<RowDataPacket[]>(
                    `SELECT id, senha_dorsal FROM company_dorsal_configs`
                );
                for (const cfg of configs) {
                    if (cfg.senha_dorsal && !ENCRYPTED_PATTERN.test(cfg.senha_dorsal)) {
                        await conn.query(
                            `UPDATE company_dorsal_configs SET senha_dorsal = ? WHERE id = ?`,
                            [encrypt(cfg.senha_dorsal), cfg.id]
                        );
                    }
                }
                logger.info(`[Migration 254] Encrypted credentials in company_dorsal_configs.`);
            }
        } catch (dorErr) {
            logger.warn({ dorErr }, '[Migration 254] Warning while encrypting company_dorsal_configs');
        }

        // 6. Encrypt company_alterdata_configs (senha_alterdata)
        try {
            const [tableExists] = await conn.query<RowDataPacket[]>(
                `SHOW TABLES LIKE 'company_alterdata_configs'`
            );
            if (tableExists.length > 0) {
                const [configs] = await conn.query<RowDataPacket[]>(
                    `SELECT id, senha_alterdata FROM company_alterdata_configs`
                );
                for (const cfg of configs) {
                    if (cfg.senha_alterdata && !ENCRYPTED_PATTERN.test(cfg.senha_alterdata)) {
                        await conn.query(
                            `UPDATE company_alterdata_configs SET senha_alterdata = ? WHERE id = ?`,
                            [encrypt(cfg.senha_alterdata), cfg.id]
                        );
                    }
                }
                logger.info(`[Migration 254] Encrypted credentials in company_alterdata_configs.`);
            }
        } catch (altErr) {
            logger.warn({ altErr }, '[Migration 254] Warning while encrypting company_alterdata_configs');
        }

        // 7. Encrypt certificate_password in customers, suppliers, contacts
        const entityTables = ['customers', 'suppliers', 'contacts'];
        for (const table of entityTables) {
            try {
                const [rows] = await conn.query<RowDataPacket[]>(
                    `SELECT id, certificate_password FROM \`${table}\` WHERE certificate_password IS NOT NULL AND certificate_password != ''`
                );
                for (const r of rows) {
                    if (r.certificate_password && !ENCRYPTED_PATTERN.test(r.certificate_password)) {
                        await conn.query(
                            `UPDATE \`${table}\` SET certificate_password = ? WHERE id = ?`,
                            [encrypt(r.certificate_password), r.id]
                        );
                    }
                }
                logger.info(`[Migration 254] Encrypted certificate_password in ${table} (${rows.length} rows checked).`);
            } catch (entErr) {
                logger.warn({ entErr }, `[Migration 254] Warning while encrypting ${table}.certificate_password`);
            }
        }

        logger.info('Migration run_migration_254_encrypt_credentials_and_drop_raw_password completed successfully!');
    } catch (err) {
        logger.error({ err }, 'Error during migration 254');
        throw err;
    } finally {
        if (conn) conn.release();
    }
}

if (require.main === module) {
    runMigration254EncryptCredentialsAndDropRawPassword().then(() => process.exit(0));
}
