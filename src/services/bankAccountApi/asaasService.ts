import https from 'https';
import http from 'http';
import { URL } from 'url';
import logger from '../../config/logger';

export interface AsaasBalanceResponse {
    disponivel: number;
    bloqueadoCheque: number;
    bloqueadoJudicial: number;
    bloqueadoAdministrativo: number;
    totalBloqueado: number;
    limite: number;
    totalMaster: number;
}

export class AsaasService {
    private static getBaseUrl(environment?: string | null): string {
        const env = String(environment || '').toLowerCase().trim();
        if (env === 'sandbox' || env === 'homologacao' || env === 'teste') {
            return 'https://sandbox.asaas.com/v3';
        }
        return 'https://api.asaas.com/v3';
    }

    private static request(urlStr: string, options: {
        method: string;
        apiKey: string;
        body?: any;
    }): Promise<{ status: number; body: any }> {
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(urlStr);
            const isHttps = parsedUrl.protocol === 'https:';
            const client = isHttps ? https : http;

            const postData = options.body ? JSON.stringify(options.body) : null;

            const reqOptions: https.RequestOptions = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (isHttps ? 443 : 80),
                path: parsedUrl.pathname + parsedUrl.search,
                method: options.method,
                headers: {
                    'Content-Type': 'application/json',
                    'access_token': options.apiKey.trim(),
                    'User-Agent': 'Keystone-ERP',
                    ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {})
                }
            };

            const req = client.request(reqOptions, (res) => {
                let data = '';
                res.on('data', chunk => { data += chunk; });
                res.on('end', () => {
                    let parsed: any = data;
                    try {
                        parsed = JSON.parse(data);
                    } catch (e) {
                        parsed = data;
                    }
                    resolve({ status: res.statusCode || 0, body: parsed });
                });
            });

            req.on('error', (err) => {
                reject(err);
            });

            if (postData) {
                req.write(postData);
            }
            req.end();
        });
    }

    /**
     * Testa a conexão e autenticação com a API do Asaas
     */
    static async testConnection(account: any): Promise<{
        success: boolean;
        message: string;
        data?: any;
    }> {
        const apiKey = account.asaas_api_key;
        if (!apiKey) {
            throw new Error('Chave de API / Access Token do Asaas não configurada.');
        }

        const baseUrl = this.getBaseUrl(account.asaas_environment);
        const url = `${baseUrl}/finance/balance`;

        try {
            const res = await this.request(url, {
                method: 'GET',
                apiKey
            });

            if (res.status >= 200 && res.status < 300) {
                const balance = Number(res.body?.balance || 0);
                return {
                    success: true,
                    message: `Conexão validada com sucesso com o Asaas! Saldo em conta: R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    data: {
                        tested_at: new Date(),
                        balance,
                        environment: account.asaas_environment || 'production'
                    }
                };
            } else {
                const errorMsg = Array.isArray(res.body?.errors)
                    ? res.body.errors.map((e: any) => e.description || e.message || JSON.stringify(e)).join(', ')
                    : res.body?.message || JSON.stringify(res.body);

                throw new Error(`Falha na autorização com o Asaas (HTTP ${res.status}): ${errorMsg}`);
            }
        } catch (error: any) {
            logger.error({ error, accountId: account.id }, '[AsaasService] Falha ao testar conexão');
            throw error;
        }
    }

    /**
     * Consulta o saldo em tempo real na API do Asaas
     */
    static async getBalance(account: any): Promise<AsaasBalanceResponse> {
        const apiKey = account.asaas_api_key;
        if (!apiKey) {
            throw new Error('Chave de API do Asaas não informada.');
        }

        const baseUrl = this.getBaseUrl(account.asaas_environment);
        const url = `${baseUrl}/finance/balance`;

        const res = await this.request(url, {
            method: 'GET',
            apiKey
        });

        if (res.status >= 200 && res.status < 300) {
            const balance = Number(res.body?.balance || 0);
            return {
                disponivel: balance,
                bloqueadoCheque: 0,
                bloqueadoJudicial: 0,
                bloqueadoAdministrativo: 0,
                totalBloqueado: 0,
                limite: 0,
                totalMaster: balance
            };
        } else {
            const errorMsg = Array.isArray(res.body?.errors)
                ? res.body.errors.map((e: any) => e.description || e.message).join(', ')
                : res.body?.message || 'Erro ao consultar saldo Asaas';
            throw new Error(errorMsg);
        }
    }

    /**
     * Registra ou atualiza a configuração de Webhook no Asaas
     */
    static async registerWebhook(account: any, webhookUrl: string): Promise<any> {
        const apiKey = account.asaas_api_key;
        if (!apiKey || !webhookUrl) return null;

        const baseUrl = this.getBaseUrl(account.asaas_environment);
        const url = `${baseUrl}/webhooks`;

        const events: string[] = [];
        if (account.asaas_webhook_event_payment_created) events.push('PAYMENT_CREATED');
        if (account.asaas_webhook_event_payment_updated) events.push('PAYMENT_UPDATED');
        if (account.asaas_webhook_event_payment_confirmed) events.push('PAYMENT_CONFIRMED');
        if (account.asaas_webhook_event_payment_received || account.asaas_webhook_event_payment_received === undefined) events.push('PAYMENT_RECEIVED');
        if (account.asaas_webhook_event_payment_overdue) events.push('PAYMENT_OVERDUE');
        if (account.asaas_webhook_event_payment_deleted) events.push('PAYMENT_DELETED');
        if (account.asaas_webhook_event_payment_restored) events.push('PAYMENT_RESTORED');
        if (account.asaas_webhook_event_payment_refunded) events.push('PAYMENT_REFUNDED');

        const payload = {
            name: 'Keystone ERP Webhook',
            url: webhookUrl.trim(),
            email: account.asaas_webhook_email || undefined,
            enabled: true,
            interrupted: false,
            apiVersion: 3,
            authToken: account.asaas_webhook_token || undefined,
            sendType: 'SEQUENTIALLY',
            events: events.length > 0 ? events : ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED']
        };

        try {
            const res = await this.request(url, {
                method: 'POST',
                apiKey,
                body: payload
            });

            if (res.status >= 200 && res.status < 300) {
                logger.info({ res: res.body }, '[AsaasService] Webhook registrado com sucesso no Asaas');
                return res.body;
            } else {
                logger.warn({ res: res.body, status: res.status }, '[AsaasService] Aviso ao registrar Webhook no Asaas');
                return res.body;
            }
        } catch (err: any) {
            logger.error({ err }, '[AsaasService] Erro ao registrar Webhook no Asaas');
            throw err;
        }
    }

    /**
     * Remove ou desativa webhook no Asaas
     */
    static async deleteWebhook(account: any): Promise<void> {
        const apiKey = account.asaas_api_key;
        if (!apiKey) return;

        const baseUrl = this.getBaseUrl(account.asaas_environment);
        const url = `${baseUrl}/webhooks`;

        try {
            await this.request(url, {
                method: 'DELETE',
                apiKey
            });
        } catch (err: any) {
            logger.warn({ err }, '[AsaasService] Falha ao remover webhook no Asaas');
        }
    }

    /**
     * Cancela uma cobrança/pagamento no Asaas
     */
    static async cancelPayment(account: any, paymentId: string): Promise<boolean> {
        const apiKey = account.asaas_api_key;
        if (!apiKey || !paymentId) return false;

        const baseUrl = this.getBaseUrl(account.asaas_environment);
        const url = `${baseUrl}/payments/${paymentId}`;

        try {
            const res = await this.request(url, {
                method: 'DELETE',
                apiKey
            });

            if (res.status >= 200 && res.status < 300) {
                logger.info({ paymentId, res: res.body }, '[AsaasService] Cobrança cancelada com sucesso no Asaas');
                return true;
            }
            if (res.status === 404 || (res.body?.errors && JSON.stringify(res.body.errors).includes('deleted'))) {
                return true;
            }
            logger.warn({ res: res.body, status: res.status, paymentId }, '[AsaasService] Falha ao cancelar cobrança no Asaas');
            return false;
        } catch (err) {
            logger.warn({ err, paymentId }, '[AsaasService] Erro ao enviar requisição de cancelamento no Asaas');
            return false;
        }
    }
}
