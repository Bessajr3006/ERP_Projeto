import { Request, Response } from 'express';
import { z } from 'zod';
import { OrderService } from '../services/orderService';
import { UserPayload } from '../types/express';
import logger from '../config/logger';
import { AppError } from '../errors/AppError';
import pool from '../config/db';
import { RowDataPacket } from 'mysql2/promise';
import { StorageService } from '../utils/storageService';
import unzipper from 'unzipper';

const itemSchema = z.object({
    product_public_id: z.string().uuid('Invalid product ID').optional().nullable(),
    service_public_id: z.string().uuid('Invalid service ID').optional().nullable(),
    quantity: z.coerce.number().positive(),
    unit_price: z.coerce.number().min(0)
}).refine(data => data.product_public_id || data.service_public_id, {
    message: "Deve ser fornecido o ID do produto ou do serviço",
    path: ["product_public_id"]
});

const purchaseItemSchema = z.object({
    product_public_id: z.string().uuid('Invalid product ID'),
    quantity: z.coerce.number().positive(),
    unit_price: z.coerce.number().min(0),
    reset_stock: z.boolean().optional().nullable()
});

const createPurchaseSchema = z.object({
    supplier_public_id: z.string().uuid('Invalid supplier ID'),
    bank_account_public_id: z.string().uuid('Invalid bank account ID'),
    category_public_id: z.string().uuid('Invalid category ID'),
    date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
    items: z.array(purchaseItemSchema).min(1, 'Order must contain at least one item')
});

const createSalesSchema = z.object({
    customer_public_id: z.string().uuid('Invalid customer ID').optional().nullable(),
    delivery_address: z.string().trim().max(500, 'Endereço muito longo').optional().nullable(),
    bank_account_public_id: z.string().uuid('Invalid bank account ID'),
    category_public_id: z.string().uuid('Invalid category ID'),
    date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
    items: z.array(itemSchema).min(1, 'Order must contain at least one item'),
    payments: z.array(z.object({
        method: z.enum(['pix', 'credit', 'debit', 'cash', 'transfer', 'boleto']),
        amount: z.coerce.number().min(0.01),
        card_brand_public_id: z.string().uuid('Invalid card brand ID').optional().nullable(),
        receivable_type_public_id: z.string().uuid('Invalid receivable type ID').optional().nullable()
    })).optional()
});

const createQuoteSchema = z.object({
    customer_public_id: z.string().uuid('Invalid customer ID').optional().nullable(),
    manual_customer_name: z.string().trim().max(150, 'Nome muito longo').optional().nullable(),
    brand: z.string().trim().max(100).optional().nullable(),
    payment_method: z.string().trim().max(50).optional().nullable(),
    payment_terms: z.string().trim().max(100).optional().nullable(),
    seller_public_id: z.string().uuid('Invalid seller ID').optional().nullable(),
    observation: z.string().trim().max(1000, 'Observação muito longa').optional().nullable(),
    date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
    validity_date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date format" }).optional().nullable(),
    items: z.array(itemSchema).min(1, 'Quote must contain at least one item')
});

const approveQuoteSchema = z.object({
    bank_account_public_id: z.string().uuid('ID de conta bancária inválido'),
    category_public_id: z.string().uuid('ID de categoria inválido'),
    installments: z.array(z.object({
        amount: z.coerce.number().min(0.01, 'Valor da parcela deve ser maior que zero'),
        due_date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Data de vencimento inválida' }),
        payment_method: z.enum(['pix', 'credit', 'debit', 'cash', 'transfer', 'boleto'], {
            errorMap: () => ({ message: 'Forma de pagamento inválida' })
        })
    })).min(1, 'Pelo menos uma parcela é obrigatória')
});

const importSaleXmlSchema = z.object({
    company_id: z.coerce.number().optional().nullable(),
    company_public_id: z.string().optional().nullable(),
    xml_content: z.string().min(20, 'XML da nota fiscal e obrigatorio'),
    file_name: z.string().optional().nullable(),
    bank_account_public_id: z.string().uuid('Invalid bank account ID').optional().nullable(),
    category_public_id: z.string().uuid('Invalid category ID').optional().nullable(),
    customer_public_id: z.string().uuid('Invalid customer ID').optional().nullable(),
    delivery_address: z.string().optional().nullable(),
    date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date format' }).optional().nullable(),
});

