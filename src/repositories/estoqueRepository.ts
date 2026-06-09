import { randomUUID } from 'crypto';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import {
    ProductCategory, CreateProductCategoryData, UpdateProductCategoryData,
    StockType, CreateStockTypeData, UpdateStockTypeData,
    Manufacturer, CreateManufacturerData, UpdateManufacturerData,
    TaxRule, CreateTaxRuleData, UpdateTaxRuleData,
    PriceTable, CreatePriceTableData, UpdatePriceTableData,
    Measure, CreateMeasureData, UpdateMeasureData,
    ServiceType, CreateServiceTypeData, UpdateServiceTypeData,
    Service, CreateServiceData, UpdateServiceData,
    ServiceLaunch, CreateServiceLaunchData, UpdateServiceLaunchData
} from '../types/Estoque';

export class EstoqueRepository {
    static async getStockVisionAnalytics(companyId: number, stockTypeId?: number): Promise<{
        totalProducts: number;
        totalCategories: number;
        totalStockUnits: number;
        totalStockValue: number;
        totalStockSaleValue: number;
        lowStockItems: RowDataPacket[];
        topCategories: RowDataPacket[];
    }> {
        const hasStockTypeFilter = Number.isFinite(stockTypeId) && Number(stockTypeId) > 0;
        const params: Array<number> = [companyId];
        const whereFilter = hasStockTypeFilter ? ' AND stock_type_id = ?' : '';

        if (hasStockTypeFilter) {
            params.push(Number(stockTypeId));
        }

        const [totalsRows] = await pool.query<RowDataPacket[]>(
            `SELECT
                COUNT(*) AS total_products,
                COALESCE(SUM(current_stock), 0) AS total_stock_units,
                COALESCE(SUM(current_stock * cost_price), 0) AS total_stock_value,
                COALESCE(SUM(current_stock * selling_price), 0) AS total_stock_sale_value
             FROM products
             WHERE company_id = ?${whereFilter}`,
            params
        );

        const [categoryRows] = await pool.query<RowDataPacket[]>(
            `SELECT COUNT(DISTINCT p.category_id) AS total_categories
             FROM products p
             WHERE p.company_id = ?${hasStockTypeFilter ? ' AND p.stock_type_id = ?' : ''}`,
            params
        );

        const lowStockParams: Array<number> = [companyId];
        if (hasStockTypeFilter) {
            lowStockParams.push(Number(stockTypeId));
        }
        const [lowStockRows] = await pool.query<RowDataPacket[]>(
            `SELECT
                p.name,
                p.current_stock,
                p.min_stock,
                m.abbreviation AS measure
             FROM products p
             LEFT JOIN measures m ON m.id = p.measure_id
             WHERE p.company_id = ?
               ${hasStockTypeFilter ? 'AND p.stock_type_id = ?' : ''}
               AND p.current_stock <= COALESCE(NULLIF(p.min_stock, 0), 5)
             ORDER BY p.current_stock ASC, p.name ASC
             LIMIT 8`,
            lowStockParams
        );

        const topCategoryParams: Array<number> = [companyId];
        if (hasStockTypeFilter) {
            topCategoryParams.push(Number(stockTypeId));
        }
        const [topCategoryRows] = await pool.query<RowDataPacket[]>(
            `SELECT
                COALESCE(pc.name, 'Sem categoria') AS name,
                COUNT(p.id) AS product_count
             FROM products p
             LEFT JOIN product_categories pc ON pc.id = p.category_id
             WHERE p.company_id = ?
               ${hasStockTypeFilter ? 'AND p.stock_type_id = ?' : ''}
             GROUP BY COALESCE(pc.name, 'Sem categoria')
             ORDER BY product_count DESC, name ASC
             LIMIT 5`,
            topCategoryParams
        );

        return {
            totalProducts: Number(totalsRows[0]?.total_products) || 0,
            totalCategories: Number(categoryRows[0]?.total_categories) || 0,
            totalStockUnits: Number(totalsRows[0]?.total_stock_units) || 0,
            totalStockValue: Number(totalsRows[0]?.total_stock_value) || 0,
            totalStockSaleValue: Number(totalsRows[0]?.total_stock_sale_value) || 0,
            lowStockItems: lowStockRows,
            topCategories: topCategoryRows,
        };
    }

