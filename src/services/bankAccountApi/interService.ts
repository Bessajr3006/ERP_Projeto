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
                const type = (tx.tipoLancamento === 'CREDITO' || tx.tipoOperacao === 'C') ? 'income' : 'expense';
                const amount = Math.abs(parseFloat(tx.valor || '0'));
                const description = tx.descricao || tx.historico || 'Sem descrição';
                
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

    private static async getAccessToken(account: any, scope: string = 'extrato.read'): Promise<string> {
        const payload = new URLSearchParams({
            client_id: account.api_client_id.trim(),
            client_secret: account.api_client_secret.trim(),
            grant_type: 'client_credentials',
            scope: scope
        }).toString();

        const response = await this.httpsRequest('cdpj.partners.bancointer.com.br', '/oauth/v2/token', 'POST', {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(payload)
        }, account, payload);

        let data;
        try {
            if (!response || !response.trim()) {
                throw new Error('Resposta vazia do servidor.');
            }
            data = JSON.parse(response);
        } catch (e: any) {
            throw new Error(`Falha ao obter token de acesso: ${e.message}. Resposta original: ${response}`);
        }
        if (!data.access_token) throw new Error('Falha ao obter token de acesso.');
        return data.access_token;
    }

    private static normalizeTransactionDate(tx: any): string | null {
        const candidate = tx.dataEntrada || tx.dataLancamento || tx.dataMovimento || tx.data || tx.data_extrato || tx.date;
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
                res.on('end', () => {
                    if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
                        const trimmed = body.trim();
                        if (!trimmed) {
                            return reject(new Error(`API do Banco retornou status ${res.statusCode} sem conteúdo.`));
                        }
                        if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
                            return reject(new Error(`API do Banco retornou status ${res.statusCode}: ${trimmed.substring(0, 200)}`));
                        }
                    }
                    resolve(body);
                });
            });
            req.on('error', reject);
            if (payload) req.write(payload);
            req.end();
        });
    }

    private static httpsRequestBinary(hostname: string, path: string, method: string, headers: any, account: any, payload?: string): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const cert = Buffer.from(account.api_certificate, 'base64').toString('ascii');
            const key = Buffer.from(account.api_key, 'base64').toString('ascii');

            const options = { hostname, port: 443, path, method, headers, cert, key };
            const req = https.request(options, (res) => {
                const chunks: Buffer[] = [];
                res.on('data', chunk => chunks.push(Buffer.from(chunk)));
                res.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
                        const bodyStr = buffer.toString('utf8').trim();
                        if (!bodyStr) {
                            return reject(new Error(`API do Banco retornou status ${res.statusCode} sem conteúdo.`));
                        }
                        if (!bodyStr.startsWith('{') && !bodyStr.startsWith('[')) {
                            return reject(new Error(`API do Banco retornou status ${res.statusCode}: ${bodyStr.substring(0, 200)}`));
                        }
                    }
                    resolve(buffer);
                });
            });
            req.on('error', reject);
            if (payload) req.write(payload);
            req.end();
        });
    }

    /**
     * Gera um boleto usando a API v2 do Inter
     */
    static async generateBoleto(bankAccount: any, transaction: any, customer: any): Promise<{ nossoNumero: string, linhaDigitavel: string, codigoBarras: string }> {
        // Obter token com o escopo de cobranca
        const token = await this.getAccessToken(bankAccount, 'boleto-cobranca.read boleto-cobranca.write');

        let dueDateStr = new Date().toISOString().slice(0, 10);
        if (transaction.date) {
            if (transaction.date instanceof Date) {
                const tzOffset = transaction.date.getTimezoneOffset() * 60000;
                dueDateStr = new Date(transaction.date.getTime() - tzOffset).toISOString().slice(0, 10);
            } else {
                dueDateStr = String(transaction.date).slice(0, 10);
            }
        }
        const dueDate = dueDateStr;
        
        let cpfCnpj = customer.document || '';
        cpfCnpj = cpfCnpj.replace(/\D/g, '');
        const tipoPessoa = cpfCnpj.length === 14 ? 'JURIDICA' : 'FISICA';

        // Monta o payload conforme documentação da API v3 do Inter
        const payload: any = {
            seuNumero: transaction.public_id.substring(0, 15), // Máx 15 chars
            valorNominal: Number(transaction.amount),
            dataVencimento: dueDate,
            numDiasAgenda: 30, // dias para baixa automática
            pagador: {
                tipoPessoa,
                nome: customer.name.substring(0, 100),
                endereco: customer.address || 'Não informado',
                numero: customer.address_number || 'S/N',
                bairro: customer.neighborhood || 'Não informado',
                cidade: customer.city || 'Não informado',
                uf: customer.state || 'SP',
                cep: customer.zip_code ? customer.zip_code.replace(/\D/g, '') : '00000000',
                cpfCnpj: cpfCnpj || '00000000000'
            }
        };

        if (transaction.description) {
            payload.mensagem = {
                linha1: transaction.description.substring(0, 78)
            };
        }

        const payloadStr = JSON.stringify(payload);

        const response = await this.httpsRequest('cdpj.partners.bancointer.com.br', '/cobranca/v3/cobrancas', 'POST', {
            'Authorization': `Bearer ${token}`,
            'x-inter-conta-corrente': bankAccount.account_number,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payloadStr)
        }, bankAccount, payloadStr);

        let data;
        try {
            data = JSON.parse(response);
        } catch (e) {
            throw new Error(`Erro ao ler resposta do banco: ${response}`);
        }

        if (data.violacoes && data.violacoes.length > 0) {
            const razao = data.violacoes[0].razao;
            if (razao && razao.includes('existe uma cobrança emitida há poucos minutos')) {
                const match = razao.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
                if (match && match[0]) {
                    return {
                        nossoNumero: match[0],
                        linhaDigitavel: '',
                        codigoBarras: ''
                    };
                }
            }
            throw new Error(`Erro na API do Banco: ${razao}`);
        }
        if (data.title && data.detail) {
            throw new Error(`Erro na API do Banco: ${data.detail}`);
        }

        if (!data.codigoSolicitacao && !data.nossoNumero) {
            throw new Error(`Resposta inválida da API do Inter: ${response}`);
        }

        // Na V3, a cobrança retorna codigoSolicitacao. Usamos ele no lugar de nossoNumero para pegar o PDF
        return {
            nossoNumero: data.codigoSolicitacao || data.nossoNumero,
            linhaDigitavel: data.linhaDigitavel || '',
            codigoBarras: data.codigoBarras || ''
        };
    }

    /**
     * Retorna o base64 do PDF do Boleto
     */
    static async getBoletoPdfBase64(bankAccount: any, nossoNumero: string): Promise<string> {
        const token = await this.getAccessToken(bankAccount, 'boleto-cobranca.read');

        const path = `/cobranca/v3/cobrancas/${nossoNumero}/pdf`;
        
        const responseBuffer = await this.httpsRequestBinary('cdpj.partners.bancointer.com.br', path, 'GET', {
            'Authorization': `Bearer ${token}`,
            'x-inter-conta-corrente': bankAccount.account_number
        }, bankAccount);

        const responseStr = responseBuffer.toString('utf8');
        try {
            const data = JSON.parse(responseStr);
            if (data.pdf) {
                return data.pdf;
            }
            if (data.violacoes || data.title) {
                throw new Error(`Erro do Inter: ${data.detail || JSON.stringify(data.violacoes)}`);
            }
        } catch (e) {
            if (responseStr.startsWith('%PDF')) {
                return responseBuffer.toString('base64');
            }
            throw new Error(`Erro ao obter PDF: ${responseStr}`);
        }
        return "";
    }

    /**
     * Cancela um boleto via API V3 do Inter
     */
    static async cancelBoleto(bankAccount: any, nossoNumero: string): Promise<void> {
        const token = await this.getAccessToken(bankAccount, 'boleto-cobranca.write');

        const path = `/cobranca/v3/cobrancas/${nossoNumero}/cancelar`;
        const payload = {
            motivoCancelamento: "ACERTOS"
        };
        const payloadStr = JSON.stringify(payload);

        const response = await this.httpsRequest('cdpj.partners.bancointer.com.br', path, 'POST', {
            'Authorization': `Bearer ${token}`,
            'x-inter-conta-corrente': bankAccount.account_number,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payloadStr)
        }, bankAccount, payloadStr);

        if (response) {
            let data;
            try {
                data = JSON.parse(response);
            } catch (e) {
                // if it's not JSON and not empty, it might be an error page, but usually Inter v3 responds with JSON on error
            }
            if (data && (data.violacoes || data.title)) {
                throw new Error(`Erro ao cancelar: ${data.detail || JSON.stringify(data.violacoes)}`);
            }
        }
    }

    /**
     * Registra o webhook na API v3 do Inter
     */
    static async registerWebhook(bankAccount: any, webhookUrl: string): Promise<void> {
        const token = await this.getAccessToken(bankAccount, 'boleto-cobranca.write');
        const payload = { webhookUrl };
        const payloadStr = JSON.stringify(payload);

        const response = await this.httpsRequest(
            'cdpj.partners.bancointer.com.br',
            '/cobranca/v3/cobrancas/webhook',
            'PUT',
            {
                'Authorization': `Bearer ${token}`,
                'x-inter-conta-corrente': bankAccount.account_number,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payloadStr)
            },
            bankAccount,
            payloadStr
        );

        if (response) {
            let data;
            try {
                data = JSON.parse(response);
            } catch (e) {}
            if (data && (data.violacoes || data.title)) {
                throw new Error(`Erro ao registrar webhook: ${data.detail || JSON.stringify(data.violacoes)}`);
            }
        }
    }

    /**
     * Exclui o webhook na API v3 do Inter
     */
    static async deleteWebhook(bankAccount: any): Promise<void> {
        const token = await this.getAccessToken(bankAccount, 'boleto-cobranca.write');
        const response = await this.httpsRequest(
            'cdpj.partners.bancointer.com.br',
            '/cobranca/v3/cobrancas/webhook',
            'DELETE',
            {
                'Authorization': `Bearer ${token}`,
                'x-inter-conta-corrente': bankAccount.account_number
            },
            bankAccount
        );

        if (response) {
            let data;
            try {
                data = JSON.parse(response);
            } catch (e) {}
            if (data && (data.violacoes || data.title)) {
                throw new Error(`Erro ao excluir webhook: ${data.detail || JSON.stringify(data.violacoes)}`);
            }
        }
    }

    /**
     * Registra o webhook do Pix na API do Inter
     */
    static async registerPixWebhook(bankAccount: any, webhookUrl: string): Promise<void> {
        if (!bankAccount.pix_key) return;
        const token = await this.getAccessToken(bankAccount, 'webhook.write');
        const payload = { webhookUrl };
        const payloadStr = JSON.stringify(payload);

        const response = await this.httpsRequest(
            'cdpj.partners.bancointer.com.br',
            `/pix/v2/webhook/${encodeURIComponent(bankAccount.pix_key.trim())}`,
            'PUT',
            {
                'Authorization': `Bearer ${token}`,
                'x-inter-conta-corrente': bankAccount.account_number,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payloadStr)
            },
            bankAccount,
            payloadStr
        );

        if (response) {
            let data;
            try {
                data = JSON.parse(response);
            } catch (e) {}
            if (data && (data.violacoes || data.title)) {
                throw new Error(`Erro ao registrar webhook Pix: ${data.detail || JSON.stringify(data.violacoes)}`);
            }
        }
    }

    /**
     * Exclui o webhook do Pix na API do Inter
     */
    static async deletePixWebhook(bankAccount: any): Promise<void> {
        if (!bankAccount.pix_key) return;
        const token = await this.getAccessToken(bankAccount, 'webhook.write');
        const response = await this.httpsRequest(
            'cdpj.partners.bancointer.com.br',
            `/pix/v2/webhook/${encodeURIComponent(bankAccount.pix_key.trim())}`,
            'DELETE',
            {
                'Authorization': `Bearer ${token}`,
                'x-inter-conta-corrente': bankAccount.account_number
            },
            bankAccount
        );

        if (response) {
            let data;
            try {
                data = JSON.parse(response);
            } catch (e) {}
            if (data && (data.violacoes || data.title)) {
                throw new Error(`Erro ao excluir webhook Pix: ${data.detail || JSON.stringify(data.violacoes)}`);
            }
        }
    }

    /**
     * Consulta o status da cobrança/boleto na API V3 do Inter
     */
    static async getBoletoStatus(bankAccount: any, nossoNumero: string): Promise<string> {
        const token = await this.getAccessToken(bankAccount, 'boleto-cobranca.read');
        const path = `/cobranca/v3/cobrancas/${nossoNumero}`;
        
        const response = await this.httpsRequest(
            'cdpj.partners.bancointer.com.br',
            path,
            'GET',
            {
                'Authorization': `Bearer ${token}`,
                'x-inter-conta-corrente': bankAccount.account_number
            },
            bankAccount
        );

        let data;
        try {
            if (!response || !response.trim()) {
                throw new Error('Resposta vazia da API de Cobrança do Banco Inter');
            }
            data = JSON.parse(response);
        } catch (e: any) {
            throw new Error(`Erro ao ler resposta do banco: ${e.message}. Resposta original: ${response}`);
        }

        if (data.violacoes && data.violacoes.length > 0) {
            throw new Error(`Erro ao consultar status no Banco Inter: ${data.violacoes[0].razao}`);
        }
        if (data.title && data.detail) {
            throw new Error(`Erro ao consultar status no Banco Inter: ${data.detail}`);
        }

        const situacao = data.cobranca?.situacao || data.situacao;
        if (!situacao) {
            throw new Error(`Situação do boleto não encontrada na resposta do Banco Inter. Resposta: ${response}`);
        }
        return situacao; // e.g. "PAGO", "RECEBIDO", "ABERTO", "VENCIDO", "CANCELADO"
    }
}
