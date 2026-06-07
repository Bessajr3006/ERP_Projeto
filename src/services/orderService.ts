import { PurchaseOrder, CreatePurchaseData, SalesOrder, CreateSalesData } from '../types/Order';
import { OrderRepository } from '../repositories/orderRepository';
import { DOMParser } from '@xmldom/xmldom';
import { ProductRepository } from '../repositories/productRepository';
import pool from '../config/db';
import { RowDataPacket } from 'mysql2/promise';
import { Product } from '../types/Product';

interface ImportSaleFromXmlData {
    xml_content: string;
    bank_account_public_id?: string | null | undefined;
    category_public_id?: string | null | undefined;
    customer_public_id?: string | null | undefined;
    delivery_address?: string | null | undefined;
    date?: string | null | undefined;
}

interface ParsedNfeItem {
    sku: string | null;
    ean: string | null;
    name: string;
    quantity: number;
    unitPrice: number;
    xmlItemData: {
        cProd: string | null;
        cEAN: string | null;
        cEANTrib: string | null;
        ncm: string | null;
        cest: string | null;
        cfop: string | null;
        uCom: string | null;
        qCom: number;
        vUnCom: number;
        vProd: number;
    };
}

interface ParsedNfeHeader {
    nfeKey: string | null;
    nfeIssueDate: string | null;
    headerData: {
        numero: string | null;
        serie: string | null;
        naturezaOperacao: string | null;
        modelo: string | null;
        emitenteNome: string | null;
        emitenteDocumento: string | null;
        destinatarioNome: string | null;
        destinatarioDocumento: string | null;
        tributosTotal: number | null;
    };
}

export class OrderService {
    private static readonly MAX_MONEY_VALUE = 99999999.99; // DECIMAL(10,2)

    private static normalizeTextKey(value: string | null | undefined): string {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    private static onlyDigits(value: string | null | undefined): string {
        return String(value || '').replace(/\D/g, '');
    }

    private static async resolveCompanyCnpj(companyId: number): Promise<string | null> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT cnpj
             FROM companies
             WHERE id = ?
             LIMIT 1`,
            [companyId]
        );

        if (!rows[0]) return null;

        const cnpjDigits = this.onlyDigits(String(rows[0]!.cnpj || ''));
        return cnpjDigits || null;
    }

    private static async assertNfeEmitterMatchesCompany(companyId: number, emitterDocument: string | null): Promise<void> {
        const companyCnpj = await this.resolveCompanyCnpj(companyId);
        if (!companyCnpj) {
            throw new Error('CNPJ da empresa nao configurado. Configure o CNPJ da empresa antes de importar XML.');
        }

        const emitterDigits = this.onlyDigits(emitterDocument);
        if (!emitterDigits) {
            throw new Error('Nao foi possivel identificar o CNPJ emitente da NF no XML.');
        }

        if (emitterDigits !== companyCnpj) {
            throw new Error('CNPJ do emitente da NF diferente do CNPJ da empresa. Importacao nao permitida.');
        }
    }

    private static async assertNfeNotDuplicated(companyId: number, nfeKey: string | null): Promise<void> {
        if (!nfeKey) {
            throw new Error('Nao foi possivel identificar a chave da NF no XML.');
        }

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT id
             FROM sales_orders
             WHERE company_id = ?
               AND nfe_key = ?
               AND is_deleted = 0
             LIMIT 1`,
            [companyId, nfeKey]
        );