const importSaleXmlBatchSchema = z.object({
    company_id: z.coerce.number().optional().nullable(),
    company_public_id: z.string().optional().nullable(),
    bank_account_public_id: z.string().uuid('Invalid bank account ID').optional().nullable(),
    category_public_id: z.string().uuid('Invalid category ID').optional().nullable(),
    customer_public_id: z.string().uuid('Invalid customer ID').optional().nullable(),
    zip_base64: z.string().optional().nullable(),
    zip_filename: z.string().optional().nullable(),
    files: z.array(z.object({
        file_name: z.string(),
        xml_content: z.string().min(20)
    })).optional().nullable()
});

const activeStateSchema = z.object({
    is_active: z.boolean()
});

export class OrderController {

    static async resolveTargetCompanyId(_userCompanyId?: number, companyId?: number | null, companyPublicId?: string | null): Promise<number> {
        if (companyId && Number(companyId) > 0) {
            return Number(companyId);
        }
        if (companyPublicId && String(companyPublicId).trim() !== '') {
            const [compRows] = await pool.query<RowDataPacket[]>(
                'SELECT id FROM companies WHERE public_id = ? LIMIT 1',
                [companyPublicId]
            );
            if (compRows[0]) {
                return Number(compRows[0].id);
            }
        }
        // Retorna 0 para auto-identificação pelo CNPJ do XML
        return 0;
    }

