import { randomUUID } from 'crypto';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { Product, CreateProductData } from '../types/Product';
import { StorageService } from '../utils/storageService';

export class ProductRepository {
    private static async ensureStockTypeBelongsToCompany(stockTypeId: number, companyId: number): Promise<void> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT id FROM stock_types WHERE id = ? AND company_id = ? LIMIT 1',
            [stockTypeId, companyId]
        );
        if (!rows || rows.length === 0) {
            throw new Error('Invalid stock type for this company');
        }
    }

    static async create(companyId: number, data: CreateProductData): Promise<Product> {
        const { name, description, sku, ean, external_code, is_imported = false, cost_price = 0, selling_price = 0, is_promotional = false, promotional_price = 0, initial_stock = 0, min_stock = 0, max_stock = 0, category_id, stock_type_id, manufacturer_id, tax_rule_id, measure_id, image_base64, image_url: imageUrlParam } = data;

        if (sku) {
            const [existing] = await pool.query<RowDataPacket[]>('SELECT id FROM products WHERE sku = ? AND company_id = ? LIMIT 1', [sku, companyId]);
            if (existing && existing.length > 0) throw new Error('SKU already registered for this company');
        }

        let resolvedImageUrl: string | null = imageUrlParam || null;
        if (!resolvedImageUrl && image_base64) {
            const saved = StorageService.saveBase64('products', image_base64);
            resolvedImageUrl = saved ? saved.url : null;
        }

        if (stock_type_id) {
            await this.ensureStockTypeBelongsToCompany(stock_type_id, companyId);
        }

        const publicId = randomUUID();
        const conn = await pool.getConnection();

        try {
            await conn.beginTransaction();

            const [result] = await conn.query<ResultSetHeader>(
                `INSERT INTO products (public_id, company_id, name, description, sku, ean, external_code, is_imported, cost_price, selling_price, is_promotional, promotional_price, current_stock, min_stock, max_stock, category_id, stock_type_id, manufacturer_id, tax_rule_id, measure_id, image_base64, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [publicId, companyId, name, description || null, sku || null, ean || null, external_code || null, is_imported ? 1 : 0, cost_price, selling_price, is_promotional ? 1 : 0, promotional_price, min_stock, max_stock, category_id || null, stock_type_id || null, manufacturer_id || null, tax_rule_id || null, measure_id || null, image_base64 || null, resolvedImageUrl]
            );

            const productId = result.insertId;

            if (initial_stock > 0) {
                await this.recordMovement(conn, companyId, productId, 'in', initial_stock, null, null);
            }

            await conn.commit();
            return this.getById(productId, companyId);
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    static async getById(id: number, companyId: number): Promise<Product> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT p.*, c.name AS category_name, st.name AS stock_type_name, m.name AS manufacturer_name, t.name AS tax_rule_name, me.name AS measure_name, me.abbreviation AS measure_abbreviation FROM products p LEFT JOIN product_categories c ON p.category_id = c.id LEFT JOIN stock_types st ON p.stock_type_id = st.id LEFT JOIN manufacturers m ON p.manufacturer_id = m.id LEFT JOIN tax_rules t ON p.tax_rule_id = t.id LEFT JOIN measures me ON p.measure_id = me.id WHERE p.id = ? AND p.company_id = ? LIMIT 1`,
            [id, companyId]
        );
        if (!rows || rows.length === 0) throw new Error('Product not found');
        return rows[0] as Product;
    }

    static async getByPublicId(publicId: string, companyId: number): Promise<Product> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT p.*, c.name AS category_name, st.name AS stock_type_name, m.name AS manufacturer_name, t.name AS tax_rule_name, me.name AS measure_name, me.abbreviation AS measure_abbreviation FROM products p LEFT JOIN product_categories c ON p.category_id = c.id LEFT JOIN stock_types st ON p.stock_type_id = st.id LEFT JOIN manufacturers m ON p.manufacturer_id = m.id LEFT JOIN tax_rules t ON p.tax_rule_id = t.id LEFT JOIN measures me ON p.measure_id = me.id WHERE p.public_id = ? AND p.company_id = ? LIMIT 1`,
            [publicId, companyId]
        );
        if (!rows || rows.length === 0) throw new Error('Product not found');
        return rows[0] as Product;
    }

    static async getBySkuOrEan(companyId: number, sku?: string | null, ean?: string | null): Promise<Product | null> {
        const conditions: string[] = [];
        const values: any[] = [companyId];

        if (sku) {
            conditions.push('p.sku = ?');
            values.push(sku);
        }
        if (ean) {
            conditions.push('p.ean = ?');
            values.push(ean);
        }
        if (conditions.length === 0) {
            return null;
        }

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT p.*, c.name AS category_name, st.name AS stock_type_name, m.name AS manufacturer_name, t.name AS tax_rule_name, me.name AS measure_name, me.abbreviation AS measure_abbreviation FROM products p LEFT JOIN product_categories c ON p.category_id = c.id LEFT JOIN stock_types st ON p.stock_type_id = st.id LEFT JOIN manufacturers m ON p.manufacturer_id = m.id LEFT JOIN tax_rules t ON p.tax_rule_id = t.id LEFT JOIN measures me ON p.measure_id = me.id WHERE p.company_id = ? AND (${conditions.join(' OR ')}) LIMIT 1`,
            values
        );
        if (!rows || rows.length === 0) {
            return null;
        }
        return rows[0] as Product;
    }

    static async listByCompany(companyId: number): Promise<Product[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT p.*, c.name AS category_name, st.name AS stock_type_name, m.name AS manufacturer_name, t.name AS tax_rule_name, me.name AS measure_name, me.abbreviation AS measure_abbreviation FROM products p LEFT JOIN product_categories c ON p.category_id = c.id LEFT JOIN stock_types st ON p.stock_type_id = st.id LEFT JOIN manufacturers m ON p.manufacturer_id = m.id LEFT JOIN tax_rules t ON p.tax_rule_id = t.id LEFT JOIN measures me ON p.measure_id = me.id WHERE p.company_id = ? ORDER BY p.name ASC`,
            [companyId]
        );
        return rows as Product[];
    }

    static async recordMovement(connection: any, companyId: number, productId: number, type: 'in' | 'out', quantity: number, purchaseId: number | null = null, saleId: number | null = null): Promise<void> {
        await connection.query(
            `INSERT INTO inventory_movements (company_id, product_id, type, quantity, purchase_id, sale_id) VALUES (?, ?, ?, ?, ?, ?)`,
            [companyId, productId, type, quantity, purchaseId, saleId]
        );
        const stockModifier = type === 'in' ? quantity : -quantity;
        const [updateResult] = await connection.query(
            'UPDATE products SET current_stock = current_stock + ? WHERE id = ? AND company_id = ?',
            [stockModifier, productId, companyId]
        );
        if (updateResult.affectedRows !== 1) throw new Error(`Failed to update physical stock for product ID: ${productId}`);
    }

    static async update(publicId: string, companyId: number, data: Partial<CreateProductData>): Promise<Product> {
        const current = await this.getByPublicId(publicId, companyId);
        const currentId = current.id;

        if (data.sku && data.sku !== current.sku) {
            const [existing] = await pool.query<RowDataPacket[]>('SELECT id FROM products WHERE sku = ? AND company_id = ? AND id != ? LIMIT 1', [data.sku, companyId, currentId]);
            if (existing && existing.length > 0) throw new Error('SKU already registered for this company');
        }

        const updates: string[] = [];
        const values: any[] = [];

        if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
        if (data.description !== undefined) { updates.push('description = ?'); values.push(data.description || null); }
        if (data.sku !== undefined) { updates.push('sku = ?'); values.push(data.sku || null); }
        if (data.ean !== undefined) { updates.push('ean = ?'); values.push(data.ean || null); }
        if (data.external_code !== undefined) { updates.push('external_code = ?'); values.push(data.external_code || null); }
        if (data.is_imported !== undefined) { updates.push('is_imported = ?'); values.push(data.is_imported ? 1 : 0); }
        if (data.cost_price !== undefined) { updates.push('cost_price = ?'); values.push(data.cost_price); }
        if (data.selling_price !== undefined) { updates.push('selling_price = ?'); values.push(data.selling_price); }
        if (data.is_promotional !== undefined) { updates.push('is_promotional = ?'); values.push(data.is_promotional ? 1 : 0); }
        if (data.promotional_price !== undefined) { updates.push('promotional_price = ?'); values.push(data.promotional_price); }
        if (data.category_id !== undefined) { updates.push('category_id = ?'); values.push(data.category_id || null); }
        if (data.stock_type_id !== undefined) {
            if (data.stock_type_id) {
                await this.ensureStockTypeBelongsToCompany(data.stock_type_id, companyId);
            }
            updates.push('stock_type_id = ?');
            values.push(data.stock_type_id || null);
        }
        if (data.manufacturer_id !== undefined) { updates.push('manufacturer_id = ?'); values.push(data.manufacturer_id || null); }
        if (data.tax_rule_id !== undefined) { updates.push('tax_rule_id = ?'); values.push(data.tax_rule_id || null); }
        if (data.measure_id !== undefined) { updates.push('measure_id = ?'); values.push(data.measure_id || null); }
        
        if (data.image_url !== undefined) {
            const newUrl = data.image_url || null;
            const oldUrl = current.image_url || null;
            if (oldUrl && oldUrl !== newUrl) StorageService.delete(oldUrl);
            updates.push('image_url = ?'); values.push(newUrl);
            if (newUrl === null && data.image_base64 === null) {
                updates.push('image_base64 = ?'); values.push(null);
            }
        } else if (data.image_base64 !== undefined) {
            if (current.image_url) StorageService.delete(current.image_url);
            const saved = StorageService.saveBase64('products', data.image_base64);
            updates.push('image_url = ?'); values.push(saved ? saved.url : null);
            updates.push('image_base64 = ?'); values.push(data.image_base64 || null);
        }
        if (data.min_stock !== undefined) { updates.push('min_stock = ?'); values.push(data.min_stock); }
        if (data.max_stock !== undefined) { updates.push('max_stock = ?'); values.push(data.max_stock); }

        if (updates.length > 0) {
            values.push(currentId, companyId);
            await pool.query<ResultSetHeader>(`UPDATE products SET ${updates.join(', ')} WHERE id = ? AND company_id = ?`, values);
        }
        return this.getById(currentId, companyId);
    }

    static async delete(publicId: string, companyId: number): Promise<void> {
        const current = await this.getByPublicId(publicId, companyId);
        const [result] = await pool.query<ResultSetHeader>(
            'DELETE FROM products WHERE id = ? AND company_id = ?',
            [current.id, companyId]
        );
        if (result.affectedRows !== 1) throw new Error('Failed to delete product');
        if (current.image_url) StorageService.delete(current.image_url);
    }

    static async bulkUpdate(companyId: number, data: {
        productIds: string[], category_id?: number | null | undefined, stock_type_id?: number | null | undefined, manufacturer_id?: number | null | undefined, tax_rule_id?: number | null | undefined, measure_id?: number | null | undefined, selling_price?: number | undefined, cost_price?: number | undefined, min_stock?: number | undefined, max_stock?: number | undefined, is_promotional?: boolean | undefined, promotional_price?: number | undefined
    }): Promise<number> {
        if (!data.productIds || data.productIds.length === 0) return 0;

        const updates: string[] = [];
        const values: any[] = [];

        if (data.category_id !== undefined) { updates.push('category_id = ?'); values.push(data.category_id); }
        if (data.stock_type_id !== undefined) {
            if (data.stock_type_id) {
                await this.ensureStockTypeBelongsToCompany(data.stock_type_id, companyId);
            }
            updates.push('stock_type_id = ?');
            values.push(data.stock_type_id);
        }
        if (data.manufacturer_id !== undefined) { updates.push('manufacturer_id = ?'); values.push(data.manufacturer_id); }
        if (data.tax_rule_id !== undefined) { updates.push('tax_rule_id = ?'); values.push(data.tax_rule_id); }
        if (data.measure_id !== undefined) { updates.push('measure_id = ?'); values.push(data.measure_id); }
        if (data.selling_price !== undefined) { updates.push('selling_price = ?'); values.push(data.selling_price); }
        if (data.cost_price !== undefined) { updates.push('cost_price = ?'); values.push(data.cost_price); }
        if (data.is_promotional !== undefined) { updates.push('is_promotional = ?'); values.push(data.is_promotional ? 1 : 0); }
        if (data.promotional_price !== undefined) { updates.push('promotional_price = ?'); values.push(data.promotional_price); }
        if (data.min_stock !== undefined) { updates.push('min_stock = ?'); values.push(data.min_stock); }
        if (data.max_stock !== undefined) { updates.push('max_stock = ?'); values.push(data.max_stock); }

        if (updates.length === 0) return 0;

        const placeholders = data.productIds.map(() => '?').join(', ');
        values.push(companyId, ...data.productIds);

        const [result] = await pool.query<ResultSetHeader>(
            `UPDATE products SET ${updates.join(', ')} WHERE company_id = ? AND public_id IN (${placeholders})`,
            values
        );

        return result.affectedRows;
    }
}