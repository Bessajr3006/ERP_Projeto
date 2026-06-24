import fs from 'fs';
import path from 'path';
import { Product, CreateProductData } from '../types/Product';
import { EstoqueService } from './estoqueService';
import { ProductRepository } from '../repositories/productRepository';
import { CompanyService } from './companyService';
import { FinanceService } from './financeService';
import { WhatsAppBusinessService } from './whatsappBusinessService';
import { WhatsAppBusinessMessageService } from './whatsappBusinessMessageService';

export class ProductService {
    static async create(companyId: number, data: CreateProductData): Promise<Product> {
        return ProductRepository.create(companyId, data);
    }

    static async getById(id: number, companyId: number): Promise<Product> {
        return ProductRepository.getById(id, companyId);
    }

    static async getByPublicId(publicId: string, companyId: number): Promise<Product> {
        return ProductRepository.getByPublicId(publicId, companyId);
    }

    static async listByCompany(companyId: number): Promise<Product[]> {
        return ProductRepository.listByCompany(companyId);
    }

    static async recordMovement(
        connection: any,
        companyId: number,
        productId: number,
        type: 'in' | 'out',
        quantity: number,
        purchaseId: number | null = null,
        saleId: number | null = null
    ): Promise<void> {
        return ProductRepository.recordMovement(connection, companyId, productId, type, quantity, purchaseId, saleId);
    }

    static async update(publicId: string, companyId: number, data: Partial<CreateProductData>): Promise<Product> {
        return ProductRepository.update(publicId, companyId, data);
    }

    static async delete(publicId: string, companyId: number): Promise<void> {
        return ProductRepository.delete(publicId, companyId);
    }

    static async bulkUpdate(companyId: number, data: {
        productIds: string[],
        category_id?: number | null | undefined,
        stock_type_id?: number | null | undefined,
        manufacturer_id?: number | null | undefined,
        tax_rule_id?: number | null | undefined,
        measure_id?: number | null | undefined,
        selling_price?: number | undefined,
        cost_price?: number | undefined,
        min_stock?: number | undefined,
        max_stock?: number | undefined,
        is_promotional?: boolean | undefined,
        promotional_price?: number | undefined
    }): Promise<number> {
        return ProductRepository.bulkUpdate(companyId, data);
    }

    static async bulkDelete(productIds: string[], companyId: number): Promise<number> {
        return ProductRepository.bulkDelete(companyId, productIds);
    }

