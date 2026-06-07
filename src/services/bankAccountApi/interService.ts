import { FinanceBankStatementRepository } from '../../repositories/financeBankStatementRepository';
import pool from '../../config/db';
import { randomUUID } from 'crypto';
import logger from '../../config/logger';
import * as https from 'https';

export class InterService {
    /**
     * Sincroniza o extrato do Banco Inter usando o Host Validado pelo Teste de Conexão
     */
    static async syncStatements(companyId: number, bankAccount: any, startDate: string, endDate: string): Promise<number> {
        const { api_client_id, api_client_secret, api_certificate, api_key } = bankAccount;

        if (!api_client_id || !api_client_secret || !api_certificate || !api_key) {
            throw new Error('Credenciais completas (ID, Secret, Certificado e Chave) são necessárias para a API do Inter.');
        }

        try {
            // 1. Obter Token mTLS (Usando o Host que funciona)
            const token = await this.getAccessToken(bankAccount);
            
            // 2. Consultar Extrato (V2 usa o caminho /banking/v2/extrato)
            // No Inter v2, o endpoint de extrato costuma ser diferente do v1
            const path = `/banking/v2/extrato?dataInicio=${startDate}&dataFim=${endDate}`;
            
            const response = await this.httpsRequest('cdpj.partners.bancointer.com.br', path, 'GET', {
                'Authorization': `Bearer ${token}`,
                'x-inter-conta-corrente': bankAccount.account_number
            }, bankAccount);

            const data = JSON.parse(response);
            const transactions = data?.transacoes || [];
            let syncedCount = 0;

            for (const tx of transactions) {
                const safeDate = this.normalizeTransactionDate(tx);
                if (!safeDate) {
                    logger.warn({ tx }, '[InterService] Ignoring statement without valid date');
                    continue;
                }

                const publicId = randomUUID();
                const type = tx.tipoLancamento === 'CREDITO' ? 'income' : 'expense';
                const amount = Math.abs(tx.valor);
                const description = tx.historico || 'Sem descrição';
                
                const exists = await FinanceBankStatementRepository.checkStatementExists(pool, companyId, bankAccount.id, {
                    date: safeDate,
                    amount: amount,
                    description,
                    type: type
                });

                if (!exists) {
                    await FinanceBankStatementRepository.upsertBankStatement(
                        pool,
                        companyId,
                        bankAccount.id,
                        publicId,
                        tx.nsu || tx.referencia || publicId,
                        safeDate,
                        description,
                        amount,
                        type,
                        JSON.stringify(tx)
                    );
                    syncedCount++;
                }
            }

            return syncedCount;
        } catch (error: any) {
            logger.error({ error: error.message }, '[InterService] Erro no sync');
            throw new Error(`Erro na API do Banco: ${error.message}`);
        }
    }

    private static async getAccessToken(account: any): Promise<string> {
        const payload = new URLSearchParams({
            client_id: account.api_client_id.trim(),
            client_secret: account.api_client_secret.trim(),
            grant_type: 'client_credentials',
            scope: 'extrato.read' 
        }).toString();

        const response = await this.httpsRequest('cdpj.partners.bancointer.com.br', '/oauth/v2/token', 'POST', {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(payload)
        }, account, payload);

        const data = JSON.parse(response);
        if (!data.access_token) throw new Error('Falha ao obter token de acesso.');
        return data.access_token;
    }

    private static normalizeTransactionDate(tx: any): string | null {
        const candidate = tx.dataLancamento || tx.dataMovimento || tx.data || tx.data_extrato || tx.date;
        if (!candidate) return null;

        const parsed = new Date(candidate);
        if (Number.isNaN(parsed.getTime())) return null;

        return parsed.toISOString().slice(0, 10);
    }

    private static httpsRequest(hostname: string, path: string, method: string, headers: any, account: any, payload?: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const cert = Buffer.from(account.api_certificate, 'base64').toString('ascii');
            const key = Buffer.from(account.api_key, 'base64').toString('ascii');

            const options = { hostname, port: 443, path, method, headers, cert, key };
            const req = https.request(options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => resolve(body));
            });
            req.on('error', reject);
            if (payload) req.write(payload);
            req.end();
        });
    }
}
