import { Product, CreateProductData } from '../types/Product';
import { EstoqueService } from './estoqueService';
import { ProductRepository } from '../repositories/productRepository';

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
}
