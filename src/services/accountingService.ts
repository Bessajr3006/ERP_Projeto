import { ChartOfAccount, ChartOfAccountSchema, AccountingRepository } from '../repositories/accountingRepository';

export { ChartOfAccount, ChartOfAccountSchema };

export class AccountingService {
    static async createAccount(
        companyId: number,
        data: { code: string; easy_code?: string | null | undefined; name: string; type: 'synthetic' | 'analytic'; nature: 'debit' | 'credit'; status?: 'active' | 'inactive' | undefined }
    ): Promise<ChartOfAccount> {
        return AccountingRepository.createAccount(companyId, data);
    }

    static async getAccountById(id: number, companyId: number): Promise<ChartOfAccount> {
        return AccountingRepository.getAccountById(id, companyId);
    }

    static async listAccounts(companyId: number): Promise<ChartOfAccount[]> {
        return AccountingRepository.listAccounts(companyId);
    }

    static async updateAccount(
        publicId: string,
        companyId: number,
        data: { code: string; easy_code?: string | null | undefined; name: string; type: 'synthetic' | 'analytic'; nature: 'debit' | 'credit'; status?: 'active' | 'inactive' | undefined }
    ): Promise<ChartOfAccount> {
        return AccountingRepository.updateAccount(publicId, companyId, data);
    }

    static async deleteAccount(publicId: string, companyId: number): Promise<void> {
        return AccountingRepository.deleteAccount(publicId, companyId);
    }

    static async batchDeleteAccounts(publicIds: string[], companyId: number): Promise<void> {
        return AccountingRepository.batchDeleteAccounts(publicIds, companyId);
    }

    static async batchUpsertAccounts(
        companyId: number, 
        accounts: Array<{ code: string; easy_code?: string; name: string; type: 'synthetic' | 'analytic'; nature: 'debit' | 'credit'; status?: 'active' | 'inactive' }>
    ): Promise<{ success: number; errors: string[] }> {
        return AccountingRepository.batchUpsertAccounts(companyId, accounts);
    }
}