    private static async getServiceTypeInternalIdByPublicId(publicId: string, companyId: number): Promise<number> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT id FROM service_types WHERE public_id = ? AND company_id = ? LIMIT 1',
            [publicId, companyId]
        );
        const row = rows?.[0];
        if (!row) throw new Error('ServiceType not found');
        return Number(row.id);
    }

    private static async getCustomerInternalByPublicId(publicId: string, companyId: number): Promise<{ id: number; label: string }> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT id, name AS label
             FROM customers
             WHERE public_id = ? AND company_id = ?
             LIMIT 1`,
            [publicId, companyId]
        );
        const row = rows?.[0];
        if (!row) throw new Error('Customer not found');
        return {
            id: Number(row.id),
            label: String(row.label || 'Cliente'),
        };
    }

    private static async getServiceInternalByPublicId(publicId: string, companyId: number): Promise<{ id: number; name: string }> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT id, name FROM services WHERE public_id = ? AND company_id = ? LIMIT 1',
            [publicId, companyId]
        );
        const row = rows?.[0];
        if (!row) throw new Error('Service not found');
        return {
            id: Number(row.id),
            name: String(row.name || 'Serviço'),
        };
    }

    // ================== CATEGORIES ==================
    static async listCategories(companyId: number): Promise<ProductCategory[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT *, (SELECT COUNT(id) FROM products WHERE category_id = product_categories.id) as product_count FROM product_categories WHERE company_id = ? ORDER BY name ASC',
            [companyId]
        );
        return rows as ProductCategory[];
    }

    static async getCategoryByPublicId(publicId: string, companyId: number): Promise<ProductCategory> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM product_categories WHERE public_id = ? AND company_id = ? LIMIT 1',
            [publicId, companyId]
        );
        if (!rows || rows.length === 0) throw new Error('Category not found');
        return rows[0] as ProductCategory;
    }

    static async getCategoryByName(companyId: number, name: string): Promise<ProductCategory | null> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM product_categories WHERE company_id = ? AND name = ? LIMIT 1',
            [companyId, name]
        );
        if (!rows || rows.length === 0) return null;
        return rows[0] as ProductCategory;
    }

    static async createCategory(companyId: number, data: CreateProductCategoryData): Promise<ProductCategory> {
        const publicId = randomUUID();
        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO product_categories (public_id, company_id, name, description, image_base64) VALUES (?, ?, ?, ?, ?)`,
            [publicId, companyId, data.name, data.description || null, data.image_base64 || null]
        );
        if (result.affectedRows !== 1) throw new Error('Failed to create category');
        return this.getCategoryByPublicId(publicId, companyId);
    }

    static async updateCategory(publicId: string, companyId: number, data: UpdateProductCategoryData): Promise<ProductCategory> {
        const existing = await this.getCategoryByPublicId(publicId, companyId);
        const nameToSave = data.name || existing.name;
        const descToSave = data.description !== undefined ? data.description : existing.description;
        const imageToSave = data.image_base64 !== undefined ? data.image_base64 : existing.image_base64;

        await pool.query(
            `UPDATE product_categories SET name = ?, description = ?, image_base64 = ? WHERE public_id = ? AND company_id = ?`,
            [nameToSave, descToSave, imageToSave, publicId, companyId]
        );
        return this.getCategoryByPublicId(publicId, companyId);
    }

    static async deleteCategory(publicId: string, companyId: number): Promise<void> {
        await this.getCategoryByPublicId(publicId, companyId); // ensure it exists
        await pool.query('DELETE FROM product_categories WHERE public_id = ? AND company_id = ?', [publicId, companyId]);
    }

    // ================== STOCK TYPES ==================
    static async listStockTypes(companyId: number): Promise<StockType[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM stock_types WHERE company_id = ? ORDER BY name ASC',
            [companyId]
        );
        return rows as StockType[];
    }

    static async getStockTypeByPublicId(publicId: string, companyId: number): Promise<StockType> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM stock_types WHERE public_id = ? AND company_id = ? LIMIT 1',
            [publicId, companyId]
        );
        if (!rows || rows.length === 0) throw new Error('StockType not found');
        return rows[0] as StockType;
    }

    static async createStockType(companyId: number, data: CreateStockTypeData): Promise<StockType> {
        const publicId = randomUUID();
        const [result] = await pool.query<ResultSetHeader>(
            'INSERT INTO stock_types (public_id, company_id, name, description) VALUES (?, ?, ?, ?)',
            [publicId, companyId, data.name, data.description || null]
        );
        if (result.affectedRows !== 1) throw new Error('Failed to create stock type');
        return this.getStockTypeByPublicId(publicId, companyId);
    }

    static async updateStockType(publicId: string, companyId: number, data: UpdateStockTypeData): Promise<StockType> {
        const existing = await this.getStockTypeByPublicId(publicId, companyId);
        const nameToSave = data.name || existing.name;
        const descriptionToSave = data.description !== undefined ? data.description : existing.description;

        await pool.query(
            'UPDATE stock_types SET name = ?, description = ? WHERE public_id = ? AND company_id = ?',
            [nameToSave, descriptionToSave, publicId, companyId]
        );
        return this.getStockTypeByPublicId(publicId, companyId);
    }

    static async deleteStockType(publicId: string, companyId: number): Promise<void> {
        await this.getStockTypeByPublicId(publicId, companyId);
        await pool.query('DELETE FROM stock_types WHERE public_id = ? AND company_id = ?', [publicId, companyId]);
    }

    // ================== MANUFACTURERS ==================
    static async listManufacturers(companyId: number): Promise<Manufacturer[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT *, (SELECT COUNT(id) FROM products WHERE manufacturer_id = manufacturers.id) as product_count FROM manufacturers WHERE company_id = ? ORDER BY name ASC',
            [companyId]
        );
        return rows as Manufacturer[];
    }

    static async getManufacturerByPublicId(publicId: string, companyId: number): Promise<Manufacturer> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM manufacturers WHERE public_id = ? AND company_id = ? LIMIT 1',
            [publicId, companyId]
        );
        if (!rows || rows.length === 0) throw new Error('Manufacturer not found');
        return rows[0] as Manufacturer;
    }

    static async createManufacturer(companyId: number, data: CreateManufacturerData): Promise<Manufacturer> {
        const publicId = randomUUID();
        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO manufacturers (public_id, company_id, name, cnpj, phone, email, image_base64) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [publicId, companyId, data.name, data.cnpj || null, data.phone || null, data.email || null, data.image_base64 || null]
        );
        if (result.affectedRows !== 1) throw new Error('Failed to create manufacturer');
        return this.getManufacturerByPublicId(publicId, companyId);
    }

    static async updateManufacturer(publicId: string, companyId: number, data: UpdateManufacturerData): Promise<Manufacturer> {
        const existing = await this.getManufacturerByPublicId(publicId, companyId);
        const nameToSave = data.name || existing.name;
        const cnpjToSave = data.cnpj !== undefined ? data.cnpj : existing.cnpj;
        const phoneToSave = data.phone !== undefined ? data.phone : existing.phone;
        const emailToSave = data.email !== undefined ? data.email : existing.email;
        const imageToSave = data.image_base64 !== undefined ? data.image_base64 : existing.image_base64;

        await pool.query(
            `UPDATE manufacturers SET name = ?, cnpj = ?, phone = ?, email = ?, image_base64 = ? WHERE public_id = ? AND company_id = ?`,
            [nameToSave, cnpjToSave, phoneToSave, emailToSave, imageToSave, publicId, companyId]
        );
        return this.getManufacturerByPublicId(publicId, companyId);
    }

    static async deleteManufacturer(publicId: string, companyId: number): Promise<void> {
        await this.getManufacturerByPublicId(publicId, companyId);
        await pool.query('DELETE FROM manufacturers WHERE public_id = ? AND company_id = ?', [publicId, companyId]);
    }

    // ================== TAX RULES ==================
    static async listTaxRules(companyId: number): Promise<TaxRule[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT *, (SELECT COUNT(id) FROM products WHERE tax_rule_id = tax_rules.id) as product_count FROM tax_rules WHERE company_id = ? ORDER BY name ASC',
            [companyId]
        );
        return rows as TaxRule[];
    }

    static async getTaxRuleByPublicId(publicId: string, companyId: number): Promise<TaxRule> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM tax_rules WHERE public_id = ? AND company_id = ? LIMIT 1',
            [publicId, companyId]
        );
        if (!rows || rows.length === 0) throw new Error('TaxRule not found');
        return rows[0] as TaxRule;
    }

    static async createTaxRule(companyId: number, data: CreateTaxRuleData): Promise<TaxRule> {
        const publicId = randomUUID();
        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO tax_rules (public_id, company_id, name, csosn, icms_type, service_code, cst_icms, icms_percentage, mva_internal_percentage, mva_interstate_percentage, fecp_percentage, ipi_percentage, cst_pis, pis_percentage, cst_cofins, cofins_percentage, iss_percentage, cst_ibs, ibs_percentage, cst_cbs, cbs_percentage, cst_is, is_percentage) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [publicId, companyId, data.name, data.csosn || null, data.icms_type || 'Normal', data.service_code || null, data.cst_icms || null, data.icms_percentage || 0, data.mva_internal_percentage || 0, data.mva_interstate_percentage || 0, data.fecp_percentage || 0, data.ipi_percentage || 0, data.cst_pis || null, data.pis_percentage || 0, data.cst_cofins || null, data.cofins_percentage || 0, data.iss_percentage || 0, data.cst_ibs || null, data.ibs_percentage || 0, data.cst_cbs || null, data.cbs_percentage || 0, data.cst_is || null, data.is_percentage || 0]
        );
        if (result.affectedRows !== 1) throw new Error('Failed to create tax rule');
        return this.getTaxRuleByPublicId(publicId, companyId);
    }

    static async updateTaxRule(publicId: string, companyId: number, data: UpdateTaxRuleData): Promise<TaxRule> {
        const existing = await this.getTaxRuleByPublicId(publicId, companyId);
        const nameToSave = data.name || existing.name;
        const csosnToSave = data.csosn !== undefined ? data.csosn : existing.csosn;
        const icmsTypeToSave = data.icms_type !== undefined ? data.icms_type : existing.icms_type;
        const serviceCodeToSave = data.service_code !== undefined ? data.service_code : existing.service_code;
        const cstIcmsToSave = data.cst_icms !== undefined ? data.cst_icms : existing.cst_icms;
        const icmsToSave = data.icms_percentage !== undefined ? data.icms_percentage : existing.icms_percentage;
        const mvaIntToSave = data.mva_internal_percentage !== undefined ? data.mva_internal_percentage : existing.mva_internal_percentage;
        const mvaInterToSave = data.mva_interstate_percentage !== undefined ? data.mva_interstate_percentage : existing.mva_interstate_percentage;
        const fecpToSave = data.fecp_percentage !== undefined ? data.fecp_percentage : existing.fecp_percentage;
        const ipiToSave = data.ipi_percentage !== undefined ? data.ipi_percentage : existing.ipi_percentage;
        const cstPisToSave = data.cst_pis !== undefined ? data.cst_pis : existing.cst_pis;
        const pisToSave = data.pis_percentage !== undefined ? data.pis_percentage : existing.pis_percentage;
        const cstCofinsToSave = data.cst_cofins !== undefined ? data.cst_cofins : existing.cst_cofins;
        const cofinsToSave = data.cofins_percentage !== undefined ? data.cofins_percentage : existing.cofins_percentage;
        const issToSave = data.iss_percentage !== undefined ? data.iss_percentage : existing.iss_percentage;
        const cstIbsToSave = data.cst_ibs !== undefined ? data.cst_ibs : existing.cst_ibs;
        const ibsToSave = data.ibs_percentage !== undefined ? data.ibs_percentage : existing.ibs_percentage;
        const cstCbsToSave = data.cst_cbs !== undefined ? data.cst_cbs : existing.cst_cbs;
        const cbsToSave = data.cbs_percentage !== undefined ? data.cbs_percentage : existing.cbs_percentage;
        const cstIsToSave = data.cst_is !== undefined ? data.cst_is : existing.cst_is;
        const isToSave = data.is_percentage !== undefined ? data.is_percentage : existing.is_percentage;

        await pool.query(
            `UPDATE tax_rules SET name = ?, csosn = ?, icms_type = ?, service_code = ?, cst_icms = ?, icms_percentage = ?, mva_internal_percentage = ?, mva_interstate_percentage = ?, fecp_percentage = ?, ipi_percentage = ?, cst_pis = ?, pis_percentage = ?, cst_cofins = ?, cofins_percentage = ?, iss_percentage = ?, cst_ibs = ?, ibs_percentage = ?, cst_cbs = ?, cbs_percentage = ?, cst_is = ?, is_percentage = ? 
             WHERE public_id = ? AND company_id = ?`,
            [nameToSave, csosnToSave, icmsTypeToSave, serviceCodeToSave, cstIcmsToSave, icmsToSave, mvaIntToSave, mvaInterToSave, fecpToSave, ipiToSave, cstPisToSave, pisToSave, cstCofinsToSave, cofinsToSave, issToSave, cstIbsToSave, ibsToSave, cstCbsToSave, cbsToSave, cstIsToSave, isToSave, publicId, companyId]
        );
        return this.getTaxRuleByPublicId(publicId, companyId);
    }

    static async deleteTaxRule(publicId: string, companyId: number): Promise<void> {
        await this.getTaxRuleByPublicId(publicId, companyId);
        await pool.query('DELETE FROM tax_rules WHERE public_id = ? AND company_id = ?', [publicId, companyId]);
    }

    // ================== PRICE TABLES ==================
    static async listPriceTables(companyId: number): Promise<PriceTable[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM price_tables WHERE company_id = ? ORDER BY name ASC',
            [companyId]
        );
        return rows as PriceTable[];
    }

    static async getPriceTableByPublicId(publicId: string, companyId: number): Promise<PriceTable> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM price_tables WHERE public_id = ? AND company_id = ? LIMIT 1',
            [publicId, companyId]
        );
        if (!rows || rows.length === 0) throw new Error('PriceTable not found');
        return rows[0] as PriceTable;
    }

    static async createPriceTable(companyId: number, data: CreatePriceTableData): Promise<PriceTable> {
        const publicId = randomUUID();
        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO price_tables (public_id, company_id, name, markup_percentage, status) VALUES (?, ?, ?, ?, ?)`,
            [publicId, companyId, data.name, data.markup_percentage || 0, data.status || 'active']
        );
        if (result.affectedRows !== 1) throw new Error('Failed to create price table');
        return this.getPriceTableByPublicId(publicId, companyId);
    }

    static async updatePriceTable(publicId: string, companyId: number, data: UpdatePriceTableData): Promise<PriceTable> {
        const existing = await this.getPriceTableByPublicId(publicId, companyId);
        const nameToSave = data.name || existing.name;
        const markupToSave = data.markup_percentage !== undefined ? data.markup_percentage : existing.markup_percentage;
        const statusToSave = data.status || existing.status;

        await pool.query(
            `UPDATE price_tables SET name = ?, markup_percentage = ?, status = ? WHERE public_id = ? AND company_id = ?`,
            [nameToSave, markupToSave, statusToSave, publicId, companyId]
        );
        return this.getPriceTableByPublicId(publicId, companyId);
    }

    static async deletePriceTable(publicId: string, companyId: number): Promise<void> {
        await this.getPriceTableByPublicId(publicId, companyId);
        await pool.query('DELETE FROM price_tables WHERE public_id = ? AND company_id = ?', [publicId, companyId]);
    }

    // ================== MEASURES ==================
    static async listMeasures(companyId: number): Promise<Measure[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT *, (SELECT COUNT(id) FROM products WHERE measure_id = measures.id) as product_count FROM measures WHERE company_id = ? ORDER BY name ASC',
            [companyId]
        );
        return rows as Measure[];
    }

    static async getMeasureByPublicId(publicId: string, companyId: number): Promise<Measure> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM measures WHERE public_id = ? AND company_id = ? LIMIT 1',
            [publicId, companyId]
        );
        if (!rows || rows.length === 0) throw new Error('Measure not found');
        return rows[0] as Measure;
    }

    static async getMeasureByNameOrAbbreviation(companyId: number, value: string): Promise<Measure | null> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM measures WHERE company_id = ? AND (name = ? OR abbreviation = ?) LIMIT 1',
            [companyId, value, value]
        );
        if (!rows || rows.length === 0) return null;
        return rows[0] as Measure;
    }

    static async createMeasure(companyId: number, data: CreateMeasureData): Promise<Measure> {
        const publicId = randomUUID();
        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO measures (public_id, company_id, name, abbreviation) VALUES (?, ?, ?, ?)`,
            [publicId, companyId, data.name, data.abbreviation]
        );
        if (result.affectedRows !== 1) throw new Error('Failed to create measure');
        return this.getMeasureByPublicId(publicId, companyId);
    }

    static async updateMeasure(publicId: string, companyId: number, data: UpdateMeasureData): Promise<Measure> {
        const existing = await this.getMeasureByPublicId(publicId, companyId);
        const nameToSave = data.name || existing.name;
        const abbrevToSave = data.abbreviation || existing.abbreviation;

        await pool.query(
            `UPDATE measures SET name = ?, abbreviation = ? WHERE public_id = ? AND company_id = ?`,
            [nameToSave, abbrevToSave, publicId, companyId]
        );
        return this.getMeasureByPublicId(publicId, companyId);
    }

    static async deleteMeasure(publicId: string, companyId: number): Promise<void> {
        await this.getMeasureByPublicId(publicId, companyId);
        await pool.query('DELETE FROM measures WHERE public_id = ? AND company_id = ?', [publicId, companyId]);
    }

    // ================== SERVICE TYPES ==================
    static async listServiceTypes(companyId: number): Promise<ServiceType[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM service_types WHERE company_id = ? ORDER BY name ASC',
            [companyId]
        );
        return rows as ServiceType[];
    }

    static async getServiceTypeByPublicId(publicId: string, companyId: number): Promise<ServiceType> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM service_types WHERE public_id = ? AND company_id = ? LIMIT 1',
            [publicId, companyId]
        );
        if (!rows || rows.length === 0) throw new Error('ServiceType not found');
        return rows[0] as ServiceType;
    }

    static async createServiceType(companyId: number, data: CreateServiceTypeData): Promise<ServiceType> {
        const publicId = randomUUID();
        const [result] = await pool.query<ResultSetHeader>(
            'INSERT INTO service_types (public_id, company_id, name, description) VALUES (?, ?, ?, ?)',
            [publicId, companyId, data.name, data.description || null]
        );
        if (result.affectedRows !== 1) throw new Error('Failed to create service type');
        return this.getServiceTypeByPublicId(publicId, companyId);
    }

    static async updateServiceType(publicId: string, companyId: number, data: UpdateServiceTypeData): Promise<ServiceType> {
        const existing = await this.getServiceTypeByPublicId(publicId, companyId);
        const nameToSave = data.name || existing.name;
        const descriptionToSave = data.description !== undefined ? data.description : existing.description;

        await pool.query(
            'UPDATE service_types SET name = ?, description = ? WHERE public_id = ? AND company_id = ?',
            [nameToSave, descriptionToSave, publicId, companyId]
        );

        return this.getServiceTypeByPublicId(publicId, companyId);
    }

    static async deleteServiceType(publicId: string, companyId: number): Promise<void> {
        await this.getServiceTypeByPublicId(publicId, companyId);
        await pool.query('DELETE FROM service_types WHERE public_id = ? AND company_id = ?', [publicId, companyId]);
    }

    // ================== SERVICES ==================
    static async listServices(companyId: number): Promise<Service[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT s.*, st.public_id AS service_type_public_id, st.name AS service_type_name
             FROM services s
             LEFT JOIN service_types st
               ON st.id = s.service_type_id
              AND st.company_id = s.company_id
             WHERE s.company_id = ?
             ORDER BY s.name ASC`,
            [companyId]
        );
        return rows as Service[];
    }

    static async getServiceByPublicId(publicId: string, companyId: number): Promise<Service> {
        const [rows] = await pool.query<RowDataPacket[]>(
                        `SELECT s.*, st.public_id AS service_type_public_id, st.name AS service_type_name
                         FROM services s
                         LEFT JOIN service_types st
                             ON st.id = s.service_type_id
                            AND st.company_id = s.company_id
                         WHERE s.public_id = ?
                             AND s.company_id = ?
                         LIMIT 1`,
            [publicId, companyId]
        );
        if (!rows || rows.length === 0) throw new Error('Service not found');
        return rows[0] as Service;
    }

    static async createService(companyId: number, data: CreateServiceData): Promise<Service> {
        const publicId = randomUUID();
        const serviceTypeId = data.service_type_public_id
            ? await this.getServiceTypeInternalIdByPublicId(data.service_type_public_id, companyId)
            : null;
        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO services (
                public_id,
                company_id,
                name,
                price,
                description,
                service_type_id,
                municipal_tax_reference_id,
                municipal_tax_reference_name,
                federal_tax_reference_id,
                federal_tax_reference_name,
                national_tax_code,
                municipal_tax_code,
                nbs_item
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                publicId,
                companyId,
                data.name,
                data.price,
                data.description || null,
                serviceTypeId,
                data.municipal_tax_reference_id || null,
                data.municipal_tax_reference_name || null,
                data.federal_tax_reference_id || null,
                data.federal_tax_reference_name || null,
                data.national_tax_code || null,
                data.municipal_tax_code || null,
                data.nbs_item || null,
            ]
        );
        if (result.affectedRows !== 1) throw new Error('Failed to create service');
        return this.getServiceByPublicId(publicId, companyId);
    }

    static async updateService(publicId: string, companyId: number, data: UpdateServiceData): Promise<Service> {
        const existing = await this.getServiceByPublicId(publicId, companyId);
        const nameToSave = data.name || existing.name;
        const priceToSave = data.price !== undefined ? data.price : existing.price;
        const descriptionToSave = data.description !== undefined ? data.description : existing.description;
        const serviceTypeIdToSave = data.service_type_public_id === undefined
            ? (existing.service_type_id ?? null)
            : (data.service_type_public_id
                ? await this.getServiceTypeInternalIdByPublicId(data.service_type_public_id, companyId)
                : null);
        const municipalTaxReferenceIdToSave = data.municipal_tax_reference_id !== undefined
            ? data.municipal_tax_reference_id
            : (existing.municipal_tax_reference_id ?? null);
        const municipalTaxReferenceNameToSave = data.municipal_tax_reference_name !== undefined
            ? data.municipal_tax_reference_name
            : (existing.municipal_tax_reference_name ?? null);
        const federalTaxReferenceIdToSave = data.federal_tax_reference_id !== undefined
            ? data.federal_tax_reference_id
            : (existing.federal_tax_reference_id ?? null);
        const federalTaxReferenceNameToSave = data.federal_tax_reference_name !== undefined
            ? data.federal_tax_reference_name
            : (existing.federal_tax_reference_name ?? null);
        const nationalTaxCodeToSave = data.national_tax_code !== undefined ? data.national_tax_code : existing.national_tax_code;
        const municipalTaxCodeToSave = data.municipal_tax_code !== undefined ? data.municipal_tax_code : existing.municipal_tax_code;
        const nbsItemToSave = data.nbs_item !== undefined ? data.nbs_item : existing.nbs_item;

        await pool.query(
            `UPDATE services
             SET name = ?,
                 price = ?,
                 description = ?,
                 service_type_id = ?,
                 municipal_tax_reference_id = ?,
                 municipal_tax_reference_name = ?,
                 federal_tax_reference_id = ?,
                 federal_tax_reference_name = ?,
                 national_tax_code = ?,
                 municipal_tax_code = ?,
                 nbs_item = ?
             WHERE public_id = ? AND company_id = ?`,
            [
                nameToSave,
                priceToSave,
                descriptionToSave,
                serviceTypeIdToSave,
                municipalTaxReferenceIdToSave,
                municipalTaxReferenceNameToSave,
                federalTaxReferenceIdToSave,
                federalTaxReferenceNameToSave,
                nationalTaxCodeToSave,
                municipalTaxCodeToSave,
                nbsItemToSave,
                publicId,
                companyId,
            ]
        );

        return this.getServiceByPublicId(publicId, companyId);
    }

    static async deleteService(publicId: string, companyId: number): Promise<void> {
        await this.getServiceByPublicId(publicId, companyId);
        await pool.query('DELETE FROM services WHERE public_id = ? AND company_id = ?', [publicId, companyId]);
    }

    // ================== SERVICE LAUNCHES ==================
    static async listServiceLaunches(companyId: number): Promise<ServiceLaunch[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT sl.*, c.public_id AS customer_public_id, c.name AS customer_name,
                                        s.public_id AS service_public_id, s.name AS service_name,
                                        (
                                                SELECT t.public_id
                                                FROM transactions t
                                                WHERE t.company_id = sl.company_id
                                                    AND t.type = 'income'
                                                    AND t.description LIKE CONCAT('%[SL:', sl.public_id, ']%')
                                                ORDER BY t.created_at DESC
                                                LIMIT 1
                                        ) AS revenue_public_id,
                                        (
                                                SELECT c2.public_id
                                                FROM transactions t
                                                INNER JOIN categories c2 ON c2.id = t.category_id
                                                WHERE t.company_id = sl.company_id
                                                    AND t.type = 'income'
                                                    AND t.description LIKE CONCAT('%[SL:', sl.public_id, ']%')
                                                ORDER BY t.created_at DESC
                                                LIMIT 1
                                        ) AS revenue_category_public_id,
                                        (
                                                SELECT b2.public_id
                                                FROM transactions t
                                                INNER JOIN bank_accounts b2 ON b2.id = t.bank_account_id
                                                WHERE t.company_id = sl.company_id
                                                    AND t.type = 'income'
                                                    AND t.description LIKE CONCAT('%[SL:', sl.public_id, ']%')
                                                ORDER BY t.created_at DESC
                                                LIMIT 1
                                        ) AS revenue_bank_account_public_id,
                                        (
                                                SELECT t.date
                                                FROM transactions t
                                                WHERE t.company_id = sl.company_id
                                                    AND t.type = 'income'
                                                    AND t.description LIKE CONCAT('%[SL:', sl.public_id, ']%')
                                                ORDER BY t.created_at DESC
                                                LIMIT 1
                                        ) AS revenue_date,
                                        (
                                                SELECT t.payment_method
                                                FROM transactions t
                                                WHERE t.company_id = sl.company_id
                                                    AND t.type = 'income'
                                                    AND t.description LIKE CONCAT('%[SL:', sl.public_id, ']%')
                                                ORDER BY t.created_at DESC
                                                LIMIT 1
                                        ) AS revenue_payment_method,
                                        (
                                                SELECT t.status
                                                FROM transactions t
                                                WHERE t.company_id = sl.company_id
                                                    AND t.type = 'income'
                                                    AND t.description LIKE CONCAT('%[SL:', sl.public_id, ']%')
                                                ORDER BY t.created_at DESC
                                                LIMIT 1
                                        ) AS revenue_status
             FROM service_launches sl
             INNER JOIN customers c ON c.id = sl.customer_id AND c.company_id = sl.company_id
             INNER JOIN services s ON s.id = sl.service_id AND s.company_id = sl.company_id
             WHERE sl.company_id = ?
             ORDER BY sl.created_at DESC`,
            [companyId]
        );

        return rows.map((row) => ({
            ...(row as any),
            customer_public_id: String(row.customer_public_id),
            customer_name: String(row.customer_name || 'Cliente'),
            service_public_id: String(row.service_public_id),
            service_name: String(row.service_name || 'Serviço'),
            quantity: Number(row.quantity || 0),
            unit_price: Number(row.unit_price || 0),
            total_price: Number(row.total_price || 0),
            revenue_public_id: row.revenue_public_id ? String(row.revenue_public_id) : null,
            revenue_category_public_id: row.revenue_category_public_id ? String(row.revenue_category_public_id) : null,
            revenue_bank_account_public_id: row.revenue_bank_account_public_id ? String(row.revenue_bank_account_public_id) : null,
            revenue_date: row.revenue_date ? String(row.revenue_date) : null,
            revenue_payment_method: row.revenue_payment_method ? String(row.revenue_payment_method) : null,
            revenue_status: row.revenue_status ? String(row.revenue_status) : null,
        })) as ServiceLaunch[];
    }

    static async getServiceLaunchByPublicId(publicId: string, companyId: number): Promise<ServiceLaunch> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT sl.*, c.public_id AS customer_public_id, c.name AS customer_name,
                                        s.public_id AS service_public_id, s.name AS service_name,
                                        (
                                                SELECT t.public_id
                                                FROM transactions t
                                                WHERE t.company_id = sl.company_id
                                                    AND t.type = 'income'
                                                    AND t.description LIKE CONCAT('%[SL:', sl.public_id, ']%')
                                                ORDER BY t.created_at DESC
                                                LIMIT 1
                                        ) AS revenue_public_id,
                                        (
                                                SELECT c2.public_id
                                                FROM transactions t
                                                INNER JOIN categories c2 ON c2.id = t.category_id
                                                WHERE t.company_id = sl.company_id
                                                    AND t.type = 'income'
                                                    AND t.description LIKE CONCAT('%[SL:', sl.public_id, ']%')
                                                ORDER BY t.created_at DESC
                                                LIMIT 1
                                        ) AS revenue_category_public_id,
                                        (
                                                SELECT b2.public_id
                                                FROM transactions t
                                                INNER JOIN bank_accounts b2 ON b2.id = t.bank_account_id
                                                WHERE t.company_id = sl.company_id
                                                    AND t.type = 'income'
                                                    AND t.description LIKE CONCAT('%[SL:', sl.public_id, ']%')
                                                ORDER BY t.created_at DESC
                                                LIMIT 1
                                        ) AS revenue_bank_account_public_id,
                                        (
                                                SELECT t.date
                                                FROM transactions t
                                                WHERE t.company_id = sl.company_id
                                                    AND t.type = 'income'
                                                    AND t.description LIKE CONCAT('%[SL:', sl.public_id, ']%')
                                                ORDER BY t.created_at DESC
                                                LIMIT 1
                                        ) AS revenue_date,
                                        (
                                                SELECT t.payment_method
                                                FROM transactions t
                                                WHERE t.company_id = sl.company_id
                                                    AND t.type = 'income'
                                                    AND t.description LIKE CONCAT('%[SL:', sl.public_id, ']%')
                                                ORDER BY t.created_at DESC
                                                LIMIT 1
                                        ) AS revenue_payment_method,
                                        (
                                                SELECT t.status
                                                FROM transactions t
                                                WHERE t.company_id = sl.company_id
                                                    AND t.type = 'income'
                                                    AND t.description LIKE CONCAT('%[SL:', sl.public_id, ']%')
                                                ORDER BY t.created_at DESC
                                                LIMIT 1
                                        ) AS revenue_status
             FROM service_launches sl
             INNER JOIN customers c ON c.id = sl.customer_id AND c.company_id = sl.company_id
             INNER JOIN services s ON s.id = sl.service_id AND s.company_id = sl.company_id
             WHERE sl.public_id = ? AND sl.company_id = ?
             LIMIT 1`,
            [publicId, companyId]
        );

        const row = rows?.[0];
        if (!row) throw new Error('ServiceLaunch not found');

        return {
            ...(row as any),
            customer_public_id: String(row.customer_public_id),
            customer_name: String(row.customer_name || 'Cliente'),
            service_public_id: String(row.service_public_id),
            service_name: String(row.service_name || 'Serviço'),
            quantity: Number(row.quantity || 0),
            unit_price: Number(row.unit_price || 0),
            total_price: Number(row.total_price || 0),
            revenue_public_id: row.revenue_public_id ? String(row.revenue_public_id) : null,
            revenue_category_public_id: row.revenue_category_public_id ? String(row.revenue_category_public_id) : null,
            revenue_bank_account_public_id: row.revenue_bank_account_public_id ? String(row.revenue_bank_account_public_id) : null,
            revenue_date: row.revenue_date ? String(row.revenue_date) : null,
            revenue_payment_method: row.revenue_payment_method ? String(row.revenue_payment_method) : null,
            revenue_status: row.revenue_status ? String(row.revenue_status) : null,
        } as ServiceLaunch;
    }

    static async createServiceLaunch(companyId: number, data: CreateServiceLaunchData): Promise<ServiceLaunch> {
        const publicId = randomUUID();
        const customer = await this.getCustomerInternalByPublicId(data.customer_public_id, companyId);
        const service = await this.getServiceInternalByPublicId(data.service_public_id, companyId);
        const quantity = Number(data.quantity || 0);
        const unitPrice = Number(data.unit_price || 0);
        const totalPrice = quantity * unitPrice;

        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO service_launches (
                public_id,
                company_id,
                customer_id,
                service_id,
                quantity,
                unit_price,
                total_price,
                observation
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                publicId,
                companyId,
                customer.id,
                service.id,
                quantity,
                unitPrice,
                totalPrice,
                data.observation || null,
            ]
        );

        if (result.affectedRows !== 1) throw new Error('Failed to create service launch');
        return this.getServiceLaunchByPublicId(publicId, companyId);
    }

    static async updateServiceLaunch(publicId: string, companyId: number, data: UpdateServiceLaunchData): Promise<ServiceLaunch> {
        const existing = await this.getServiceLaunchByPublicId(publicId, companyId);

        const customerPublicIdToSave = data.customer_public_id !== undefined ? data.customer_public_id : existing.customer_public_id;
        const servicePublicIdToSave = data.service_public_id !== undefined ? data.service_public_id : existing.service_public_id;

        const customer = await this.getCustomerInternalByPublicId(customerPublicIdToSave, companyId);
        const service = await this.getServiceInternalByPublicId(servicePublicIdToSave, companyId);

        const quantityToSave = data.quantity !== undefined ? Number(data.quantity) : Number(existing.quantity);
        const unitPriceToSave = data.unit_price !== undefined ? Number(data.unit_price) : Number(existing.unit_price);
        const observationToSave = data.observation !== undefined ? data.observation : existing.observation;
        const totalPriceToSave = quantityToSave * unitPriceToSave;

        await pool.query(
            `UPDATE service_launches
             SET customer_id = ?,
                 service_id = ?,
                 quantity = ?,
                 unit_price = ?,
                 total_price = ?,
                 observation = ?
             WHERE public_id = ? AND company_id = ?`,
            [
                customer.id,
                service.id,
                quantityToSave,
                unitPriceToSave,
                totalPriceToSave,
                observationToSave || null,
                publicId,
                companyId,
            ]
        );

        return this.getServiceLaunchByPublicId(publicId, companyId);
    }

    static async deleteServiceLaunch(publicId: string, companyId: number): Promise<void> {
        const launch = await this.getServiceLaunchByPublicId(publicId, companyId);

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT t.id
             FROM transactions t
             WHERE t.company_id = ?
               AND t.type = 'income'
               AND t.status = 'paid'
               AND (
                   t.description LIKE ?
                   OR (
                       t.customer_id = ?
                       AND ABS(t.amount - ?) < 0.01
                       AND t.description = ?
                   )
               )
             LIMIT 1`,
            [
                companyId,
                `%[SL:${publicId}]%`,
                Number((launch as any).customer_id || 0),
                Number((launch as any).total_price || 0),
                `Lançamento de serviço - ${String((launch as any).service_name || 'Serviço')} - ${String((launch as any).customer_name || 'Cliente')}`,
            ]
        );

        if (rows?.[0]) {
            throw new Error('Não é permitido excluir este lançamento, a receita vinculada já foi baixada.');
        }

        await pool.query('DELETE FROM service_launches WHERE public_id = ? AND company_id = ?', [publicId, companyId]);
    }

    static async transmitServiceLaunch(
        publicId: string,
        companyId: number,
        data: {
            nfse_status: 'transmitted';
            nfse_number: string;
            nfse_verification_code: string;
            nfse_issued_at: Date;
        }
    ): Promise<ServiceLaunch> {
        await pool.query(
            `UPDATE service_launches
             SET nfse_status = ?, nfse_number = ?, nfse_verification_code = ?, nfse_issued_at = ?
             WHERE public_id = ? AND company_id = ?`,
            [data.nfse_status, data.nfse_number, data.nfse_verification_code, data.nfse_issued_at, publicId, companyId]
        );
        return this.getServiceLaunchByPublicId(publicId, companyId);
    }

    static async cancelServiceLaunch(publicId: string, companyId: number): Promise<ServiceLaunch> {
        await pool.query(
            `UPDATE service_launches
             SET nfse_status = 'cancelled', nfse_number = NULL, nfse_verification_code = NULL, nfse_issued_at = NULL
             WHERE public_id = ? AND company_id = ?`,
            [publicId, companyId]
        );
        return this.getServiceLaunchByPublicId(publicId, companyId);
    }
}