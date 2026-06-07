import { PurchaseOrder, CreatePurchaseData } from '../types/Order';
import { PurchaseRepository } from '../repositories/purchaseRepository';

export class PurchaseService {
    static async getRecentPurchases(companyId: number, limit: number = 50): Promise<any[]> {
        return PurchaseRepository.getRecentPurchases(companyId, limit);
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
}
