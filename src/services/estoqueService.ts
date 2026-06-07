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
import { EstoqueRepository } from '../repositories/estoqueRepository';

export class EstoqueService {
    static async getStockVisionAnalytics(companyId: number, stockTypeId?: number): Promise<any> {
        const data = await EstoqueRepository.getStockVisionAnalytics(companyId, stockTypeId);

        return {
            total_products: Number(data.totalProducts) || 0,
            total_categories: Number(data.totalCategories) || 0,
            total_stock_units: Number(data.totalStockUnits) || 0,
            total_stock_value: Number(data.totalStockValue) || 0,
            total_stock_sale_value: Number(data.totalStockSaleValue) || 0,
            low_stock: data.lowStockItems.map((item: any) => ({
                name: String(item.name || ''),
                current_stock: Number(item.current_stock) || 0,
                min_stock: Number(item.min_stock) || 0,
                measure: item.measure ? String(item.measure) : null,
            })),
            top_categories: data.topCategories.map((item: any) => ({
                name: String(item.name || 'Sem categoria'),
                product_count: Number(item.product_count) || 0,
            })),
        };
    }

    // ================== CATEGORIES ==================
    static async listCategories(companyId: number): Promise<ProductCategory[]> {
        return EstoqueRepository.listCategories(companyId);
    }

    static async getCategoryByPublicId(publicId: string, companyId: number): Promise<ProductCategory> {
        return EstoqueRepository.getCategoryByPublicId(publicId, companyId);
    }

    static async getOrCreateCategoryByName(companyId: number, name: string): Promise<ProductCategory> {
        const normalized = String(name || '').trim();
        if (!normalized) {
            throw new Error('Category name is required');
        }
        const existing = await EstoqueRepository.getCategoryByName(companyId, normalized);
        if (existing) {
            return existing;
        }
        return EstoqueRepository.createCategory(companyId, { name: normalized });
    }

    static async createCategory(companyId: number, data: CreateProductCategoryData): Promise<ProductCategory> {
        return EstoqueRepository.createCategory(companyId, data);
    }

    static async updateCategory(publicId: string, companyId: number, data: UpdateProductCategoryData): Promise<ProductCategory> {
        return EstoqueRepository.updateCategory(publicId, companyId, data);
    }

    static async deleteCategory(publicId: string, companyId: number): Promise<void> {
        return EstoqueRepository.deleteCategory(publicId, companyId);
    }

    // ================== STOCK TYPES ==================
    static async listStockTypes(companyId: number): Promise<StockType[]> {
        return EstoqueRepository.listStockTypes(companyId);
    }

    static async getStockTypeByPublicId(publicId: string, companyId: number): Promise<StockType> {
        return EstoqueRepository.getStockTypeByPublicId(publicId, companyId);
    }

    static async createStockType(companyId: number, data: CreateStockTypeData): Promise<StockType> {
        return EstoqueRepository.createStockType(companyId, data);
    }

    static async updateStockType(publicId: string, companyId: number, data: UpdateStockTypeData): Promise<StockType> {
        return EstoqueRepository.updateStockType(publicId, companyId, data);
    }

    static async deleteStockType(publicId: string, companyId: number): Promise<void> {
        return EstoqueRepository.deleteStockType(publicId, companyId);
    }

    // ================== MANUFACTURERS ==================
    static async listManufacturers(companyId: number): Promise<Manufacturer[]> {
        return EstoqueRepository.listManufacturers(companyId);
    }

    static async getManufacturerByPublicId(publicId: string, companyId: number): Promise<Manufacturer> {
        return EstoqueRepository.getManufacturerByPublicId(publicId, companyId);
    }

    static async createManufacturer(companyId: number, data: CreateManufacturerData): Promise<Manufacturer> {
        return EstoqueRepository.createManufacturer(companyId, data);
    }

    static async updateManufacturer(publicId: string, companyId: number, data: UpdateManufacturerData): Promise<Manufacturer> {
        return EstoqueRepository.updateManufacturer(publicId, companyId, data);
    }

    static async deleteManufacturer(publicId: string, companyId: number): Promise<void> {
        return EstoqueRepository.deleteManufacturer(publicId, companyId);
    }

    // ================== TAX RULES ==================
    static async listTaxRules(companyId: number): Promise<TaxRule[]> {
        return EstoqueRepository.listTaxRules(companyId);
    }

    static async getTaxRuleByPublicId(publicId: string, companyId: number): Promise<TaxRule> {
        return EstoqueRepository.getTaxRuleByPublicId(publicId, companyId);
    }

    static async createTaxRule(companyId: number, data: CreateTaxRuleData): Promise<TaxRule> {
        return EstoqueRepository.createTaxRule(companyId, data);
    }

    static async updateTaxRule(publicId: string, companyId: number, data: UpdateTaxRuleData): Promise<TaxRule> {
        return EstoqueRepository.updateTaxRule(publicId, companyId, data);
    }