        if (rows.length > 0) {
            throw new Error('Ja existe uma nota com esta chave da NF importada para esta empresa.');
        }
    }

    private static resolveProductByNameFallback(
        productList: Array<{ public_id: string; name: string; selling_price?: number | null }>,
        nfeName: string
    ): { public_id: string; name: string; selling_price?: number | null } | null {
        const normalizedNfeName = this.normalizeTextKey(nfeName);
        if (!normalizedNfeName) return null;

        const exactMatches = productList.filter((product) => this.normalizeTextKey(product.name) === normalizedNfeName);
        if (exactMatches.length === 1) {
            return exactMatches[0] || null;
        }

        const includesMatches = productList.filter((product) => {
            const normalizedProductName = this.normalizeTextKey(product.name);
            return normalizedProductName.includes(normalizedNfeName) || normalizedNfeName.includes(normalizedProductName);
        });

        if (includesMatches.length === 1) {
            return includesMatches[0] || null;
        }

        return null;
    }

    private static parseDecimal(value: string | null | undefined): number {
        if (!value) return 0;

        const raw = String(value).trim();
        if (!raw) return 0;

        // Mantem apenas digitos/sinais/separadores para normalizar formatos como:
        // 1.234,56 | 1,234.56 | 1234.56 | 1234,56
        const cleaned = raw.replace(/[^0-9,.-]/g, '');
        const lastDot = cleaned.lastIndexOf('.');
        const lastComma = cleaned.lastIndexOf(',');

        let normalized = cleaned;

        if (lastDot >= 0 && lastComma >= 0) {
            // O ultimo separador encontrado e tratado como decimal.
            if (lastDot > lastComma) {
                normalized = cleaned.replace(/,/g, '');
            } else {
                normalized = cleaned.replace(/\./g, '').replace(',', '.');
            }
        } else if (lastComma >= 0) {
            normalized = cleaned.replace(/\./g, '').replace(',', '.');
        } else {
            // Apenas ponto ou inteiro.
            normalized = cleaned.replace(/,/g, '');
        }

        const parsed = Number(normalized);
        if (!Number.isFinite(parsed) || parsed < 0) return 0;

        if (parsed > this.MAX_MONEY_VALUE) {
            return this.MAX_MONEY_VALUE;
        }

        return parsed;
    }

    private static getTagText(parent: Element | null | undefined, tagName: string): string {
        if (!parent) return '';
        const node = parent.getElementsByTagName(tagName)[0];
        return String(node?.textContent || '').trim();
    }

    private static parseNfeItems(xmlContent: string): ParsedNfeItem[] {
        const doc = new DOMParser().parseFromString(xmlContent, 'text/xml');
        if (doc.getElementsByTagName('parsererror').length > 0) {
            throw new Error('XML invalido para importacao de notas.');
        }

        const detNodes = Array.from(doc.getElementsByTagName('det'));
        const parsed: ParsedNfeItem[] = [];

        for (const detNode of detNodes) {
            const prodNode = detNode.getElementsByTagName('prod')[0];
            if (!prodNode) continue;

            const sku = this.getTagText(prodNode, 'cProd') || null;
            const rawEan = this.getTagText(prodNode, 'cEAN') || this.getTagText(prodNode, 'cEANTrib');
            const ean = rawEan && rawEan.toUpperCase() !== 'SEM GTIN' ? rawEan : null;
            const name = this.getTagText(prodNode, 'xProd');
            const quantity = this.parseDecimal(this.getTagText(prodNode, 'qCom'));
            const unitPrice = this.parseDecimal(this.getTagText(prodNode, 'vUnCom'));
            const vProd = this.parseDecimal(this.getTagText(prodNode, 'vProd'));

            if (!name || quantity <= 0) continue;

            parsed.push({
                sku,
                ean,
                name,
                quantity,
                unitPrice,
                xmlItemData: {
                    cProd: this.getTagText(prodNode, 'cProd') || null,
                    cEAN: this.getTagText(prodNode, 'cEAN') || null,
                    cEANTrib: this.getTagText(prodNode, 'cEANTrib') || null,
                    ncm: this.getTagText(prodNode, 'NCM') || null,
                    cest: this.getTagText(prodNode, 'CEST') || null,
                    cfop: this.getTagText(prodNode, 'CFOP') || null,
                    uCom: this.getTagText(prodNode, 'uCom') || null,
                    qCom: quantity,
                    vUnCom: unitPrice,
                    vProd,
                },
            });
        }

        return parsed;
    }

    private static parseNfeHeader(xmlContent: string): ParsedNfeHeader {
        const doc = new DOMParser().parseFromString(xmlContent, 'text/xml');

        const infNFeNode = doc.getElementsByTagName('infNFe')[0];
        const ideNode = doc.getElementsByTagName('ide')[0];
        const emitNode = doc.getElementsByTagName('emit')[0];
        const destNode = doc.getElementsByTagName('dest')[0];
        const totalNode = doc.getElementsByTagName('total')[0];
        const icmsTotNode = totalNode?.getElementsByTagName('ICMSTot')[0];

        const infNFeId = String(infNFeNode?.getAttribute('Id') || '').trim();
        const possibleKey = infNFeId.startsWith('NFe') ? infNFeId.slice(3) : infNFeId;
        const nfeKey = /^\d{44}$/.test(possibleKey) ? possibleKey : null;

        const dhEmi = this.getTagText(ideNode, 'dhEmi');
        const dEmi = this.getTagText(ideNode, 'dEmi');
        const issueDateRaw = dhEmi || dEmi;
        const issueDate = issueDateRaw ? new Date(issueDateRaw) : null;
        const vTotTribRaw = this.getTagText(icmsTotNode, 'vTotTrib');
        const tributosTotal = vTotTribRaw ? this.parseDecimal(vTotTribRaw) : null;

        return {
            nfeKey,
            nfeIssueDate: issueDate && !Number.isNaN(issueDate.getTime())
                ? issueDate.toISOString().split('T')[0] as string
                : null,
            headerData: {
                numero: this.getTagText(ideNode, 'nNF') || null,
                serie: this.getTagText(ideNode, 'serie') || null,
                naturezaOperacao: this.getTagText(ideNode, 'natOp') || null,
                modelo: this.getTagText(ideNode, 'mod') || null,
                emitenteNome: this.getTagText(emitNode, 'xNome') || null,
                emitenteDocumento: this.getTagText(emitNode, 'CNPJ') || this.getTagText(emitNode, 'CPF') || null,
                destinatarioNome: this.getTagText(destNode, 'xNome') || null,
                destinatarioDocumento: this.getTagText(destNode, 'CNPJ') || this.getTagText(destNode, 'CPF') || null,
                tributosTotal,
            },
        };
    }

    private static async resolveOrCreateProductForNfeItem(
        companyId: number,
        item: ParsedNfeItem,
        allProducts: Product[]
    ): Promise<Product | null> {
        let product = await ProductRepository.getBySkuOrEan(companyId, item.sku, item.ean);

        if (!product) {
            product = this.resolveProductByNameFallback(allProducts, item.name) as Product | null;
        }

        if (product) {
            return product;
        }

        const created = await ProductRepository.create(companyId, {
            name: item.name,
            sku: item.sku || undefined,
            ean: item.ean || undefined,
            external_code: item.sku || undefined,
            is_imported: true,
            cost_price: item.unitPrice > 0 ? item.unitPrice : 0,
            selling_price: item.unitPrice > 0 ? item.unitPrice : 0,
            initial_stock: 0,
            min_stock: 0,
            max_stock: 0,
        });

        allProducts.push(created);
        return created;
    }

    private static async resolveDefaultBankAccountPublicId(companyId: number): Promise<string | null> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT public_id
             FROM bank_accounts
             WHERE company_id = ?
             ORDER BY id ASC
             LIMIT 1`,
            [companyId]
        );

        return rows.length > 0 ? String(rows[0]!.public_id || '').trim() || null : null;
    }

    private static async resolveDefaultIncomeCategoryPublicId(companyId: number): Promise<string | null> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT public_id
             FROM categories
             WHERE company_id = ?
               AND type = 'income'
             ORDER BY CASE WHEN LOWER(name) LIKE '%venda%' THEN 0 ELSE 1 END, id ASC
             LIMIT 1`,
            [companyId]
        );

        return rows.length > 0 ? String(rows[0]!.public_id || '').trim() || null : null;
    }

    private static async resolveCustomerPublicIdByDocument(companyId: number, xmlContent: string): Promise<string | null> {
        const doc = new DOMParser().parseFromString(xmlContent, 'text/xml');
        const destNode = doc.getElementsByTagName('dest')[0];
        const cnpj = this.getTagText(destNode, 'CNPJ').replace(/\D/g, '');
        const cpf = this.getTagText(destNode, 'CPF').replace(/\D/g, '');
        const documentDigits = cnpj || cpf;

        if (!documentDigits) return null;

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT public_id
             FROM customers
             WHERE company_id = ?
               AND REPLACE(REPLACE(REPLACE(cnpj_cpf, '.', ''), '-', ''), '/', '') = ?
             LIMIT 1`,
            [companyId, documentDigits]
        );

        return rows.length > 0 ? String(rows[0]!.public_id || '').trim() || null : null;
    }

    private static resolveOrderDate(xmlContent: string): string {
        const doc = new DOMParser().parseFromString(xmlContent, 'text/xml');
        const ideNode = doc.getElementsByTagName('ide')[0];
        const dhEmi = this.getTagText(ideNode, 'dhEmi');
        const dEmi = this.getTagText(ideNode, 'dEmi');
        const candidate = dhEmi || dEmi;

        if (!candidate) {
            return new Date().toISOString().split('T')[0] as string;
        }

        const date = new Date(candidate);
        if (Number.isNaN(date.getTime())) {
            return new Date().toISOString().split('T')[0] as string;
        }

        return date.toISOString().split('T')[0] as string;
    }

    static async importSaleFromXml(
        companyId: number,
        userPublicId: string,
        data: ImportSaleFromXmlData
    ): Promise<{ sale: SalesOrder; imported_items: number; unmatched_items: Array<{ sku: string | null; ean: string | null; name: string }> }> {
        const xmlContent = String(data.xml_content || '').trim();
        if (!xmlContent) {
            throw new Error('Conteudo XML nao informado.');
        }

        const parsedItems = this.parseNfeItems(xmlContent);
        const parsedHeader = this.parseNfeHeader(xmlContent);

        await this.assertNfeEmitterMatchesCompany(companyId, parsedHeader.headerData.emitenteDocumento);
        await this.assertNfeNotDuplicated(companyId, parsedHeader.nfeKey);

        if (parsedItems.length === 0) {
            throw new Error('Nenhum item valido encontrado no XML da NFe.');
        }

        const allProducts = await ProductRepository.listByCompany(companyId);

        const matchedItems: Array<{ product_public_id: string; quantity: number; unit_price: number; xml_item_data?: Record<string, any> }> = [];
        const unmatchedItems: Array<{ sku: string | null; ean: string | null; name: string }> = [];

        for (const item of parsedItems) {
            const product = await this.resolveOrCreateProductForNfeItem(companyId, item, allProducts);

            if (!product) {
                unmatchedItems.push({ sku: item.sku, ean: item.ean, name: item.name });
                continue;
            }

            matchedItems.push({
                product_public_id: product.public_id,
                quantity: item.quantity,
                unit_price: item.unitPrice > 0 ? item.unitPrice : Number(product.selling_price || 0),
                xml_item_data: item.xmlItemData,
            });
        }

        if (matchedItems.length === 0) {
            throw new Error('Nao foi possivel processar itens validos da NFe para importacao.');
        }

        const bankAccountPublicId = data.bank_account_public_id
            || await this.resolveDefaultBankAccountPublicId(companyId);
        if (!bankAccountPublicId) {
            throw new Error('Nenhuma conta bancaria encontrada para a empresa.');
        }

        const categoryPublicId = data.category_public_id
            || await this.resolveDefaultIncomeCategoryPublicId(companyId);
        if (!categoryPublicId) {
            throw new Error('Nenhuma categoria de receita encontrada para a empresa.');
        }

        const customerPublicId = data.customer_public_id
            || await this.resolveCustomerPublicIdByDocument(companyId, xmlContent);

        const sale = await this.createSalesOrder(companyId, userPublicId, {
            customer_public_id: customerPublicId,
            delivery_address: data.delivery_address || null,
            bank_account_public_id: bankAccountPublicId,
            category_public_id: categoryPublicId,
            date: data.date || this.resolveOrderDate(xmlContent),
            nfe_key: parsedHeader.nfeKey,
            nfe_issue_date: parsedHeader.nfeIssueDate,
            nfe_header_json: parsedHeader.headerData,
            items: matchedItems,
        });

        return {
            sale,
            imported_items: matchedItems.length,
            unmatched_items: unmatchedItems,
        };
    }

    static async createPurchaseOrder(companyId: number, userPublicId: string, data: CreatePurchaseData): Promise<PurchaseOrder> {
        return OrderRepository.createPurchaseOrder(companyId, userPublicId, data);
    }

    static async createSalesOrder(companyId: number, userPublicId: string, data: CreateSalesData): Promise<SalesOrder> {
        return OrderRepository.createSalesOrder(companyId, userPublicId, data);
    }

    static async getPurchaseById(id: number, companyId: number): Promise<PurchaseOrder> {
        return OrderRepository.getPurchaseById(id, companyId);
    }

    static async getSaleById(id: number, companyId: number): Promise<SalesOrder> {
        return OrderRepository.getSaleById(id, companyId);
    }

    static async listSales(companyId: number, includeInactive = false): Promise<any[]> {
        return OrderRepository.listSales(companyId, includeInactive);
    }

    static async updateSaleStatus(id: number, companyId: number, status: string, nfeEmittedAt?: Date): Promise<void> {
        return OrderRepository.updateSaleStatus(id, companyId, status, nfeEmittedAt);
    }

    static async softDeleteSale(id: number, companyId: number): Promise<void> {
        return OrderRepository.softDeleteSale(id, companyId);
    }

    static async hardDeleteInactiveSale(id: number, companyId: number): Promise<void> {
        return OrderRepository.hardDeleteInactiveSale(id, companyId);
    }

    static async softDeleteSaleItem(saleId: number, itemId: number, companyId: number): Promise<void> {
        return OrderRepository.softDeleteSaleItem(saleId, itemId, companyId);
    }

    static async setSaleActive(id: number, companyId: number, isActive: boolean): Promise<void> {
        return OrderRepository.setSaleActive(id, companyId, isActive);
    }

    static async setSaleItemActive(saleId: number, itemId: number, companyId: number, isActive: boolean): Promise<void> {
        return OrderRepository.setSaleItemActive(saleId, itemId, companyId, isActive);
    }

    static async listSalesByCustomer(customerPublicId: string, companyId: number): Promise<any[]> {
        return OrderRepository.listSalesByCustomer(customerPublicId, companyId);
    }

    static async listPurchasesBySupplier(supplierPublicId: string, companyId: number): Promise<any[]> {
        return OrderRepository.listPurchasesBySupplier(supplierPublicId, companyId);
    }
}
