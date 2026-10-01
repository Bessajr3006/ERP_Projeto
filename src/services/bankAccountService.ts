import { randomUUID } from 'crypto';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { BankAccount, CreateBankAccountData, UpdateBankAccountData } from '../types/BankAccount';
import { encrypt, decrypt } from '../utils/crypto';
import { InterService } from './bankAccountApi/interService';
import { AsaasService } from './bankAccountApi/asaasService';
import logger from '../config/logger';

// Campos que devem ser criptografados no banco de dados
const SENSITIVE_FIELDS = [
    'api_client_id',
    'api_client_secret',
    'api_certificate',
    'api_key',
    'webhook_secret',
    'webhook_certificate',
    'webhook_key',
    'asaas_api_key',
    'asaas_webhook_token'
] as const;

/** Descriptografa os campos sensíveis de um account vindo do banco */
function decryptAccount(row: any): BankAccount {
    const account = { ...row } as any;
    for (const field of SENSITIVE_FIELDS) {
        account[field] = decrypt(account[field]);
    }
    return account as BankAccount;
}

export class BankAccountService {
    /**
     * Creates a new bank account bound to a company
     */
    static async create(companyId: number, data: CreateBankAccountData): Promise<BankAccount> {
        const {
            name,
            type = 'checking',
            institution = null,
            initial_balance = 0.00,
            agency_number = null,
            account_number = null,
            pix_key = null,
            api_client_id = null,
            api_client_secret = null,
            api_certificate = null,
            api_key = null,
            webhook_url = null,
            webhook_secret = null,
            webhook_certificate = null,
            webhook_key = null,
            webhook_event_transaction = 0,
            webhook_event_account = 0,
            webhook_event_status_sync = 0,
            webhook_event_boleto = 0,
            billet_fine = null,
            billet_interest = null,
            billet_validity = null,
            pix_fine = null,
            pix_interest = null,
            pix_validity = null,
            solidcon_bank_id = null,
            // Asaas
            asaas_environment = 'production',
            asaas_api_key = null,
            asaas_wallet_id = null,
            asaas_fine = null,
            asaas_interest = null,
            asaas_discount_value = null,
            asaas_discount_days = null,
            asaas_webhook_url = null,
            asaas_webhook_email = null,
            asaas_webhook_token = null,
            asaas_webhook_event_payment_created = 0,
            asaas_webhook_event_payment_updated = 0,
            asaas_webhook_event_payment_confirmed = 0,
            asaas_webhook_event_payment_received = 1,
            asaas_webhook_event_payment_overdue = 0,
            asaas_webhook_event_payment_deleted = 0,
            asaas_webhook_event_payment_restored = 0,
            asaas_webhook_event_payment_refunded = 0
        } = data;

        const publicId = randomUUID();

        const [result] = await pool.query<ResultSetHeader>(
              `INSERT INTO bank_accounts (
                  public_id, company_id, name, type, institution, initial_balance, current_balance, agency_number, account_number, pix_key,
                  api_client_id, api_client_secret, api_certificate, api_key, webhook_url, webhook_secret, webhook_certificate, webhook_key,
                  webhook_event_transaction, webhook_event_account, webhook_event_status_sync, webhook_event_boleto,
                  billet_fine, billet_interest, billet_validity, pix_fine, pix_interest, pix_validity, solidcon_bank_id,
                  asaas_environment, asaas_api_key, asaas_wallet_id, asaas_fine, asaas_interest, asaas_discount_value, asaas_discount_days,
                  asaas_webhook_url, asaas_webhook_email, asaas_webhook_token,
                  asaas_webhook_event_payment_created, asaas_webhook_event_payment_updated, asaas_webhook_event_payment_confirmed, asaas_webhook_event_payment_received,
                  asaas_webhook_event_payment_overdue, asaas_webhook_event_payment_deleted, asaas_webhook_event_payment_restored, asaas_webhook_event_payment_refunded
              )
              VALUES (
                  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                  ?, ?, ?, ?, ?, ?, ?, ?,
                  ?, ?, ?, ?,
                  ?, ?, ?, ?, ?, ?, ?,
                  ?, ?, ?, ?, ?, ?, ?,
                  ?, ?, ?,
                  ?, ?, ?, ?,
                  ?, ?, ?, ?
              )`,
              [
                  publicId, companyId, name, type, institution, initial_balance, initial_balance, agency_number, account_number, pix_key,
                  encrypt(api_client_id), encrypt(api_client_secret), encrypt(api_certificate), encrypt(api_key),
                  webhook_url, encrypt(webhook_secret), encrypt(webhook_certificate), encrypt(webhook_key),
                  webhook_event_transaction, webhook_event_account, webhook_event_status_sync, webhook_event_boleto,
                  billet_fine ?? null, billet_interest ?? null, billet_validity ?? null,
                  pix_fine ?? null, pix_interest ?? null, pix_validity ?? null, solidcon_bank_id || null,
                  asaas_environment || 'production', encrypt(asaas_api_key), asaas_wallet_id || null,
                  asaas_fine ?? null, asaas_interest ?? null, asaas_discount_value ?? null, asaas_discount_days ?? null,
                  asaas_webhook_url || null, asaas_webhook_email || null, encrypt(asaas_webhook_token),
                  asaas_webhook_event_payment_created ?? 0, asaas_webhook_event_payment_updated ?? 0, asaas_webhook_event_payment_confirmed ?? 0, asaas_webhook_event_payment_received ?? 1,
                  asaas_webhook_event_payment_overdue ?? 0, asaas_webhook_event_payment_deleted ?? 0, asaas_webhook_event_payment_restored ?? 0, asaas_webhook_event_payment_refunded ?? 0
              ]
        );

        if (result.affectedRows !== 1) {
            throw new Error('Failed to create bank account');
        }

        const createdAccount = await this.getById(result.insertId, companyId);

        // Webhook Inter
        if (webhook_url && webhook_event_boleto === 1 && api_client_id && api_client_secret && api_certificate && api_key) {
            try {
                await InterService.registerWebhook(createdAccount, webhook_url);
                if (createdAccount.pix_key) {
                    await InterService.registerPixWebhook(createdAccount, webhook_url);
                }
            } catch (err: any) {
                logger.error({ err }, `Falha ao registrar Webhook no Banco Inter na criacao da conta: ${err.message}`);
            }
        }

        // Webhook Asaas
        if (asaas_webhook_url && asaas_api_key) {
            try {
                await AsaasService.registerWebhook(createdAccount, asaas_webhook_url);
            } catch (err: any) {
                logger.error({ err }, `Falha ao registrar Webhook no Asaas na criacao da conta: ${err.message}`);
            }
        }

        return createdAccount;
    }

