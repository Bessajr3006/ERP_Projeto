import { PurchaseOrder, CreatePurchaseData } from '../types/Order';
import { PurchaseRepository } from '../repositories/purchaseRepository';
import { DOMParser } from '@xmldom/xmldom';
import { randomUUID } from 'crypto';
import pool from '../config/db';
import { RowDataPacket } from 'mysql2/promise';
import { OrderService } from './orderService';
import { ProductRepository } from '../repositories/productRepository';
import { EntityService } from './entityService';

export class PurchaseService {
    static async getRecentPurchases(companyId: number, limit: number = 2000, includeSped: boolean = true): Promise<any[]> {
        return PurchaseRepository.getRecentPurchases(companyId, limit, includeSped);
    }

    static async createPurchaseOrder(companyId: number, userPublicId: string, data: CreatePurchaseData): Promise<PurchaseOrder> {
        return PurchaseRepository.createPurchaseOrder(companyId, userPublicId, data);
    }

    static async getPurchaseByInternalId(id: number, companyId: number): Promise<PurchaseOrder> {
        return PurchaseRepository.getPurchaseByInternalId(id, companyId);
    }

    static async getPurchaseById(publicId: string, companyId: number): Promise<any> {
        return PurchaseRepository.getPurchaseById(publicId, companyId);
    }

    static async cancelPurchaseOrder(publicId: string, companyId: number): Promise<void> {
        return PurchaseRepository.cancelPurchaseOrder(publicId, companyId);
    }

    static async importPurchaseFromXml(
        companyId: number,
        userPublicId: string,
        data: { xml_content: string; bank_account_public_id?: string | null | undefined; category_public_id?: string | null | undefined }
    ): Promise<{ purchase: PurchaseOrder; imported_items: number; unmatched_items: any[] }> {
        const xmlContent = String(data.xml_content || '').trim();
        if (!xmlContent) {
            throw new Error('Conteúdo XML não informado.');
        }

        const parsedItems = OrderService.parseNfeItems(xmlContent);
        const parsedHeader = OrderService.parseNfeHeader(xmlContent);

        // For purchases: recipient CNPJ must match company CNPJ
        const companyCnpj = await OrderService.resolveCompanyCnpj(companyId);
        if (!companyCnpj) {
            throw new Error('CNPJ da empresa não configurado. Configure o CNPJ da empresa antes de importar XML.');
        }

        const recipientDigits = parsedHeader.headerData.destinatarioDocumento
            ? OrderService.onlyDigits(parsedHeader.headerData.destinatarioDocumento)
            : null;
        if (!recipientDigits) {
            throw new Error('Não foi possível identificar o CNPJ do destinatário no XML da NF.');
        }

        if (recipientDigits !== companyCnpj) {
            throw new Error('CNPJ do destinatário da NF diferente do CNPJ da empresa. Importação não permitida.');
        }

        // Assert NFe not duplicated
        const [dupRows] = await pool.query<RowDataPacket[]>(
            `SELECT id FROM purchase_orders WHERE company_id = ? AND nfe_key = ? AND status != 'cancelled' LIMIT 1`,
            [companyId, parsedHeader.nfeKey]
        );
        if (dupRows.length > 0) {
            throw new Error('Já existe uma nota de compra com esta chave de NF importada.');
        }

        if (parsedItems.length === 0) {
            throw new Error('Nenhum item válido encontrado no XML da NFe.');
        }

        // Match or create products
        const allProducts = await ProductRepository.listByCompany(companyId);
        const matchedItems: Array<{ product_public_id: string; quantity: number; unit_price: number }> = [];
        const unmatchedItems: any[] = [];

        for (const item of parsedItems) {
            const product = await OrderService.resolveOrCreateProductForNfeItem(companyId, item, allProducts);
            if (!product) {
                unmatchedItems.push({ sku: item.sku, ean: item.ean, name: item.name });
                continue;
            }
            matchedItems.push({
                product_public_id: product.public_id,
                quantity: item.quantity,
                unit_price: item.unitPrice > 0 ? item.unitPrice : Number(product.cost_price || 0)
            });
        }

        if (matchedItems.length === 0) {
            throw new Error('Não foi possível processar itens válidos da NFe para importação.');
        }

        // Resolve supplier
        const supplierPublicId = await this.resolveOrCreateSupplierByDocument(companyId, xmlContent);

        // Resolve bank account
        const bankAccountPublicId = data.bank_account_public_id || await OrderService.resolveDefaultBankAccountPublicId(companyId);
        if (!bankAccountPublicId) {
            throw new Error('Nenhuma conta bancária encontrada.');
        }

        // Resolve category
        const categoryPublicId = data.category_public_id || await this.resolveDefaultExpenseCategoryPublicId(companyId);
        if (!categoryPublicId) {
            throw new Error('Nenhuma categoria de despesa encontrada.');
        }

        // Create purchase order
        const purchase = await PurchaseRepository.createPurchaseOrder(companyId, userPublicId, {
            supplier_public_id: supplierPublicId,
            bank_account_public_id: bankAccountPublicId,
            category_public_id: categoryPublicId,
            date: parsedHeader.nfeIssueDate || new Date().toISOString().split('T')[0],
            items: matchedItems,
            nfe_key: parsedHeader.nfeKey,
            nfe_issue_date: parsedHeader.nfeIssueDate,
            nfe_header_json: parsedHeader.headerData
        } as any);

        return {
            purchase,
            imported_items: matchedItems.length,
            unmatched_items: unmatchedItems
        };
    }

