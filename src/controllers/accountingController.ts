import { Request, Response } from 'express';
import { z } from 'zod';
import { AccountingService } from '../services/accountingService';
import { SolidconConfigService } from '../services/solidconConfigService';
import { ExternalDbService } from '../services/externalDbService';
import pool from '../config/db';

const accountSchema = z.object({
    code: z.string().min(1, 'Código é obrigatório'),
    easy_code: z.string().max(50, 'Código fácil muito longo').optional().nullable(),
    name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
    type: z.enum(['synthetic', 'analytic']),
    nature: z.enum(['debit', 'credit']),
    status: z.enum(['active', 'inactive']).optional()
});

export class AccountingController {
    static async createAccount(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const validatedData = accountSchema.parse(req.body);

            const account = await AccountingService.createAccount(companyId, validatedData);
            res.status(201).json({ status: 'success', data: account, message: 'Conta criada com sucesso.' });
        } catch (error: any) {
            if (error instanceof z.ZodError) { res.status(400).json({ status: 'error', message: error.errors[0]?.message, errors: error.errors }); return; }
            if (error instanceof Error && error.message.includes('já existe')) { res.status(400).json({ status: 'error', message: error.message }); return; }
            throw error;
        }
    }

    static async listAccounts(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const accounts = await AccountingService.listAccounts(companyId);
            res.status(200).json({ status: 'success', data: accounts });
        } catch (error) { throw error; }
    }

    static async updateAccount(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const publicId = req.params.id as string;
            if (!publicId) {
                res.status(400).json({ status: 'error', message: 'ID da conta é obrigatório' });
                return;
            }

            const validatedData = accountSchema.parse(req.body);
            const updatedAccount = await AccountingService.updateAccount(publicId, companyId, validatedData);

            res.status(200).json({ status: 'success', data: updatedAccount, message: 'Conta atualizada com sucesso.' });
        } catch (error: any) {
            if (error instanceof z.ZodError) { res.status(400).json({ status: 'error', message: error.errors[0]?.message, errors: error.errors }); return; }
            if (error instanceof Error && (error.message.includes('já existe') || error.message === 'Account not found')) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            throw error;
        }
    }

    static async deleteAccount(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const publicId = req.params.id as string;
            if (!publicId) {
                res.status(400).json({ status: 'error', message: 'ID da conta é obrigatório' });
                return;
            }

            await AccountingService.deleteAccount(publicId, companyId);
            res.status(204).send();
        } catch (error: any) {
            if (error instanceof Error && error.message === 'Account not found') {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            throw error;
        }
    }

    static async batchDeleteAccounts(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const publicIds = req.body.ids;
            
            if (!Array.isArray(publicIds) || publicIds.length === 0) {
                res.status(400).json({ status: 'error', message: 'Lista de IDs inválida' });
                return;
            }

            const uniqueIds = Array.from(new Set(publicIds)) as string[];
            await AccountingService.batchDeleteAccounts(uniqueIds, companyId);
            res.status(200).json({ status: 'success', message: `${uniqueIds.length} contas excluídas com sucesso.` });
        } catch (error) {
            throw error;
        }
    }

    static async batchImportAccounts(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const accounts = req.body.accounts;

            if (!Array.isArray(accounts) || accounts.length === 0) {
                res.status(400).json({ status: 'error', message: 'Nenhuma conta fornecida para importação' });
                return;
            }

            // Perform batch upsert
            const result = await AccountingService.batchUpsertAccounts(companyId, accounts);
            
            res.status(200).json({ 
                status: 'success', 
                data: result,
                message: `Importação concluída. ${result.success} sucessos, ${result.errors.length} falhas.` 
            });
        } catch (error) {
            throw error;
        }
    }

    static async listSolidconConnections(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const { SolidconConfigService } = await import('../services/solidconConfigService');
            const configs = await SolidconConfigService.list(companyId);
            res.status(200).json({ status: 'success', data: configs });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error?.message || 'Erro ao listar conexões Solidcon' });
        }
    }

    static async getSolidconChartOfAccounts(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const { connectionId, cdPlanoContas } = req.query;
            let solidconConfig: any = null;

            if (connectionId) {
                const cleanId = parseInt(String(connectionId).replace('solidcon_', ''), 10);
                if (!isNaN(cleanId)) {
                    solidconConfig = await SolidconConfigService.getById(cleanId, companyId);
                }
            }

            if (!solidconConfig) {
                const configs = await SolidconConfigService.list(companyId);
                solidconConfig = configs.find(c => c.is_default) || configs[0] || null;
            }

            if (!solidconConfig) {
                // Check company table legacy fields
                const [compRows]: any = await pool.query('SELECT serv_solidcon, bd_solidcon, login_solidcon, senha_solidcon, trade_name, company_name FROM companies WHERE id = ?', [companyId]);
                const comp = compRows?.[0];
                if (comp && comp.serv_solidcon) {
                    solidconConfig = {
                        name: comp.trade_name || comp.company_name || 'Padrão da Empresa',
                        serv_solidcon: comp.serv_solidcon,
                        bd_solidcon: comp.bd_solidcon || 'solidcon',
                        login_solidcon: comp.login_solidcon,
                        senha_solidcon: comp.senha_solidcon
                    };
                }
            }

            let host = (solidconConfig?.serv_solidcon || '').trim();
            if (host.includes('190.107.93.66')) {
                host = host.replace('190.107.93.66', 'n13884.ddns.net');
            }
            if (!host) {
                host = 'n13884.ddns.net,1433';
            }

            const database = (solidconConfig?.bd_solidcon || 'solidcon').trim();
            const user = (solidconConfig?.login_solidcon || 'aporttec').trim();
            const password = solidconConfig?.senha_solidcon || '';

            const planId = cdPlanoContas ? parseInt(String(cdPlanoContas), 10) : undefined;
            const accounts = await ExternalDbService.getSolidconChartOfAccounts({
                host: host,
                database: database === 'dorsal' ? 'solidcon' : database,
                user: user,
                password: password
            }, planId);

            res.status(200).json({
                status: 'success',
                data: accounts,
                connection: {
                    id: solidconConfig?.id || null,
                    name: solidconConfig?.name || 'Solidcon Principal',
                    host: host,
                    database: database === 'dorsal' ? 'solidcon' : database
                }
            });
        } catch (error: any) {
            res.status(400).json({
                status: 'error',
                message: `Falha ao conectar com banco Solidcon: ${error?.message || error}`
            });
        }
    }

    static async importFromSolidcon(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const { accounts } = req.body;

            if (!Array.isArray(accounts) || accounts.length === 0) {
                res.status(400).json({ status: 'error', message: 'Nenhuma conta informada para importação.' });
                return;
            }

            // Normaliza o payload para o formato esperado pelo AccountingService
            const normalizedAccounts = accounts.map((acc: any) => ({
                code: String(acc.code || acc.Codigo || '').trim(),
                easy_code: acc.easy_code !== undefined && acc.easy_code !== null ? String(acc.easy_code).trim() : (acc.CodigoRapido !== undefined && acc.CodigoRapido !== null ? String(acc.CodigoRapido).trim() : undefined),
                name: String(acc.name || acc.Nome || '').trim(),
                type: (acc.type === 'synthetic' || acc.inAnalitica === false || acc.inAnalitica === 0) ? 'synthetic' : 'analytic',
                nature: (acc.nature === 'credit' || acc.cdNaturezaDaConta === '02') ? 'credit' : 'debit',
                status: (acc.status === 'inactive') ? 'inactive' : 'active'
            })).filter(a => a.code && a.name);

            const result = await AccountingService.batchUpsertAccounts(companyId, normalizedAccounts as any);

            res.status(200).json({
                status: 'success',
                data: result,
                message: `Importação do Solidcon concluída com sucesso! ${result.success} conta(s) processada(s).`
            });
        } catch (error: any) {
            res.status(400).json({
                status: 'error',
                message: `Erro ao importar contas do Solidcon: ${error?.message || error}`
            });
        }
    }
}

