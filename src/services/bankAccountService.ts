import { randomUUID } from 'crypto';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { BankAccount, CreateBankAccountData, UpdateBankAccountData } from '../types/BankAccount';
import { encrypt, decrypt } from '../utils/crypto';
import { InterService } from './bankAccountApi/interService';

// Campos que devem ser criptografados no banco de dados
const SENSITIVE_FIELDS = ['api_client_id', 'api_client_secret', 'api_certificate', 'api_key', 'webhook_secret', 'webhook_certificate', 'webhook_key'] as const;

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
            webhook_event_boleto = 0
        } = data;

        const publicId = randomUUID();

        const [result] = await pool.query<ResultSetHeader>(
              `INSERT INTO bank_accounts (public_id, company_id, name, type, institution, initial_balance, current_balance, agency_number, account_number, pix_key, api_client_id, api_client_secret, api_certificate, api_key, webhook_url, webhook_secret, webhook_certificate, webhook_key, webhook_event_transaction, webhook_event_account, webhook_event_status_sync, webhook_event_boleto)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [publicId, companyId, name, type, institution, initial_balance, initial_balance, agency_number, account_number, pix_key,
                encrypt(api_client_id), encrypt(api_client_secret), encrypt(api_certificate), encrypt(api_key),
                webhook_url, encrypt(webhook_secret), encrypt(webhook_certificate), encrypt(webhook_key),
                webhook_event_transaction, webhook_event_account, webhook_event_status_sync, webhook_event_boleto]
        );

        if (result.affectedRows !== 1) {
            throw new Error('Failed to create bank account');
        }

        const createdAccount = await this.getById(result.insertId, companyId);

        if (webhook_url && webhook_event_boleto === 1 && api_client_id && api_client_secret && api_certificate && api_key) {
            try {
                await InterService.registerWebhook(createdAccount, webhook_url);
                if (createdAccount.pix_key) {
                    await InterService.registerPixWebhook(createdAccount, webhook_url);
                }
            } catch (err: any) {
                throw new Error(`Falha ao registrar Webhook no Banco Inter: ${err.message}`);
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

        const [result] = await pool.query<ResultSetHeader>(
            'UPDATE bank_accounts SET name = ?, type = ?, institution = ?, current_balance = ?, agency_number = ?, account_number = ?, pix_key = ?, api_client_id = ?, api_client_secret = ?, api_certificate = ?, api_key = ?, webhook_url = ?, webhook_secret = ?, webhook_certificate = ?, webhook_key = ?, webhook_event_transaction = ?, webhook_event_account = ?, webhook_event_status_sync = ?, webhook_event_boleto = ?, updated_at = NOW() WHERE id = ? AND company_id = ?',
            [name, type, institution || null, current_balance, agency_number || null, account_number || null, pix_key || null,
                encrypt(api_client_id || null), encrypt(api_client_secret || null), encrypt(api_certificate || null), encrypt(api_key || null),
                webhook_url || null, encrypt(webhook_secret || null), encrypt(webhook_certificate || null), encrypt(webhook_key || null),
                webhook_event_transaction ?? 0, webhook_event_account ?? 0, webhook_event_status_sync ?? 0, webhook_event_boleto ?? 0,
                account.id, companyId]
        );

        if (result.affectedRows !== 1) {
            throw new Error('Failed to update bank account');
        }

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
                throw new Error(`Falha ao registrar Webhook no Banco Inter: ${err.message}`);
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
}