    /**
     * Retrieves a bank account by its internal ID and company
     */
    static async getById(id: number, companyId: number): Promise<BankAccount> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM bank_accounts WHERE id = ? AND company_id = ? LIMIT 1',
            [id, companyId]
        );

        if (!rows || rows.length === 0) {
            throw new Error('Bank account not found');
        }

        return decryptAccount(rows[0]);
    }

    /**
     * Retrieves a bank account by its public UUID
     */
    static async getByPublicId(publicId: string, companyId: number): Promise<BankAccount> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM bank_accounts WHERE public_id = ? AND company_id = ? LIMIT 1',
            [publicId, companyId]
        );

        if (!rows || rows.length === 0) {
            throw new Error('Bank account not found');
        }

        return decryptAccount(rows[0]);
    }

    /**
     * List all bank accounts for a company
     */
    static async listByCompany(companyId: number): Promise<BankAccount[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM bank_accounts WHERE company_id = ? ORDER BY created_at DESC',
            [companyId]
        );

        return (rows as any[]).map(decryptAccount);
    }

    /**
   * Updates bank account balances safely within a DB transaction context externally provided
   */
    static async updateBalance(
        connection: any, // expecting mysql2 promise connection, typed broadly to allow decoupling
        accountId: number,
        companyId: number,
        amountChange: number
    ): Promise<void> {

        const [result] = await connection.query(
            'UPDATE bank_accounts SET current_balance = current_balance + ? WHERE id = ? AND company_id = ?',
            [amountChange, accountId, companyId]
        );

        if (result.affectedRows !== 1) {
            throw new Error('Failed to update bank account balance or account not found');
        }
    }

    /**
     * Updates an existing bank account
     */
    static async update(publicId: string, companyId: number, data: UpdateBankAccountData): Promise<BankAccount> {
        const account = await this.getByPublicId(publicId, companyId);

        const name = data.name !== undefined ? data.name : account.name;
        const type = data.type !== undefined ? data.type : account.type;
        const institution = data.institution !== undefined ? data.institution : (account as any).institution;
        const current_balance = data.current_balance !== undefined ? data.current_balance : account.current_balance;

        const agency_number = data.agency_number !== undefined ? data.agency_number : account.agency_number;
        const account_number = data.account_number !== undefined ? data.account_number : account.account_number;
        const pix_key = data.pix_key !== undefined ? data.pix_key : account.pix_key;
        const api_client_id = data.api_client_id !== undefined ? data.api_client_id : account.api_client_id;
        const api_client_secret = data.api_client_secret !== undefined ? data.api_client_secret : account.api_client_secret;
        const api_certificate = data.api_certificate !== undefined ? data.api_certificate : account.api_certificate;
        const api_key = data.api_key !== undefined ? data.api_key : account.api_key;
        const webhook_url = data.webhook_url !== undefined ? data.webhook_url : account.webhook_url;
        const webhook_secret = data.webhook_secret !== undefined ? data.webhook_secret : account.webhook_secret;
        const webhook_certificate = data.webhook_certificate !== undefined ? data.webhook_certificate : account.webhook_certificate;
        const webhook_key = data.webhook_key !== undefined ? data.webhook_key : account.webhook_key;
        const webhook_event_transaction = data.webhook_event_transaction !== undefined ? data.webhook_event_transaction : account.webhook_event_transaction;
        const webhook_event_account = data.webhook_event_account !== undefined ? data.webhook_event_account : account.webhook_event_account;
        const webhook_event_status_sync = data.webhook_event_status_sync !== undefined ? data.webhook_event_status_sync : account.webhook_event_status_sync;
        const webhook_event_boleto = data.webhook_event_boleto !== undefined ? data.webhook_event_boleto : account.webhook_event_boleto;
        const billet_fine = data.billet_fine !== undefined ? data.billet_fine : account.billet_fine;
        const billet_interest = data.billet_interest !== undefined ? data.billet_interest : account.billet_interest;
        const billet_validity = data.billet_validity !== undefined ? data.billet_validity : account.billet_validity;
        const pix_fine = data.pix_fine !== undefined ? data.pix_fine : account.pix_fine;
        const pix_interest = data.pix_interest !== undefined ? data.pix_interest : account.pix_interest;
        const pix_validity = data.pix_validity !== undefined ? data.pix_validity : account.pix_validity;
        const solidcon_bank_id = data.solidcon_bank_id !== undefined ? data.solidcon_bank_id : account.solidcon_bank_id;

        // Asaas
        const asaas_environment = data.asaas_environment !== undefined ? data.asaas_environment : account.asaas_environment;
        const asaas_api_key = data.asaas_api_key !== undefined ? data.asaas_api_key : account.asaas_api_key;
        const asaas_wallet_id = data.asaas_wallet_id !== undefined ? data.asaas_wallet_id : account.asaas_wallet_id;
        const asaas_fine = data.asaas_fine !== undefined ? data.asaas_fine : account.asaas_fine;
        const asaas_interest = data.asaas_interest !== undefined ? data.asaas_interest : account.asaas_interest;
        const asaas_discount_value = data.asaas_discount_value !== undefined ? data.asaas_discount_value : account.asaas_discount_value;
        const asaas_discount_days = data.asaas_discount_days !== undefined ? data.asaas_discount_days : account.asaas_discount_days;
        const asaas_webhook_url = data.asaas_webhook_url !== undefined ? data.asaas_webhook_url : account.asaas_webhook_url;
        const asaas_webhook_email = data.asaas_webhook_email !== undefined ? data.asaas_webhook_email : account.asaas_webhook_email;
        const asaas_webhook_token = data.asaas_webhook_token !== undefined ? data.asaas_webhook_token : account.asaas_webhook_token;
        const asaas_webhook_event_payment_created = data.asaas_webhook_event_payment_created !== undefined ? data.asaas_webhook_event_payment_created : account.asaas_webhook_event_payment_created;
        const asaas_webhook_event_payment_updated = data.asaas_webhook_event_payment_updated !== undefined ? data.asaas_webhook_event_payment_updated : account.asaas_webhook_event_payment_updated;
        const asaas_webhook_event_payment_confirmed = data.asaas_webhook_event_payment_confirmed !== undefined ? data.asaas_webhook_event_payment_confirmed : account.asaas_webhook_event_payment_confirmed;
        const asaas_webhook_event_payment_received = data.asaas_webhook_event_payment_received !== undefined ? data.asaas_webhook_event_payment_received : account.asaas_webhook_event_payment_received;
        const asaas_webhook_event_payment_overdue = data.asaas_webhook_event_payment_overdue !== undefined ? data.asaas_webhook_event_payment_overdue : account.asaas_webhook_event_payment_overdue;
        const asaas_webhook_event_payment_deleted = data.asaas_webhook_event_payment_deleted !== undefined ? data.asaas_webhook_event_payment_deleted : account.asaas_webhook_event_payment_deleted;
        const asaas_webhook_event_payment_restored = data.asaas_webhook_event_payment_restored !== undefined ? data.asaas_webhook_event_payment_restored : account.asaas_webhook_event_payment_restored;
        const asaas_webhook_event_payment_refunded = data.asaas_webhook_event_payment_refunded !== undefined ? data.asaas_webhook_event_payment_refunded : account.asaas_webhook_event_payment_refunded;

        const [result] = await pool.query<ResultSetHeader>(
            `UPDATE bank_accounts SET 
                name = ?, type = ?, institution = ?, current_balance = ?, agency_number = ?, account_number = ?, pix_key = ?, 
                api_client_id = ?, api_client_secret = ?, api_certificate = ?, api_key = ?, 
                webhook_url = ?, webhook_secret = ?, webhook_certificate = ?, webhook_key = ?, 
                webhook_event_transaction = ?, webhook_event_account = ?, webhook_event_status_sync = ?, webhook_event_boleto = ?, 
                billet_fine = ?, billet_interest = ?, billet_validity = ?, pix_fine = ?, pix_interest = ?, pix_validity = ?, solidcon_bank_id = ?,
                asaas_environment = ?, asaas_api_key = ?, asaas_wallet_id = ?, asaas_fine = ?, asaas_interest = ?, asaas_discount_value = ?, asaas_discount_days = ?,
                asaas_webhook_url = ?, asaas_webhook_email = ?, asaas_webhook_token = ?,
                asaas_webhook_event_payment_created = ?, asaas_webhook_event_payment_updated = ?, asaas_webhook_event_payment_confirmed = ?, asaas_webhook_event_payment_received = ?,
                asaas_webhook_event_payment_overdue = ?, asaas_webhook_event_payment_deleted = ?, asaas_webhook_event_payment_restored = ?, asaas_webhook_event_payment_refunded = ?,
                updated_at = NOW() 
            WHERE id = ? AND company_id = ?`,
            [
                name, type, institution || null, current_balance, agency_number || null, account_number || null, pix_key || null,
                encrypt(api_client_id || null), encrypt(api_client_secret || null), encrypt(api_certificate || null), encrypt(api_key || null),
                webhook_url || null, encrypt(webhook_secret || null), encrypt(webhook_certificate || null), encrypt(webhook_key || null),
                webhook_event_transaction ?? 0, webhook_event_account ?? 0, webhook_event_status_sync ?? 0, webhook_event_boleto ?? 0,
                billet_fine ?? null, billet_interest ?? null, billet_validity ?? null,
                pix_fine ?? null, pix_interest ?? null, pix_validity ?? null, solidcon_bank_id || null,
                asaas_environment || 'production', encrypt(asaas_api_key || null), asaas_wallet_id || null,
                asaas_fine ?? null, asaas_interest ?? null, asaas_discount_value ?? null, asaas_discount_days ?? null,
                asaas_webhook_url || null, asaas_webhook_email || null, encrypt(asaas_webhook_token || null),
                asaas_webhook_event_payment_created ?? 0, asaas_webhook_event_payment_updated ?? 0, asaas_webhook_event_payment_confirmed ?? 0, asaas_webhook_event_payment_received ?? 1,
                asaas_webhook_event_payment_overdue ?? 0, asaas_webhook_event_payment_deleted ?? 0, asaas_webhook_event_payment_restored ?? 0, asaas_webhook_event_payment_refunded ?? 0,
                account.id, companyId
            ]
        );

        if (result.affectedRows !== 1) {
            throw new Error('Failed to update bank account');
        }

        // Inter Webhook Management
        if (webhook_url && webhook_event_boleto === 1 && api_client_id && api_client_secret && api_certificate && api_key) {
            try {
                const mergedAccount = {
                    ...account,
                    api_client_id,
                    api_client_secret,
                    api_certificate,
                    api_key,
                    pix_key
                };
                await InterService.registerWebhook(mergedAccount, webhook_url);
                if (pix_key) {
                    await InterService.registerPixWebhook(mergedAccount, webhook_url);
                }
            } catch (err: any) {
                logger.error({ err }, `Falha ao registrar Webhook no Banco Inter na atualizacao da conta: ${err.message}`);
            }
        } else if ((!webhook_url || webhook_event_boleto === 0) && account.webhook_url && account.webhook_event_boleto === 1 && api_client_id && api_client_secret && api_certificate && api_key) {
            try {
                const mergedAccount = {
                    ...account,
                    api_client_id,
                    api_client_secret,
                    api_certificate,
                    api_key
                };
                await InterService.deleteWebhook(mergedAccount);
                if (account.pix_key) {
                    await InterService.deletePixWebhook(mergedAccount);
                }
            } catch (err) {
                console.error('Failed to delete webhook with Inter API:', err);
            }
        }

        // Asaas Webhook Management
        if (asaas_webhook_url && asaas_api_key) {
            try {
                const mergedAsaasAccount = {
                    ...account,
                    asaas_environment,
                    asaas_api_key,
                    asaas_webhook_url,
                    asaas_webhook_email,
                    asaas_webhook_token,
                    asaas_webhook_event_payment_created,
                    asaas_webhook_event_payment_updated,
                    asaas_webhook_event_payment_confirmed,
                    asaas_webhook_event_payment_received,
                    asaas_webhook_event_payment_overdue,
                    asaas_webhook_event_payment_deleted,
                    asaas_webhook_event_payment_restored,
                    asaas_webhook_event_payment_refunded
                };
                await AsaasService.registerWebhook(mergedAsaasAccount, asaas_webhook_url);
            } catch (err: any) {
                logger.error({ err }, `Falha ao registrar Webhook no Asaas na atualizacao da conta: ${err.message}`);
            }
        }

        return this.getById(account.id, companyId);
    }

    /**
     * Deletes a bank account
     */
    static async delete(publicId: string, companyId: number): Promise<void> {
        const account = await this.getByPublicId(publicId, companyId);

        try {
            const [result] = await pool.query<ResultSetHeader>(
                'DELETE FROM bank_accounts WHERE id = ? AND company_id = ?',
                [account.id, companyId]
            );

            if (result.affectedRows !== 1) {
                throw new Error('Failed to delete bank account');
            }
        } catch (error: any) {
            // Handle Foreign Key constraint if it exists
            if (error.code === 'ER_ROW_IS_REFERENCED_2') {
                throw new Error('Cannot delete this bank account because it is being used in transactions. Please re-assign them first.');
            }
            throw error;
        }
    }

    /**
     * Obtém o relatório de saldos em tempo real de todas as contas bancárias da empresa
     */
    static async getRealtimeBalances(companyId: number): Promise<{
        summary: {
            totalDisponivel: number;
            totalBloqueado: number;
            totalLimite: number;
            totalGeral: number;
            totalContas: number;
            totalIntegradas: number;
        };
        accounts: Array<{
            id: number;
            public_id: string;
            name: string;
            type: string;
            institution?: string | null | undefined;
            agency_number?: string | null | undefined;
            account_number?: string | null | undefined;
            pix_key?: string | null | undefined;
            has_api: boolean;
            current_balance: number;
            initial_balance: number;
            realtime: {
                status: 'success' | 'not_configured' | 'error';
                disponivel: number;
                bloqueadoCheque: number;
                bloqueadoJudicial: number;
                bloqueadoAdministrativo: number;
                totalBloqueado: number;
                limite: number;
                totalMaster: number;
                consulted_at: string;
                error_message?: string | undefined;
            };
            difference: number;
        }>;
    }> {
        const rawAccounts = await this.listByCompany(companyId);

        let totalDisponivel = 0;
        let totalBloqueado = 0;
        let totalLimite = 0;
        let totalIntegradas = 0;

        const results = await Promise.all(
            rawAccounts.map(async (acc) => {
                const hasInterApi = Boolean(acc.api_client_id && acc.api_client_secret && acc.api_certificate && acc.api_key);
                const hasAsaasApi = Boolean(acc.asaas_api_key);
                const hasApi = hasInterApi || hasAsaasApi;

                const inst = String(acc.institution || '').toLowerCase();
                const isInter = inst.includes('inter') || hasInterApi;
                const isAsaas = inst.includes('asaas') || hasAsaasApi;

                const currentBal = Number(acc.current_balance || 0);

                let rtStatus: 'success' | 'not_configured' | 'error' = 'not_configured';
                let rtDisponivel = currentBal;
                let rtBloqueadoCheque = 0;
                let rtBloqueadoJudicial = 0;
                let rtBloqueadoAdministrativo = 0;
                let rtTotalBloqueado = 0;
                let rtLimite = 0;
                let rtTotalMaster = currentBal;
                let rtErrorMsg: string | undefined = undefined;

                if (hasInterApi && isInter) {
                    totalIntegradas++;
                    try {
                        const interBal = await InterService.getBalance(acc);
                        rtStatus = 'success';
                        rtDisponivel = interBal.disponivel;
                        rtBloqueadoCheque = interBal.bloqueadoCheque;
                        rtBloqueadoJudicial = interBal.bloqueadoJudicial;
                        rtBloqueadoAdministrativo = interBal.bloqueadoAdministrativo;
                        rtTotalBloqueado = interBal.totalBloqueado;
                        rtLimite = interBal.limite;
                        rtTotalMaster = interBal.totalMaster;
                    } catch (err: any) {
                        rtStatus = 'error';
                        rtErrorMsg = err?.message || 'Falha ao consultar saldo na API do Banco Inter';
                        logger.error({ err, bankId: acc.id }, '[BankAccountService] Erro ao obter saldo realtime Banco Inter');
                    }
                } else if (hasAsaasApi && isAsaas) {
                    totalIntegradas++;
                    try {
                        const asaasBal = await AsaasService.getBalance(acc);
                        rtStatus = 'success';
                        rtDisponivel = asaasBal.disponivel;
                        rtBloqueadoCheque = asaasBal.bloqueadoCheque;
                        rtBloqueadoJudicial = asaasBal.bloqueadoJudicial;
                        rtBloqueadoAdministrativo = asaasBal.bloqueadoAdministrativo;
                        rtTotalBloqueado = asaasBal.totalBloqueado;
                        rtLimite = asaasBal.limite;
                        rtTotalMaster = asaasBal.totalMaster;
                    } catch (err: any) {
                        rtStatus = 'error';
                        rtErrorMsg = err?.message || 'Falha ao consultar saldo na API do Asaas';
                        logger.error({ err, bankId: acc.id }, '[BankAccountService] Erro ao obter saldo realtime Asaas');
                    }
                }

                totalDisponivel += rtDisponivel;
                totalBloqueado += rtTotalBloqueado;
                totalLimite += rtLimite;

                const difference = rtStatus === 'success' ? Number((rtDisponivel - currentBal).toFixed(2)) : 0;

                return {
                    id: acc.id,
                    public_id: acc.public_id,
                    name: acc.name,
                    type: acc.type,
                    institution: acc.institution,
                    agency_number: acc.agency_number,
                    account_number: acc.account_number,
                    pix_key: acc.pix_key,
                    has_api: hasApi,
                    current_balance: currentBal,
                    initial_balance: Number(acc.initial_balance || 0),
                    realtime: {
                        status: rtStatus,
                        disponivel: rtDisponivel,
                        bloqueadoCheque: rtBloqueadoCheque,
                        bloqueadoJudicial: rtBloqueadoJudicial,
                        bloqueadoAdministrativo: rtBloqueadoAdministrativo,
                        totalBloqueado: rtTotalBloqueado,
                        limite: rtLimite,
                        totalMaster: rtTotalMaster,
                        consulted_at: new Date().toISOString(),
                        error_message: rtErrorMsg
                    },
                    difference
                };
            })
        );

        return {
            summary: {
                totalDisponivel: Number(totalDisponivel.toFixed(2)),
                totalBloqueado: Number(totalBloqueado.toFixed(2)),
                totalLimite: Number(totalLimite.toFixed(2)),
                totalGeral: Number((totalDisponivel + totalLimite).toFixed(2)),
                totalContas: rawAccounts.length,
                totalIntegradas
            },
            accounts: results
        };
    }
}