    private static async resolveDefaultExpenseCategoryPublicId(companyId: number): Promise<string | null> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT public_id
             FROM categories
             WHERE company_id = ?
               AND type = 'expense'
             ORDER BY CASE WHEN LOWER(name) LIKE '%compra%' THEN 0 ELSE 1 END, id ASC
             LIMIT 1`,
            [companyId]
        );

        if (rows.length > 0) {
            return String(rows[0]!.public_id || '').trim() || null;
        }

        const publicId = randomUUID();
        await pool.query(
            `INSERT INTO categories (public_id, company_id, name, type)
             VALUES (?, ?, 'Compras', 'expense')`,
            [publicId, companyId]
        );
        return publicId;
    }

    private static async resolveOrCreateSupplierByDocument(companyId: number, xmlContent: string): Promise<string> {
        const doc = new DOMParser().parseFromString(xmlContent, 'text/xml');
        const emitNode = doc.getElementsByTagName('emit')[0];
        if (!emitNode) {
            throw new Error('Não foi possível identificar o emitente (fornecedor) no XML da NFe.');
        }

        const cnpj = OrderService.getTagText(emitNode, 'CNPJ').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const cpf = OrderService.getTagText(emitNode, 'CPF').replace(/\D/g, '');
        const documentDigits = cnpj || cpf;
        const name = OrderService.getTagText(emitNode, 'xNome') || 'Fornecedor XML';

        if (!documentDigits) {
            throw new Error('CNPJ/CPF do emitente não informado no XML da NFe.');
        }

        // 1. Procurar fornecedor existente
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT public_id
             FROM suppliers
             WHERE company_id = ?
               AND REPLACE(REPLACE(REPLACE(cnpj_cpf, '.', ''), '-', ''), '/', '') = ?
             LIMIT 1`,
            [companyId, documentDigits]
        );

        if (rows.length > 0) {
            return String(rows[0]!.public_id);
        }

        // 2. Se não existir, criar o fornecedor automaticamente!
        const created = await EntityService.createSupplier(companyId, {
            name,
            cnpj_cpf: documentDigits,
            street: OrderService.getTagText(emitNode.getElementsByTagName('enderEmit')[0], 'xLgr') || undefined,
            number: OrderService.getTagText(emitNode.getElementsByTagName('enderEmit')[0], 'nro') || undefined,
            neighborhood: OrderService.getTagText(emitNode.getElementsByTagName('enderEmit')[0], 'xBairro') || undefined,
            city: OrderService.getTagText(emitNode.getElementsByTagName('enderEmit')[0], 'xMun') || undefined,
            state: OrderService.getTagText(emitNode.getElementsByTagName('enderEmit')[0], 'UF') || undefined,
            zipcode: OrderService.getTagText(emitNode.getElementsByTagName('enderEmit')[0], 'CEP') || undefined,
            phone: OrderService.getTagText(emitNode.getElementsByTagName('enderEmit')[0], 'fone') || undefined,
        });

        return created.public_id;
    }
}