    static async deleteTaxRule(publicId: string, companyId: number): Promise<void> {
        return EstoqueRepository.deleteTaxRule(publicId, companyId);
    }

    // ================== PRICE TABLES ==================
    static async listPriceTables(companyId: number): Promise<PriceTable[]> {
        return EstoqueRepository.listPriceTables(companyId);
    }

    static async getPriceTableByPublicId(publicId: string, companyId: number): Promise<PriceTable> {
        return EstoqueRepository.getPriceTableByPublicId(publicId, companyId);
    }

    static async createPriceTable(companyId: number, data: CreatePriceTableData): Promise<PriceTable> {
        return EstoqueRepository.createPriceTable(companyId, data);
    }

    static async updatePriceTable(publicId: string, companyId: number, data: UpdatePriceTableData): Promise<PriceTable> {
        return EstoqueRepository.updatePriceTable(publicId, companyId, data);
    }

    static async deletePriceTable(publicId: string, companyId: number): Promise<void> {
        return EstoqueRepository.deletePriceTable(publicId, companyId);
    }

    // ================== MEASURES ==================
    static async listMeasures(companyId: number): Promise<Measure[]> {
        return EstoqueRepository.listMeasures(companyId);
    }

    static async getMeasureByPublicId(publicId: string, companyId: number): Promise<Measure> {
        return EstoqueRepository.getMeasureByPublicId(publicId, companyId);
    }

    static async getOrCreateMeasureByValue(companyId: number, value: string): Promise<Measure> {
        const normalized = String(value || '').trim();
        if (!normalized) {
            throw new Error('Measure value is required');
        }
        const existing = await EstoqueRepository.getMeasureByNameOrAbbreviation(companyId, normalized);
        if (existing) {
            return existing;
        }
        return EstoqueRepository.createMeasure(companyId, {
            name: normalized,
            abbreviation: normalized,
        });
    }

    static async createMeasure(companyId: number, data: CreateMeasureData): Promise<Measure> {
        return EstoqueRepository.createMeasure(companyId, data);
    }

    static async updateMeasure(publicId: string, companyId: number, data: UpdateMeasureData): Promise<Measure> {
        return EstoqueRepository.updateMeasure(publicId, companyId, data);
    }

    static async deleteMeasure(publicId: string, companyId: number): Promise<void> {
        return EstoqueRepository.deleteMeasure(publicId, companyId);
    }

    // ================== SERVICE TYPES ==================
    static async listServiceTypes(companyId: number): Promise<ServiceType[]> {
        return EstoqueRepository.listServiceTypes(companyId);
    }

    static async getServiceTypeByPublicId(publicId: string, companyId: number): Promise<ServiceType> {
        return EstoqueRepository.getServiceTypeByPublicId(publicId, companyId);
    }

    static async createServiceType(companyId: number, data: CreateServiceTypeData): Promise<ServiceType> {
        return EstoqueRepository.createServiceType(companyId, data);
    }

    static async updateServiceType(publicId: string, companyId: number, data: UpdateServiceTypeData): Promise<ServiceType> {
        return EstoqueRepository.updateServiceType(publicId, companyId, data);
    }

    static async deleteServiceType(publicId: string, companyId: number): Promise<void> {
        return EstoqueRepository.deleteServiceType(publicId, companyId);
    }

    // ================== SERVICES ==================
    static async listServices(companyId: number): Promise<Service[]> {
        return EstoqueRepository.listServices(companyId);
    }

    static async getServiceByPublicId(publicId: string, companyId: number): Promise<Service> {
        return EstoqueRepository.getServiceByPublicId(publicId, companyId);
    }

    static async createService(companyId: number, data: CreateServiceData): Promise<Service> {
        return EstoqueRepository.createService(companyId, data);
    }

    static async updateService(publicId: string, companyId: number, data: UpdateServiceData): Promise<Service> {
        return EstoqueRepository.updateService(publicId, companyId, data);
    }

    static async deleteService(publicId: string, companyId: number): Promise<void> {
        return EstoqueRepository.deleteService(publicId, companyId);
    }

    // ================== SERVICE LAUNCHES ==================
    static async listServiceLaunches(companyId: number): Promise<ServiceLaunch[]> {
        return EstoqueRepository.listServiceLaunches(companyId);
    }

    static async getServiceLaunchByPublicId(publicId: string, companyId: number): Promise<ServiceLaunch> {
        return EstoqueRepository.getServiceLaunchByPublicId(publicId, companyId);
    }

    static async createServiceLaunch(companyId: number, data: CreateServiceLaunchData): Promise<ServiceLaunch> {
        return EstoqueRepository.createServiceLaunch(companyId, data);
    }

    static async updateServiceLaunch(publicId: string, companyId: number, data: UpdateServiceLaunchData): Promise<ServiceLaunch> {
        return EstoqueRepository.updateServiceLaunch(publicId, companyId, data);
    }

    static async deleteServiceLaunch(publicId: string, companyId: number): Promise<void> {
        return EstoqueRepository.deleteServiceLaunch(publicId, companyId);
    }
}
