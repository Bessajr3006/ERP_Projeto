import { Request, Response } from 'express';
import { z } from 'zod';
import { AccountingEntryService, accountingEntrySchema } from '../services/accountingEntryService';
import { SolidconConfigService } from '../services/solidconConfigService';
import { ExternalDbService } from '../services/externalDbService';
import pool from '../config/db';

export class AccountingEntryController {
    static async createEntry(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const validatedData = accountingEntrySchema.parse(req.body);

            const entry = await AccountingEntryService.createEntry(companyId, validatedData);
            res.status(201).json({ status: 'success', data: entry, message: 'Lançamento efetuado com sucesso.' });
        } catch (error: any) {
            if (error instanceof z.ZodError) { res.status(400).json({ status: 'error', message: error.errors[0]?.message, errors: error.errors }); return; }
            if (error instanceof Error) { res.status(400).json({ status: 'error', message: error.message }); return; }
            throw error;
        }
    }

    static async listEntries(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const filters = {
                search: req.query.search as string,
                status: req.query.status as string,
                startDate: req.query.startDate as string,
                endDate: req.query.endDate as string
            };
            const entries = await AccountingEntryService.getAllEntries(companyId, filters);
            res.status(200).json({ status: 'success', data: entries });
        } catch (error) { throw error; }
    }

    static async updateEntry(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const publicId = req.params.id as string;
            if (!publicId) {
                res.status(400).json({ status: 'error', message: 'ID principal é obrigatório' });
                return;
            }

            const validatedData = accountingEntrySchema.parse(req.body);
            const updatedEntry = await AccountingEntryService.updateEntry(publicId, companyId, validatedData);

            res.status(200).json({ status: 'success', data: updatedEntry, message: 'Lançamento atualizado.' });
        } catch (error: any) {
            if (error instanceof z.ZodError) { res.status(400).json({ status: 'error', message: error.errors[0]?.message, errors: error.errors }); return; }
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            throw error;
        }
    }

    static async deleteEntry(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const publicId = req.params.id as string;
            if (!publicId) {
                res.status(400).json({ status: 'error', message: 'ID é obrigatório' });
                return;
            }

            const deleted = await AccountingEntryService.deleteEntry(publicId, companyId);
            if (!deleted) {
                res.status(404).json({ status: 'error', message: 'Lançamento não encontrado' });
                return;
            }
            res.status(204).send();
        } catch (error: any) {
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            throw error;
        }
    }

    static async batchImportEntries(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const entries = req.body.entries;
            const matchBy = req.body.matchBy === 'easy_code' ? 'easy_code' : 'code';

            if (!Array.isArray(entries) || entries.length === 0) {
                res.status(400).json({ status: 'error', message: 'Nenhum lançamento fornecido para importação' });
                return;
            }

            const result = await AccountingEntryService.batchImportEntries(companyId, entries, matchBy);
            
            res.status(200).json({ 
                status: 'success', 
                data: result,
                message: `Importação concluída. ${result.success} sucessos, ${result.errors.length} falhas.` 
            });
        } catch (error) {
            throw error;
        }
    }

    static async applyAutoTemplate(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const schema = z.object({
                code: z.string().min(1, 'Código é obrigatório'),
                amount: z.number().positive('O valor deve ser positivo'),
                entry_date: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Data inválida" }),
                document_ref: z.string().max(100).optional(),
                history_complement: z.string().max(500).optional()
            });

            const data = schema.parse(req.body);
            
            const serviceData = {
                amount: data.amount,
                entry_date: data.entry_date,
            } as any;
            if (data.document_ref) serviceData.document_ref = data.document_ref;
            if (data.history_complement) serviceData.history_complement = data.history_complement;

            const result = await AccountingEntryService.applyAutoTemplate(companyId, data.code, serviceData);
            
            res.status(200).json({ 
                status: 'success', 
                data: result,
                message: `Lançamentos automáticos gerados com sucesso (${result.count} linhas).` 
            });
        } catch (error: any) {
            if (error instanceof z.ZodError) { res.status(400).json({ status: 'error', message: error.errors[0]?.message, errors: error.errors }); return; }
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            throw error;
        }
    }
    static async getSolidconAccountingEntries(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const { connectionId, startDate, endDate, source, cdFilial } = req.query;

            if (!startDate || !endDate) {
                res.status(400).json({ status: 'error', message: 'Período obrigatório (startDate e endDate).' });
                return;
            }

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
            const password = solidconConfig?.senha_solidcon || '30mariafn@';

            const entries = await ExternalDbService.getSolidconAccountingEntries(
                {
                    host: host,
                    database: database === 'dorsal' ? 'solidcon' : database,
                    user: user,
                    password: password
                },
                {
                    startDate: String(startDate),
                    endDate: String(endDate),
                    source: (source as any) || 'all',
                    cdFilial: cdFilial ? String(cdFilial) : undefined
                }
            );

            res.status(200).json({
                status: 'success',
                data: entries,
                count: entries.length,
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
                message: `Falha ao consultar movimentos do Solidcon: ${error?.message || error}`
            });
        }
    }

    static async importFromSolidcon(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const { entries } = req.body;

            if (!Array.isArray(entries) || entries.length === 0) {
                res.status(400).json({ status: 'error', message: 'Nenhum lançamento fornecido para importação.' });
                return;
            }

            // Normaliza os lançamentos para o formato do AccountingEntryService
            const normalizedEntries = entries.map((e: any) => ({
                entry_date: String(e.entry_date || '').split('T')[0],
                debit_account_code: String(e.debit_account_code || e.debit_account_easy_code || '').trim(),
                credit_account_code: String(e.credit_account_code || e.credit_account_easy_code || '').trim(),
                amount: Math.abs(Number(e.amount) || 0),
                document_ref: e.document_ref ? String(e.document_ref).trim() : undefined,
                history: String(e.history || 'Importado do Solidcon').trim(),
            })).filter(e => e.entry_date && e.amount > 0 && e.debit_account_code && e.credit_account_code);

            if (normalizedEntries.length === 0) {
                res.status(400).json({
                    status: 'error',
                    message: 'Nenhum lançamento válido com Conta Débito e Conta Crédito preenchidas para importação.'
                });
                return;
            }

            const result = await AccountingEntryService.batchImportEntries(companyId, normalizedEntries, 'code');

            res.status(200).json({
                status: 'success',
                data: result,
                message: `Importação do Solidcon concluída! ${result.success} lançamento(s) importado(s), ${result.errors.length} falha(s).`
            });
        } catch (error: any) {
            res.status(400).json({
                status: 'error',
                message: `Erro na importação de lançamentos do Solidcon: ${error?.message || error}`
            });
        }
    }

    static async verifySolidconEntries(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const { entries } = req.body;

            if (!Array.isArray(entries) || entries.length === 0) {
                res.status(400).json({ status: 'error', message: 'Nenhum lançamento fornecido para verificação.' });
                return;
            }

            const verification = await AccountingEntryService.verifySolidconEntries(companyId, entries);

            res.status(200).json({
                status: 'success',
                data: verification
            });
        } catch (error: any) {
            res.status(400).json({
                status: 'error',
                message: `Erro ao verificar lançamentos do Solidcon: ${error?.message || error}`
            });
        }
    }
}
