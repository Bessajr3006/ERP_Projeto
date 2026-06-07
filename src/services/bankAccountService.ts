import { randomUUID } from 'crypto';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { BankAccount, CreateBankAccountData, UpdateBankAccountData } from '../types/BankAccount';
import { encrypt, decrypt } from '../utils/crypto';

// Campos que devem ser criptografados no banco de dados
const SENSITIVE_FIELDS = ['api_client_id', 'api_client_secret', 'api_certificate', 'api_key'] as const;

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
            api_key = null
        } = data;

        const publicId = randomUUID();

        const [result] = await pool.query<ResultSetHeader>(
              `INSERT INTO bank_accounts (public_id, company_id, name, type, institution, initial_balance, current_balance, agency_number, account_number, pix_key, api_client_id, api_client_secret, api_certificate, api_key)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [publicId, companyId, name, type, institution, initial_balance, initial_balance, agency_number, account_number, pix_key,
                encrypt(api_client_id), encrypt(api_client_secret), encrypt(api_certificate), encrypt(api_key)]
        );

        if (result.affectedRows !== 1) {
            throw new Error('Failed to create bank account');
        }

        return this.getById(result.insertId, companyId);
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

        const [result] = await pool.query<ResultSetHeader>(
            'UPDATE bank_accounts SET name = ?, type = ?, institution = ?, current_balance = ?, agency_number = ?, account_number = ?, pix_key = ?, api_client_id = ?, api_client_secret = ?, api_certificate = ?, api_key = ?, updated_at = NOW() WHERE id = ? AND company_id = ?',
            [name, type, institution || null, current_balance, agency_number || null, account_number || null, pix_key || null,
                encrypt(api_client_id || null), encrypt(api_client_secret || null), encrypt(api_certificate || null), encrypt(api_key || null),
                account.id, companyId]
        );

        if (result.affectedRows !== 1) {
            throw new Error('Failed to update bank account');
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
