import { Request, Response } from 'express';
import { EstoqueService } from '../services/estoqueService';

export class EstoqueController {
    static async getStockVisionAnalytics(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const rawStockTypeId = req.query.stockTypeId;
            const parsedStockTypeId = rawStockTypeId ? Number(rawStockTypeId) : undefined;
            const stockTypeId = Number.isFinite(parsedStockTypeId) && Number(parsedStockTypeId) > 0
                ? Number(parsedStockTypeId)
                : undefined;

            const analytics = await EstoqueService.getStockVisionAnalytics(companyId, stockTypeId);
            res.status(200).json({ status: 'success', data: analytics });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    // ================== CATEGORIES ==================
    static async createCategory(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const data = req.body;
            if (!data.name) {
                res.status(400).json({ status: 'error', message: 'Name is required' });
                return;
            }

            const category = await EstoqueService.createCategory(companyId, data);
            res.status(201).json({ status: 'success', data: category });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    static async listCategories(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const categories = await EstoqueService.listCategories(companyId);
            res.status(200).json({ status: 'success', data: categories });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    static async updateCategory(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const id = req.params.id as string;
            const data = req.body;

            const category = await EstoqueService.updateCategory(id, companyId, data);
            res.status(200).json({ status: 'success', data: category });
        } catch (error: any) {
            if (error.message === 'Category not found') {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    static async deleteCategory(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const id = req.params.id as string;
            await EstoqueService.deleteCategory(id, companyId);
            res.status(200).json({ status: 'success', message: 'Category deleted' });
        } catch (error: any) {
            if (error.message === 'Category not found') {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    // ================== STOCK TYPES ==================
    static async createStockType(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const data = req.body;
            if (!data.name) {
                res.status(400).json({ status: 'error', message: 'Name is required' });
                return;
            }

            const stockType = await EstoqueService.createStockType(companyId, data);
            res.status(201).json({ status: 'success', data: stockType });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    static async listStockTypes(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const stockTypes = await EstoqueService.listStockTypes(companyId);
            res.status(200).json({ status: 'success', data: stockTypes });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    static async updateStockType(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const id = req.params.id as string;
            const data = req.body;

            const stockType = await EstoqueService.updateStockType(id, companyId, data);
            res.status(200).json({ status: 'success', data: stockType });
        } catch (error: any) {
            if (error.message === 'StockType not found') {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    static async deleteStockType(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const id = req.params.id as string;
            await EstoqueService.deleteStockType(id, companyId);
            res.status(200).json({ status: 'success', message: 'Stock type deleted' });
        } catch (error: any) {
            if (error.message === 'StockType not found') {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    // ================== MANUFACTURERS ==================
    static async createManufacturer(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const data = req.body;
            if (!data.name) {
                res.status(400).json({ status: 'error', message: 'Name is required' });
                return;
            }

            const manufacturer = await EstoqueService.createManufacturer(companyId, data);
            res.status(201).json({ status: 'success', data: manufacturer });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    static async listManufacturers(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const manufacturers = await EstoqueService.listManufacturers(companyId);
            res.status(200).json({ status: 'success', data: manufacturers });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    static async updateManufacturer(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const id = req.params.id as string;
            const data = req.body;

            const manufacturer = await EstoqueService.updateManufacturer(id, companyId, data);
            res.status(200).json({ status: 'success', data: manufacturer });
        } catch (error: any) {
            if (error.message === 'Manufacturer not found') {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    static async deleteManufacturer(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const id = req.params.id as string;
            await EstoqueService.deleteManufacturer(id, companyId);
            res.status(200).json({ status: 'success', message: 'Manufacturer deleted' });
        } catch (error: any) {
            if (error.message === 'Manufacturer not found') {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    // ================== TAX RULES ==================
    static async createTaxRule(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const data = req.body;
            if (!data.name) {
                res.status(400).json({ status: 'error', message: 'Name is required' });
                return;
            }

            const taxRule = await EstoqueService.createTaxRule(companyId, data);
            res.status(201).json({ status: 'success', data: taxRule });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    static async listTaxRules(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const taxRules = await EstoqueService.listTaxRules(companyId);
            res.status(200).json({ status: 'success', data: taxRules });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    static async updateTaxRule(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const id = req.params.id as string;
            const data = req.body;

            const taxRule = await EstoqueService.updateTaxRule(id, companyId, data);
            res.status(200).json({ status: 'success', data: taxRule });
        } catch (error: any) {
            if (error.message === 'TaxRule not found') {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    static async deleteTaxRule(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const id = req.params.id as string;
            await EstoqueService.deleteTaxRule(id, companyId);
            res.status(200).json({ status: 'success', message: 'Tax rule deleted' });
        } catch (error: any) {
            if (error.message === 'TaxRule not found') {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    // ================== PRICE TABLES ==================
    static async createPriceTable(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const data = req.body;
            if (!data.name) {
                res.status(400).json({ status: 'error', message: 'Name is required' });
                return;
            }

            const priceTable = await EstoqueService.createPriceTable(companyId, data);
            res.status(201).json({ status: 'success', data: priceTable });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    static async listPriceTables(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const priceTables = await EstoqueService.listPriceTables(companyId);
            res.status(200).json({ status: 'success', data: priceTables });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    static async updatePriceTable(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const id = req.params.id as string;
            const data = req.body;

            const priceTable = await EstoqueService.updatePriceTable(id, companyId, data);
            res.status(200).json({ status: 'success', data: priceTable });
        } catch (error: any) {
            if (error.message === 'PriceTable not found') {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    static async deletePriceTable(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const id = req.params.id as string;
            await EstoqueService.deletePriceTable(id, companyId);
            res.status(200).json({ status: 'success', message: 'Price table deleted' });
        } catch (error: any) {
            if (error.message === 'PriceTable not found') {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    // ================== MEASURES ==================
    static async createMeasure(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const data = req.body;
            if (!data.name || !data.abbreviation) {
                res.status(400).json({ status: 'error', message: 'Name and abbreviation are required' });
                return;
            }

            const measure = await EstoqueService.createMeasure(companyId, data);
            res.status(201).json({ status: 'success', data: measure });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    static async listMeasures(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const measures = await EstoqueService.listMeasures(companyId);
            res.status(200).json({ status: 'success', data: measures });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    static async updateMeasure(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const id = req.params.id as string;
            const data = req.body;

            const measure = await EstoqueService.updateMeasure(id, companyId, data);
            res.status(200).json({ status: 'success', data: measure });
        } catch (error: any) {
            if (error.message === 'Measure not found') {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    static async deleteMeasure(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const id = req.params.id as string;
            await EstoqueService.deleteMeasure(id, companyId);
            res.status(200).json({ status: 'success', message: 'Measure deleted' });
        } catch (error: any) {
            if (error.message === 'Measure not found') {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    // ================== SERVICE TYPES ==================
    static async createServiceType(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const data = req.body;
            if (!data.name) {
                res.status(400).json({ status: 'error', message: 'Name is required' });
                return;
            }

            const serviceType = await EstoqueService.createServiceType(companyId, data);
            res.status(201).json({ status: 'success', data: serviceType });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    static async listServiceTypes(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const serviceTypes = await EstoqueService.listServiceTypes(companyId);
            res.status(200).json({ status: 'success', data: serviceTypes });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    static async updateServiceType(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const id = req.params.id as string;
            const data = req.body;

            const serviceType = await EstoqueService.updateServiceType(id, companyId, data);
            res.status(200).json({ status: 'success', data: serviceType });
        } catch (error: any) {
            if (error.message === 'ServiceType not found') {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    static async deleteServiceType(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const id = req.params.id as string;
            await EstoqueService.deleteServiceType(id, companyId);
            res.status(200).json({ status: 'success', message: 'Service type deleted' });
        } catch (error: any) {
            if (error.message === 'ServiceType not found') {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    // ================== SERVICES ==================
    static async createService(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const data = req.body;
            if (!data.name) {
                res.status(400).json({ status: 'error', message: 'Name is required' });
                return;
            }
            if (data.price === undefined || data.price === null || Number(data.price) < 0) {
                res.status(400).json({ status: 'error', message: 'Valid price is required' });
                return;
            }
            if (!data.service_type_public_id || !String(data.service_type_public_id).trim()) {
                res.status(400).json({ status: 'error', message: 'Service type is required' });
                return;
            }

            const service = await EstoqueService.createService(companyId, {
                name: String(data.name).trim(),
                price: Number(data.price),
                description: data.description || null,
                service_type_public_id: String(data.service_type_public_id).trim(),
                municipal_tax_reference_id: data.municipal_tax_reference_id || null,
                municipal_tax_reference_name: data.municipal_tax_reference_name || null,
                federal_tax_reference_id: data.federal_tax_reference_id || null,
                federal_tax_reference_name: data.federal_tax_reference_name || null,
                national_tax_code: data.national_tax_code || null,
                municipal_tax_code: data.municipal_tax_code || null,
                nbs_item: data.nbs_item || null,
            });
            res.status(201).json({ status: 'success', data: service });
        } catch (error: any) {
            if (error.message === 'ServiceType not found') {
                res.status(400).json({ status: 'error', message: 'Service type not found' });
                return;
            }
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    static async listServices(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const services = await EstoqueService.listServices(companyId);
            res.status(200).json({ status: 'success', data: services });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    static async updateService(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const id = req.params.id as string;
            const data = req.body;

            if (data.price !== undefined && Number(data.price) < 0) {
                res.status(400).json({ status: 'error', message: 'Valid price is required' });
                return;
            }

            const service = await EstoqueService.updateService(id, companyId, {
                ...data,
                service_type_public_id: data.service_type_public_id === undefined
                    ? undefined
                    : (String(data.service_type_public_id).trim() || null),
                municipal_tax_reference_id: data.municipal_tax_reference_id === undefined
                    ? undefined
                    : (String(data.municipal_tax_reference_id).trim() || null),
                municipal_tax_reference_name: data.municipal_tax_reference_name === undefined
                    ? undefined
                    : (String(data.municipal_tax_reference_name).trim() || null),
                federal_tax_reference_id: data.federal_tax_reference_id === undefined
                    ? undefined
                    : (String(data.federal_tax_reference_id).trim() || null),
                federal_tax_reference_name: data.federal_tax_reference_name === undefined
                    ? undefined
                    : (String(data.federal_tax_reference_name).trim() || null),
                price: data.price !== undefined ? Number(data.price) : undefined,
            });
            res.status(200).json({ status: 'success', data: service });
        } catch (error: any) {
            if (error.message === 'Service not found') {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            if (error.message === 'ServiceType not found') {
                res.status(400).json({ status: 'error', message: 'Service type not found' });
                return;
            }
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    static async deleteService(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const id = req.params.id as string;
            await EstoqueService.deleteService(id, companyId);
            res.status(200).json({ status: 'success', message: 'Service deleted' });
        } catch (error: any) {
            if (error.message === 'Service not found') {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    // ================== SERVICE LAUNCHES ==================
    static async createServiceLaunch(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const data = req.body;

            if (!data.customer_public_id || !String(data.customer_public_id).trim()) {
                res.status(400).json({ status: 'error', message: 'Customer is required' });
                return;
            }
            if (!data.service_public_id || !String(data.service_public_id).trim()) {
                res.status(400).json({ status: 'error', message: 'Service is required' });
                return;
            }
            if (data.quantity === undefined || Number(data.quantity) <= 0) {
                res.status(400).json({ status: 'error', message: 'Valid quantity is required' });
                return;
            }
            if (data.unit_price === undefined || Number(data.unit_price) < 0) {
                res.status(400).json({ status: 'error', message: 'Valid unit price is required' });
                return;
            }

            const launch = await EstoqueService.createServiceLaunch(companyId, {
                customer_public_id: String(data.customer_public_id).trim(),
                service_public_id: String(data.service_public_id).trim(),
                quantity: Number(data.quantity),
                unit_price: Number(data.unit_price),
                observation: data.observation || null,
            });
            res.status(201).json({ status: 'success', data: launch });
        } catch (error: any) {
            if (error.message === 'Customer not found' || error.message === 'Service not found') {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    static async listServiceLaunches(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const launches = await EstoqueService.listServiceLaunches(companyId);
            res.status(200).json({ status: 'success', data: launches });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    static async updateServiceLaunch(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const id = req.params.id as string;
            const data = req.body;

            if (data.quantity !== undefined && Number(data.quantity) <= 0) {
                res.status(400).json({ status: 'error', message: 'Valid quantity is required' });
                return;
            }
            if (data.unit_price !== undefined && Number(data.unit_price) < 0) {
                res.status(400).json({ status: 'error', message: 'Valid unit price is required' });
                return;
            }

            const payload: any = {};
            if (data.customer_public_id !== undefined) payload.customer_public_id = String(data.customer_public_id).trim();
            if (data.service_public_id !== undefined) payload.service_public_id = String(data.service_public_id).trim();
            if (data.quantity !== undefined) payload.quantity = Number(data.quantity);
            if (data.unit_price !== undefined) payload.unit_price = Number(data.unit_price);
            if (data.observation !== undefined) payload.observation = data.observation || null;

            const launch = await EstoqueService.updateServiceLaunch(id, companyId, payload);
            res.status(200).json({ status: 'success', data: launch });
        } catch (error: any) {
            if (error.message === 'ServiceLaunch not found') {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            if (error.message === 'Customer not found' || error.message === 'Service not found') {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    static async deleteServiceLaunch(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const id = req.params.id as string;
            await EstoqueService.deleteServiceLaunch(id, companyId);
            res.status(200).json({ status: 'success', message: 'Service launch deleted' });
        } catch (error: any) {
            if (error.message === 'ServiceLaunch not found') {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            if (error.message === 'Não é permitido excluir este lançamento, a receita vinculada já foi baixada.') {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }
}