    static async importSolidcon(companyId: number, items: any[]): Promise<{ created: number; updated: number; skipped: number; errors: Array<{ index: number; reason: string }> }> {
        const result = { created: 0, updated: 0, skipped: 0, errors: [] as Array<{ index: number; reason: string }> };

        const normalizeText = (value: any): string => String(value ?? '').trim();
        const parseNumber = (value: any): number | undefined => {
            if (value === null || value === undefined || value === '') return undefined;
            const normalized = String(value)
                .trim()
                .replace(/\s/g, '')
                .replace(/\.(?=\d{3}(\D|$))/g, '')
                .replace(',', '.');
            const parsed = Number(normalized);
            return Number.isFinite(parsed) ? parsed : undefined;
        };
        const normalizeKey = (value: string): string => value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9]/g, '')
            .toLowerCase();
        const pickValue = (payload: any, keys: string[]): any => {
            if (!payload || typeof payload !== 'object') return undefined;
            for (const key of keys) {
                if (payload && payload[key] !== undefined && payload[key] !== null && payload[key] !== '') {
                    return payload[key];
                }
            }
            const normalizedKeys = new Map(Object.keys(payload).map((key) => [normalizeKey(key), key]));
            for (const key of keys) {
                const actualKey = normalizedKeys.get(normalizeKey(key));
                if (actualKey && payload[actualKey] !== undefined && payload[actualKey] !== null && payload[actualKey] !== '') {
                    return payload[actualKey];
                }
            }
            return undefined;
        };
        const mapSolidconItem = (payload: any): CreateProductData | null => {
            const name = normalizeText(pickValue(payload, ['produto', 'nome_produto', 'descricao_produto', 'ds_produto', 'name', 'nome', 'descricao', 'description', 'title']));
            if (!name) return null;

            const categoryName = normalizeText(pickValue(payload, ['classificacao02', 'classificacao_02', 'classificacao2', 'classificacao', 'categoria', 'category', 'grupo', 'grupo_produto', 'familia', 'linha', 'secao', 'subgrupo'])) || undefined;
            const measureValue = normalizeText(pickValue(payload, ['unid_medida', 'unidade_medida', 'unidade', 'medida', 'measure', 'und', 'un'])) || undefined;

            const sku = normalizeText(pickValue(payload, ['id_produto', 'cod_produto', 'codigo_produto', 'sku', 'codigo', 'codigo_interno', 'code', 'reference', 'referencia'])) || undefined;
            const ean = normalizeText(pickValue(payload, ['codigo_ean', 'ean', 'gtin', 'barcode', 'codigo_barras', 'cod_barra', 'cod_barras'])) || undefined;

            const data: CreateProductData = {
                name,
                description: normalizeText(pickValue(payload, ['description', 'descricao', 'detalhes'])) || undefined,
                sku,
                ean,
                external_code: normalizeText(pickValue(payload, ['external_code', 'codigo_externo', 'id_externo', 'id_produto', 'cod_produto', 'codigo_produto'])) || undefined,
                ncm: normalizeText(pickValue(payload, ['ncm'])) || undefined,
                cest: normalizeText(pickValue(payload, ['cest'])) || undefined,
                cost_price: parseNumber(pickValue(payload, ['cost_price', 'preco_custo', 'valor_custo', 'vl_custo', 'cost'])) || 0,
                selling_price: parseNumber(pickValue(payload, ['vl_produto', 'vl_produto_normal', 'valor_produto', 'selling_price', 'price', 'preco', 'preco_venda', 'valor_venda', 'vl_venda'])) || 0,
                initial_stock: parseNumber(pickValue(payload, ['qtd_produto', 'quantidade_produto', 'initial_stock', 'stock', 'estoque', 'current_stock', 'quantidade', 'qtd_estoque'])) || 0,
                min_stock: parseNumber(pickValue(payload, ['min_stock', 'estoque_minimo'])) || 0,
                max_stock: parseNumber(pickValue(payload, ['max_stock', 'estoque_maximo'])) || 0,
            };

            if (categoryName) {
                (data as any)._categoryName = categoryName;
            }
            if (measureValue) {
                (data as any)._measureValue = measureValue;
            }

            return data;
        };

        const processedSku = new Set<string>();
        for (let index = 0; index < items.length; index += 1) {
            const item = items[index];
            try {
                if (item?.ean_principal === false && item?.id_produto && processedSku.has(String(item.id_produto))) {
                    result.skipped += 1;
                    result.errors.push({ index, reason: 'EAN secundario ignorado para produto ja importado.' });
                    continue;
                }
                const mapped = mapSolidconItem(item);
                if (!mapped) {
                    result.skipped += 1;
                    result.errors.push({ index, reason: 'Item sem nome valido.' });
                    continue;
                }

                if (mapped.sku) {
                    processedSku.add(mapped.sku);
                }

                let categoryId: number | null = null;
                const categoryName = (mapped as any)._categoryName as string | undefined;
                if (categoryName) {
                    const category = await EstoqueService.getOrCreateCategoryByName(companyId, categoryName);
                    categoryId = category.id;
                }

                let measureId: number | null = null;
                const measureValue = (mapped as any)._measureValue as string | undefined;
                if (measureValue) {
                    const measure = await EstoqueService.getOrCreateMeasureByValue(companyId, measureValue);
                    measureId = measure.id;
                }

                const existing = await ProductRepository.getBySkuOrEan(companyId, mapped.sku, mapped.ean);
                if (existing) {
                    const updatePayload: Partial<CreateProductData> = {
                        name: mapped.name,
                        description: mapped.description,
                        sku: mapped.sku,
                        ean: mapped.ean,
                        external_code: mapped.external_code,
                        is_imported: true,
                        ncm: mapped.ncm,
                        cest: mapped.cest,
                        cost_price: mapped.cost_price,
                        selling_price: mapped.selling_price,
                        min_stock: mapped.min_stock,
                        max_stock: mapped.max_stock,
                        category_id: categoryId ?? undefined,
                        measure_id: measureId ?? undefined,
                    };
                    await ProductRepository.update(existing.public_id, companyId, updatePayload);
                    result.updated += 1;
                    continue;
                }

                await ProductRepository.create(companyId, {
                    ...mapped,
                    is_imported: true,
                    category_id: categoryId ?? undefined,
                    measure_id: measureId ?? undefined,
                });
                result.created += 1;
            }
            catch (error: any) {
                result.skipped += 1;
                result.errors.push({ index, reason: error?.message || 'Falha ao importar item.' });
            }
        }

        return result;
    }

    static async sendCatalog(companyId: number, userId: number, phone: string, type: 'pdf' | 'link' = 'pdf', origin?: string): Promise<any> {
        const normalizedPhone = WhatsAppBusinessMessageService.normalizeContactPhone(phone);
        if (!normalizedPhone) {
            throw new Error('Telefone do destinatário inválido ou não informado. Use DDD + número.');
        }

        const company = await CompanyService.getById(companyId);

        if (type === 'link') {
            const catalogUrl = `${origin || 'http://localhost:8085'}/pages/catalog.html?company=${company.public_id}`;
            const messageBody = `Olá!\n\nConfira o nosso catálogo de produtos digital sempre atualizado:\n\n${catalogUrl}\n\nFicamos à disposição para qualquer dúvida ou pedido!`;
            
            const useCompanyScope = (company.whatsapp_business_scope || 'company') === 'company';
            const messageInput = {
                to: normalizedPhone,
                messageBody: messageBody.trim(),
            };

            if (useCompanyScope) {
                return await WhatsAppBusinessService.sendMessage(companyId, messageInput);
            } else {
                return await WhatsAppBusinessService.sendUserMessage(companyId, userId, messageInput);
            }
        }

        const products = await ProductRepository.listByCompany(companyId);

        const validProducts = products.filter((p) => p.name && p.name.trim() !== '');

        if (validProducts.length === 0) {
            throw new Error('Nenhum produto cadastrado no catálogo para envio.');
        }

        // Group products by category
        const groups: Record<string, Product[]> = {};
        for (const p of validProducts) {
            const catName = p.stock_type_name || p.category_name || 'Outros';
            if (!groups[catName]) {
                groups[catName] = [];
            }
            groups[catName].push(p);
        }

        const escapeHtml = (val: unknown): string =>
            String(val ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');

        const formatCurrency = (val: number) =>
            new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

        const getProductImageSrc = (p: Product): string => {
            if (p.image_base64) {
                return String(p.image_base64).startsWith('data:') 
                    ? String(p.image_base64) 
                    : `data:image/jpeg;base64,${p.image_base64}`;
            }
            if (p.image_url) {
                const absolutePath = path.join(process.cwd(), 'public', p.image_url);
                if (fs.existsSync(absolutePath)) {
                    const ext = path.extname(absolutePath).toLowerCase();
                    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.svg' ? 'image/svg+xml' : 'image/jpeg';
                    try {
                        const base64 = fs.readFileSync(absolutePath).toString('base64');
                        return `data:${mime};base64,${base64}`;
                    } catch {
                        return '';
                    }
                }
            }
            return '';
        };

        let logoHtml = '';
        if (company.logo_base64) {
            const logoSrc = company.logo_base64.startsWith('data:') 
                ? company.logo_base64 
                : `data:image/jpeg;base64,${company.logo_base64}`;
            logoHtml = `<img class="company-logo" src="${escapeHtml(logoSrc)}" alt="Logo" />`;
        } else if (company.logo_url) {
            const absolutePath = path.join(process.cwd(), 'public', company.logo_url);
            if (fs.existsSync(absolutePath)) {
                const ext = path.extname(absolutePath).toLowerCase();
                const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.svg' ? 'image/svg+xml' : 'image/jpeg';
                try {
                    const base64 = fs.readFileSync(absolutePath).toString('base64');
                    const logoSrc = `data:${mime};base64,${base64}`;
                    logoHtml = `<img class="company-logo" src="${escapeHtml(logoSrc)}" alt="Logo" />`;
                } catch {
                    // Ignore and keep empty logo
                }
            }
        }

        let categoriesHtml = '';
        for (const [categoryName, catProducts] of Object.entries(groups)) {
            let productCards = '';
            for (const p of catProducts) {
                const imgDecoded = getProductImageSrc(p);
                const imageTag = imgDecoded
                    ? `<div class="product-image-container"><img class="product-image" src="${escapeHtml(imgDecoded)}" alt="${escapeHtml(p.name)}" /></div>`
                    : `<div class="product-image-placeholder"><svg class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg></div>`;

                const isPromo = p.is_promotional && Number(p.promotional_price) > 0;
                const priceHtml = isPromo
                    ? `<span class="original-price">${formatCurrency(Number(p.selling_price))}</span>
                       <span class="product-price promo-price">${formatCurrency(Number(p.promotional_price))}</span>`
                    : `<span class="product-price">${formatCurrency(Number(p.selling_price))}</span>`;

                productCards += `
                    <div class="product-card">
                        ${imageTag}
                        <h4 class="product-name">${escapeHtml(p.name)}</h4>
                        ${p.sku ? `<div class="product-sku">SKU: ${escapeHtml(p.sku)}</div>` : ''}
                        <div class="product-price-container">
                            ${priceHtml}
                        </div>
                    </div>
                `;
            }

            categoriesHtml += `
                <div class="category-section">
                    <h2 class="category-title">${escapeHtml(categoryName)}</h2>
                    <div class="product-grid">
                        ${productCards}
                    </div>
                </div>
            `;
        }

        const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Catálogo de Produtos</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        body {
            font-family: 'Inter', sans-serif;
            margin: 0;
            padding: 0;
            color: #1e293b;
            background-color: #fff;
            -webkit-print-color-adjust: exact;
        }
        
        .header {
            display: flex;
            align-items: center;
            border-bottom: 2px solid #f1f5f9;
            padding-bottom: 20px;
            margin-bottom: 30px;
            gap: 20px;
        }
        
        .company-logo {
            width: 80px;
            height: 80px;
            object-fit: contain;
            border-radius: 12px;
        }
        
        .company-info h1 {
            font-size: 24px;
            font-weight: 700;
            margin: 0 0 5px 0;
            color: #0f172a;
        }
        
        .company-info .subtitle {
            font-size: 16px;
            font-weight: 500;
            color: #4f46e5;
            margin: 0 0 5px 0;
        }
        
        .company-info .details {
            font-size: 12px;
            color: #64748b;
            margin: 0;
        }
        
        .category-section {
            margin-bottom: 40px;
            page-break-inside: avoid;
        }
        
        .category-title {
            font-size: 18px;
            font-weight: 700;
            color: #0f172a;
            border-left: 4px solid #4f46e5;
            padding-left: 10px;
            margin-bottom: 20px;
            page-break-after: avoid;
        }
        
        .product-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
        }
        
        .product-card {
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 12px;
            background: #fff;
            display: flex;
            flex-direction: column;
            height: 100%;
            box-sizing: border-box;
            page-break-inside: avoid;
        }
        
        .product-image-container {
            width: 100%;
            height: 110px;
            background: #f8fafc;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            margin-bottom: 8px;
        }
        
        .product-image {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
        }
        
        .product-image-placeholder {
            width: 100%;
            height: 110px;
            background: #f1f5f9;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .placeholder-icon {
            width: 32px;
            height: 32px;
            color: #cbd5e1;
        }
        
        .product-name {
            font-size: 13px;
            font-weight: 600;
            color: #1e293b;
            margin: 4px 0;
            line-height: 1.3;
            height: 34px;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
        
        .product-sku {
            font-size: 9px;
            color: #64748b;
            font-family: monospace;
            margin-bottom: 6px;
        }
        
        .product-price-container {
            margin-top: auto;
            display: flex;
            align-items: baseline;
            flex-wrap: wrap;
        }
        
        .original-price {
            font-size: 10px;
            color: #94a3b8;
            text-decoration: line-through;
            margin-right: 5px;
        }
        
        .product-price {
            font-size: 14px;
            font-weight: 700;
            color: #4f46e5;
        }
        
        .promo-price {
            color: #10b981;
        }
    </style>
</head>
<body>
    <header class="header">
        ${logoHtml}
        <div class="company-info">
            <h1>${escapeHtml(company.trade_name || company.company_name)}</h1>
            <p class="subtitle">Catálogo de Produtos</p>
            <p class="details">
                ${company.cnpj ? `CNPJ: ${escapeHtml(company.cnpj)}` : ''} 
                ${company.phone ? ` | Tel: ${escapeHtml(company.phone)}` : ''}
                ${company.email ? ` | E-mail: ${escapeHtml(company.email)}` : ''}
            </p>
        </div>
    </header>
    ${categoriesHtml}
</body>
</html>`;

        const pdfBuffer = await FinanceService.generatePdfFromHtml(html);
        const pdfBase64 = pdfBuffer.toString('base64');
        const safeName = String(company.trade_name || company.company_name || 'Catalogo').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
        const filename = `Catalogo_${safeName}.pdf`;

        const messageBody = `Olá!\n\nSegue em anexo o nosso catálogo de produtos atualizado de *${company.trade_name || company.company_name}*.\n\nFicamos à disposição para qualquer dúvida ou pedido!`;

        const useCompanyScope = (company.whatsapp_business_scope || 'company') === 'company';
        const messageInput = {
            to: normalizedPhone,
            messageBody: messageBody.trim(),
            attachment: {
                base64: pdfBase64,
                mimeType: 'application/pdf',
                fileName: filename,
            },
        };

        if (useCompanyScope) {
            return await WhatsAppBusinessService.sendMessage(companyId, messageInput);
        } else {
            return await WhatsAppBusinessService.sendUserMessage(companyId, userId, messageInput);
        }
    }
}