    static async createPurchase(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user as UserPayload; // Guaranteed by auth & tenant middlewares
            const validatedData = createPurchaseSchema.parse(req.body);

            const order = await OrderService.createPurchaseOrder(user.company_id, String(user.id), validatedData);

            res.status(201).json({ status: 'success', data: order });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                const msgs = error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(' | ');
                logger.warn({ zodErrors: error.errors, companyId: (req.user as UserPayload)?.company_id }, '[ZodError] createPurchase');
                res.status(400).json({ status: 'error', message: `Dados inválidos: ${msgs}`, errors: error.errors });
                return;
            }
            if (error instanceof Error) {
                if (error.message.includes('not found') || error.message.includes('Insufficient stock')) {
                    res.status(400).json({ status: 'error', message: error.message });
                    return;
                }
            }
            throw error;
        }
    }

    static async createSale(req: Request, res: Response): Promise<void> {
        try {
            logger.debug({ body: req.body, companyId: (req.user as UserPayload)?.company_id }, '[createSale] payload recebido');
            const user = req.user as UserPayload;
            const validatedData = createSalesSchema.parse(req.body);

            const order = await OrderService.createSalesOrder(user.company_id, String(user.id), validatedData);

            res.status(201).json({ status: 'success', data: order });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                const msgs = error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(' | ');
                logger.warn({ zodErrors: error.errors, companyId: (req.user as UserPayload)?.company_id }, '[ZodError] createSale');
                res.status(400).json({ status: 'error', message: `Dados inválidos: ${msgs}`, errors: error.errors });
                return;
            }
            if (error instanceof Error) {
                if (error.message.includes('not found') || error.message.includes('Insufficient stock')) {
                    res.status(400).json({ status: 'error', message: error.message });
                    return;
                }
            }
            throw error;
        }
    }

    static async createQuote(req: Request, res: Response): Promise<void> {
        try {
            logger.debug({ body: req.body, companyId: (req.user as UserPayload)?.company_id }, '[createQuote] payload recebido');
            const user = req.user as UserPayload;
            const validatedData = createQuoteSchema.parse(req.body);

            const quote = await OrderService.createQuote(user.company_id, String(user.id), validatedData);

            res.status(201).json({ status: 'success', data: quote });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                const msgs = error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(' | ');
                logger.warn({ zodErrors: error.errors, companyId: (req.user as UserPayload)?.company_id }, '[ZodError] createQuote');
                res.status(400).json({ status: 'error', message: `Dados inválidos: ${msgs}`, errors: error.errors });
                return;
            }
            if (error instanceof Error) {
                if (error.message.includes('not found')) {
                    res.status(400).json({ status: 'error', message: error.message });
                    return;
                }
            }
            throw error;
        }
    }

    static async getQuoteById(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user as UserPayload;
            const quote = await OrderService.getQuoteByPublicId(req.params.id as string, Number(user.company_id));
            res.status(200).json({ status: 'success', data: quote });
        } catch (error: any) {
            logger.error({ err: error, id: req.params.id }, '[OrderController.getQuoteById] Error');
            res.status(404).json({ status: 'error', message: error.message || 'Quote not found' });
        }
    }

    static async getQuotePrintHTML(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user as UserPayload;
            const companyId = Number(user.company_id);
            const publicId = req.params.id as string;
            const printHtml = await OrderService.generateQuotePrintHTML(companyId, publicId);
            res.status(200).send(printHtml);
        } catch (error: any) {
            logger.error({ err: error, id: req.params.id }, '[OrderController.getQuotePrintHTML] Error');
            res.status(404).send(`<h3>Erro ao gerar impressão do orçamento: ${error.message}</h3>`);
        }
    }

    static async deleteQuote(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user as UserPayload;
            const companyId = Number(user.company_id);
            const publicId = req.params.id as string;
            
            await OrderService.deleteQuoteByPublicId(publicId, companyId);
            
            res.status(200).json({ status: 'success', message: 'Orçamento excluído com sucesso' });
        } catch (error: any) {
            logger.error({ err: error, id: req.params.id }, '[OrderController.deleteQuote] Error');
            res.status(400).json({ status: 'error', message: error.message || 'Erro ao excluir orçamento' });
        }
    }

    static async updateQuote(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user as UserPayload;
            const validatedData = createQuoteSchema.parse(req.body);
            const quote = await OrderService.updateQuote(req.params.id as string, Number(user.company_id), validatedData);
            res.status(200).json({ status: 'success', data: quote });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                const msgs = error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(' | ');
                logger.warn({ zodErrors: error.errors, companyId: (req.user as UserPayload)?.company_id }, '[ZodError] updateQuote');
                res.status(400).json({ status: 'error', message: `Dados inválidos: ${msgs}`, errors: error.errors });
                return;
            }
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ status: 'error', message: error.message });
                return;
            }
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            throw error;
        }
    }

    static async approveQuote(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user as UserPayload;
            const validatedData = approveQuoteSchema.parse(req.body);
            const sale = await OrderService.approveQuote(
                Number(user.company_id),
                Number(user.id),
                req.params.id as string,
                validatedData
            );
            res.status(200).json({ status: 'success', data: sale });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                const msgs = error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(' | ');
                logger.warn({ zodErrors: error.errors, companyId: (req.user as UserPayload)?.company_id }, '[ZodError] approveQuote');
                res.status(400).json({ status: 'error', message: `Dados inválidos: ${msgs}`, errors: error.errors });
                return;
            }
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ status: 'error', message: error.message });
                return;
            }
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            throw error;
        }
    }

    static async importSaleFromXml(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user as UserPayload;
            const validatedData = importSaleXmlSchema.parse(req.body);
            const targetCompanyId = await OrderController.resolveTargetCompanyId(
                user.company_id,
                validatedData.company_id,
                validatedData.company_public_id
            );

            const imported = await OrderService.importSaleFromXml(targetCompanyId, String(user.id), validatedData);

            // Mover / Salvar para a pasta Impkey da empresa identificada
            const effectiveCompanyId = Number(imported.sale.company_id || targetCompanyId || user.company_id);
            const fileName = validatedData.file_name || `nfe_${imported.sale.nfe_key || imported.sale.id}.xml`;
            StorageService.saveToImpkey(effectiveCompanyId, fileName, validatedData.xml_content);

            res.status(201).json({ status: 'success', data: imported });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                const msgs = error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(' | ');
                logger.warn({ zodErrors: error.errors, companyId: (req.user as UserPayload)?.company_id }, '[ZodError] importSaleFromXml');
                res.status(400).json({ status: 'error', message: `Dados inválidos: ${msgs}`, errors: error.errors });
                return;
            }

            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message || 'Falha ao importar XML da nota fiscal' });
                return;
            }

            throw error;
        }
    }

    static async importSaleFromXmlBatch(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user as UserPayload;
            const validatedData = importSaleXmlBatchSchema.parse(req.body);
            const targetCompanyId = await OrderController.resolveTargetCompanyId(
                user.company_id,
                validatedData.company_id,
                validatedData.company_public_id
            );

            const filesToProcess: Array<{ file_name: string; xml_content: string }> = [];

            // 1. Se veio arquivo compactado (ZIP) em base64, descompacta
            if (validatedData.zip_base64) {
                let cleanB64 = validatedData.zip_base64;
                if (cleanB64.includes(',')) {
                    cleanB64 = cleanB64.split(',')[1] || cleanB64;
                }
                const zipBuffer = Buffer.from(cleanB64, 'base64');
                const zipName = validatedData.zip_filename || `import_${Date.now()}.zip`;
                
                // Salva o arquivo ZIP original em Impkey (se targetCompanyId for 0, salva na pasta do user)
                StorageService.saveToImpkey(targetCompanyId || user.company_id, zipName, zipBuffer);

                // Descompacta em memória e extrai os XMLs
                const directory = await unzipper.Open.buffer(zipBuffer);
                for (const zFile of directory.files) {
                    if (zFile.type === 'File' && zFile.path.toLowerCase().endsWith('.xml')) {
                        const fileBuf = await zFile.buffer();
                        const xmlContent = fileBuf.toString('utf-8');
                        if (xmlContent.length >= 20) {
                            const baseName = zFile.path.split('/').pop() || zFile.path;
                            filesToProcess.push({
                                file_name: baseName,
                                xml_content: xmlContent
                            });
                        }
                    }
                }
            }

            // 2. Se vieram arquivos XML diretos na lista
            if (Array.isArray(validatedData.files)) {
                for (const f of validatedData.files) {
                    filesToProcess.push(f);
                }
            }

            if (filesToProcess.length === 0) {
                res.status(400).json({
                    status: 'error',
                    message: 'Nenhum arquivo XML válido encontrado para importação.'
                });
                return;
            }

            const successList: any[] = [];
            const failedList: Array<{ file_name: string; error: string }> = [];
            let totalImportedItems = 0;

            for (const item of filesToProcess) {
                try {
                    const imported = await OrderService.importSaleFromXml(targetCompanyId, String(user.id), {
                        xml_content: item.xml_content,
                        bank_account_public_id: validatedData.bank_account_public_id,
                        category_public_id: validatedData.category_public_id,
                        customer_public_id: validatedData.customer_public_id
                    });

                    // Salva o XML individual processado na pasta Impkey da respectiva empresa
                    const effectiveCompanyId = Number(imported.sale.company_id || targetCompanyId || user.company_id);
                    StorageService.saveToImpkey(effectiveCompanyId, item.file_name, item.xml_content);

                    totalImportedItems += Number(imported.imported_items || 0);
                    successList.push({
                        file_name: item.file_name,
                        company_id: effectiveCompanyId,
                        sale_id: imported.sale.id,
                        nfe_key: imported.sale.nfe_key,
                        imported_items: imported.imported_items
                    });
                } catch (err: any) {
                    logger.warn({ file: item.file_name, error: err?.message }, '[importSaleFromXmlBatch] Falha no XML');
                    failedList.push({
                        file_name: item.file_name,
                        error: err?.message || 'Erro ao processar XML'
                    });
                }
            }

            res.status(200).json({
                status: 'success',
                data: {
                    total: filesToProcess.length,
                    imported: successList.length,
                    failed: failedList.length,
                    imported_items: totalImportedItems,
                    sales: successList,
                    errors: failedList
                }
            });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                const msgs = error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(' | ');
                logger.warn({ zodErrors: error.errors, companyId: (req.user as UserPayload)?.company_id }, '[ZodError] importSaleFromXmlBatch');
                res.status(400).json({ status: 'error', message: `Dados inválidos: ${msgs}`, errors: error.errors });
                return;
            }

            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message || 'Falha ao importar lote de notas fiscais' });
                return;
            }

            throw error;
        }
    }

    static async listSales(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user as UserPayload;
            const includeInactive = req.query.include_inactive === 'true';
            const sales = await OrderService.listSales(user.company_id, includeInactive);
            res.json({ status: 'success', data: sales });
        } catch (error) {
            logger.error({ err: error, companyId: (req.user as UserPayload)?.company_id }, '[listSales] erro ao listar vendas');
            res.status(500).json({ status: 'error', message: 'Erro ao listar vendas' });
        }
    }

    static async listQuotes(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user as UserPayload;
            const includeInactive = req.query.include_inactive === 'true';
            const quotes = await OrderService.listQuotes(user.company_id, includeInactive);
            res.json({ status: 'success', data: quotes });
        } catch (error) {
            logger.error({ err: error, companyId: (req.user as UserPayload)?.company_id }, '[listQuotes] erro ao listar orçamentos');
            res.status(500).json({ status: 'error', message: 'Erro ao listar orçamentos' });
        }
    }

    static async updateSaleStatus(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user as UserPayload;
            const id = Number(req.params.id);
            const { status, nfe_emitted_at } = req.body;

            if (!status || !['pending', 'completed', 'cancelled', 'separated', 'invoiced'].includes(status)) {
                res.status(400).json({ status: 'error', message: 'Invalid status' });
                return;
            }

            const emittedDate = nfe_emitted_at ? new Date(nfe_emitted_at) : undefined;
            await OrderService.updateSaleStatus(id, user.company_id, status, emittedDate);
            res.status(200).json({ status: 'success', message: 'Sale status updated' });
        } catch (error: any) {
            logger.error({ err: error, saleId: req.params.id }, '[updateSaleStatus] erro ao atualizar venda');
            res.status(500).json({ status: 'error', message: 'Failed to update sale status' });
        }
    }

    static async softDeleteSale(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user as UserPayload;
            const id = Number(req.params.id);

            if (!Number.isFinite(id)) {
                res.status(400).json({ status: 'error', message: 'Invalid sale ID' });
                return;
            }

            await OrderService.softDeleteSale(id, user.company_id);
            res.status(200).json({ status: 'success', message: 'Pedido removido da separacao' });
        } catch (error: any) {
            logger.error({ err: error, saleId: req.params.id }, '[softDeleteSale] erro ao remover venda da separacao');
            if (error instanceof Error && error.message.includes('not found')) {
                res.status(404).json({ status: 'error', message: 'Pedido nao encontrado' });
                return;
            }
            res.status(500).json({ status: 'error', message: 'Failed to remove sale from picking' });
        }
    }

    static async hardDeleteInactiveSale(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user as UserPayload;
            const id = Number(req.params.id);

            if (!Number.isFinite(id)) {
                res.status(400).json({ status: 'error', message: 'Invalid sale ID' });
                return;
            }

            await OrderService.hardDeleteInactiveSale(id, user.company_id);
            res.status(200).json({ status: 'success', message: 'Pedido inativo excluido permanentemente' });
        } catch (error: any) {
            logger.error({ err: error, saleId: req.params.id }, '[hardDeleteInactiveSale] erro ao excluir permanentemente venda inativa');

            if (error instanceof Error && error.message.includes('not found')) {
                res.status(404).json({ status: 'error', message: 'Pedido nao encontrado' });
                return;
            }

            if (error instanceof Error && error.message.includes('must be inactive')) {
                res.status(400).json({ status: 'error', message: 'Pedido precisa estar inativo para exclusao permanente' });
                return;
            }

            res.status(500).json({ status: 'error', message: 'Failed to permanently delete inactive sale' });
        }
    }

    static async softDeleteSaleItem(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user as UserPayload;
            const saleId = Number(req.params.saleId);
            const itemId = Number(req.params.itemId);

            if (!Number.isFinite(saleId) || !Number.isFinite(itemId)) {
                res.status(400).json({ status: 'error', message: 'Invalid sale or item ID' });
                return;
            }

            await OrderService.softDeleteSaleItem(saleId, itemId, user.company_id);
            res.status(200).json({ status: 'success', message: 'Produto removido da separacao' });
        } catch (error: any) {
            logger.error({ err: error, saleId: req.params.saleId, itemId: req.params.itemId }, '[softDeleteSaleItem] erro ao remover item da separacao');
            if (error instanceof Error && error.message.includes('not found')) {
                res.status(404).json({ status: 'error', message: 'Produto do pedido nao encontrado' });
                return;
            }
            res.status(500).json({ status: 'error', message: 'Failed to remove sale item from picking' });
        }
    }

    static async setSaleActive(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user as UserPayload;
            const id = Number(req.params.id);
            const { is_active } = activeStateSchema.parse(req.body);

            if (!Number.isFinite(id)) {
                res.status(400).json({ status: 'error', message: 'Invalid sale ID' });
                return;
            }

            await OrderService.setSaleActive(id, user.company_id, is_active);
            res.status(200).json({ status: 'success', message: is_active ? 'Pedido ativado' : 'Pedido inativado' });
        } catch (error: any) {
            logger.error({ err: error, saleId: req.params.id }, '[setSaleActive] erro ao atualizar ativo da venda');
            if (error instanceof z.ZodError) {
                res.status(400).json({ status: 'error', message: 'Dados invalidos', errors: error.errors });
                return;
            }
            if (error instanceof Error && error.message.includes('not found')) {
                res.status(404).json({ status: 'error', message: 'Pedido nao encontrado' });
                return;
            }
            res.status(500).json({ status: 'error', message: 'Failed to update sale active state' });
        }
    }

    static async setSaleItemActive(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user as UserPayload;
            const saleId = Number(req.params.saleId);
            const itemId = Number(req.params.itemId);
            const { is_active } = activeStateSchema.parse(req.body);

            if (!Number.isFinite(saleId) || !Number.isFinite(itemId)) {
                res.status(400).json({ status: 'error', message: 'Invalid sale or item ID' });
                return;
            }

            await OrderService.setSaleItemActive(saleId, itemId, user.company_id, is_active);
            res.status(200).json({ status: 'success', message: is_active ? 'Produto ativado' : 'Produto inativado' });
        } catch (error: any) {
            logger.error({ err: error, saleId: req.params.saleId, itemId: req.params.itemId }, '[setSaleItemActive] erro ao atualizar ativo do item da venda');
            if (error instanceof z.ZodError) {
                res.status(400).json({ status: 'error', message: 'Dados invalidos', errors: error.errors });
                return;
            }
            if (error instanceof Error && error.message.includes('not found')) {
                res.status(404).json({ status: 'error', message: 'Produto do pedido nao encontrado' });
                return;
            }
            res.status(500).json({ status: 'error', message: 'Failed to update sale item active state' });
        }
    }

    static async listSalesByCustomer(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user as UserPayload;
            const customerPublicId = req.params['customerPublicId'];
            if (!customerPublicId) { res.status(400).json({ status: 'error', message: 'Customer ID is required' }); return; }
            const sales = await OrderService.listSalesByCustomer(customerPublicId, user.company_id);
            res.status(200).json({ status: 'success', data: sales });
        } catch (error: any) {
            logger.error({ err: error }, '[listSalesByCustomer] erro ao listar vendas do cliente');
            res.status(500).json({ status: 'error', message: 'Failed to retrieve customer sales history' });
        }
    }

    static async listPurchasesBySupplier(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user as UserPayload;
            const supplierPublicId = req.params['supplierPublicId'];
            if (!supplierPublicId) { res.status(400).json({ status: 'error', message: 'Supplier ID is required' }); return; }
            const purchases = await OrderService.listPurchasesBySupplier(supplierPublicId, user.company_id);
            res.status(200).json({ status: 'success', data: purchases });
        } catch (error: any) {
            logger.error({ err: error }, '[listPurchasesBySupplier] erro ao listar compras do fornecedor');
            res.status(500).json({ status: 'error', message: 'Failed to retrieve supplier purchase history' });
        }
    }
}
