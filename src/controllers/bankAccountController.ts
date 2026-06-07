import { Request, Response } from 'express';
import https from 'https';
import { z } from 'zod';
import { BankAccountService } from '../services/bankAccountService';

const createBankAccountSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    institution: z.string().optional(),
    type: z.enum(['checking', 'savings', 'cash']).optional(),
    initial_balance: z.coerce.number().optional(),
    agency_number: z.string().nullable().optional(),
    account_number: z.string().nullable().optional(),
    pix_key: z.string().nullable().optional(),
    api_client_id: z.string().nullable().optional(),
    api_client_secret: z.string().nullable().optional(),
    api_certificate: z.string().nullable().optional(),
    api_key: z.string().nullable().optional()
});

const updateBankAccountSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').optional(),
    institution: z.string().optional(),
    type: z.enum(['checking', 'savings', 'cash']).optional(),
    current_balance: z.coerce.number().optional(),
    agency_number: z.string().nullable().optional(),
    account_number: z.string().nullable().optional(),
    pix_key: z.string().nullable().optional(),
    api_client_id: z.string().nullable().optional(),
    api_client_secret: z.string().nullable().optional(),
    api_certificate: z.string().nullable().optional(),
    api_key: z.string().nullable().optional()
});

export class BankAccountController {

    static async create(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id; // Guaranteed by requireTenantContext
            const validatedData = createBankAccountSchema.parse(req.body);

            const account = await BankAccountService.create(companyId, validatedData);

            res.status(201).json({
                status: 'success',
                data: account
            });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ status: 'error', errors: error.errors });
                return;
            }
            throw error;
        }
    }

    static async list(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const accounts = await BankAccountService.listByCompany(companyId);

            res.status(200).json({
                status: 'success',
                data: accounts
            });
        } catch (error) {
            throw error;
        }
    }

    static async getByPublicId(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const companyId = req.user!.company_id;

            if (!id) {
                res.status(400).json({ status: 'error', message: 'Missing bank account ID' });
                return;
            }

            const account = await BankAccountService.getByPublicId(id, companyId);

            res.status(200).json({
                status: 'success',
                data: account
            });
        } catch (error: any) {
            if (error instanceof Error && error.message === 'Bank account not found') {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            throw error;
        }
    }

    static async update(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const companyId = req.user!.company_id;

            if (!id) {
                res.status(400).json({ status: 'error', message: 'Missing bank account ID' });
                return;
            }

            const validatedData = updateBankAccountSchema.parse(req.body);
            const account = await BankAccountService.update(id, companyId, validatedData as any);

            res.status(200).json({
                status: 'success',
                message: 'Account updated successfully',
                data: account
            });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ status: 'error', errors: error.errors });
                return;
            }
            if (error instanceof Error && error.message === 'Bank account not found') {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            throw error;
        }
    }

    static async delete(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const companyId = req.user!.company_id;

            if (!id) {
                res.status(400).json({ status: 'error', message: 'Missing bank account ID' });
                return;
            }

            await BankAccountService.delete(id, companyId);

            res.status(200).json({
                status: 'success',
                message: 'Account deleted successfully'
            });
        } catch (error: any) {
            if (error instanceof Error && error.message.includes('Bank account not found')) {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            if (error instanceof Error && error.message.includes('Cannot delete')) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            throw error;
        }
    }

    static async testConnection(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const companyId = req.user!.company_id;

            if (!id) {
                res.status(400).json({ status: 'error', message: 'Missing bank account ID' });
                return;
            }

            const account = await BankAccountService.getByPublicId(id, companyId);

            if (!account.api_client_id || !account.api_client_secret || !account.api_certificate || !account.api_key) {
                res.status(400).json({
                    status: 'error',
                    message: 'Faltam credenciais da API. É necessário configurar Client ID, Client Secret, Certificado (.crt) e Chave (.key) antes de testar a conexão.'
                });
                return;
            }

            // Extraindo as chaves armazenadas no banco
            const certAscii = Buffer.from(account.api_certificate, 'base64').toString('ascii');
            const keyAscii = Buffer.from(account.api_key, 'base64').toString('ascii');
            const clientId = account.api_client_id;
            const clientSecret = account.api_client_secret;

            // Parametros para a requisição OAuth2 do Banco Inter
            const payload = new URLSearchParams({
                client_id: clientId.trim(),
                client_secret: clientSecret.trim(),
                grant_type: 'client_credentials',
                scope: 'boleto-cobranca.read' // Alterado para o escopo que com certeza eles marcaram
            }).toString();

            const options: https.RequestOptions = {
                hostname: 'cdpj.partners.bancointer.com.br',
                path: '/oauth/v2/token',
                method: 'POST',
                cert: certAscii,
                key: keyAscii,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(payload)
                }
            };

            // Disparar requisição nativa Node.js (sem dependências) passando o Certificado mTLS
            const interApiCall = new Promise<{status: number | undefined, body: any}>((resolve, reject) => {
                const reqHttp = https.request(options, (resHttp) => {
                    let data = '';
                    resHttp.on('data', chunk => { data += chunk; });
                    resHttp.on('end', () => {
                        try {
                            const parsed = JSON.parse(data);
                            resolve({ status: resHttp.statusCode, body: parsed });
                        } catch (e) {
                            resolve({ status: resHttp.statusCode, body: data });
                        }
                    });
                });
                reqHttp.on('error', err => reject(err));
                reqHttp.write(payload);
                reqHttp.end();
            });

            const response = await interApiCall;

            if (response.status && response.status >= 200 && response.status < 300) {
                res.status(200).json({
                    status: 'success',
                    message: 'Conexão validada com sucesso! As credenciais do Banco Inter estão ativas.',
                    data: {
                        tested_at: new Date(),
                        mock_token: response.body.access_token ? response.body.access_token.substring(0, 15) + '...' : 'validado'
                    }
                });
            } else {
                const safeId = (clientId || '').trim();
                const idPreview = safeId.substring(0, 4) + '...' + safeId.substring(safeId.length - 4);
                
                const safeSecret = (clientSecret || '').trim();
                const secretPreview = safeSecret.substring(0, 4) + '...' + safeSecret.substring(safeSecret.length - 4);

                res.status(400).json({
                    status: 'error',
                    message: `Falha na autorização com o Banco Inter\n- O Inter respondeu: ${JSON.stringify(response.body)}\n- ID enviado: ${idPreview}\n- Secret enviado: ${secretPreview}\nCerteza absoluta que eles conferem 100% com o portal do banco de Produção?`
                });
            }

        } catch (error: any) {
            if (error instanceof Error && error.message === 'Bank account not found') {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            throw error;
        }
    }
}
