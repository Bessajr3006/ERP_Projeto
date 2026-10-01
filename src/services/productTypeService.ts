import { ProductTypeRepository } from '../repositories/productTypeRepository';
import { ProductType, CreateProductTypeData, UpdateProductTypeData } from '../types/ProductType';

export class ProductTypeService {
    static async list(companyId: number): Promise<ProductType[]> {
        return ProductTypeRepository.list(companyId);
    }

    static async getByPublicId(publicId: string, companyId: number): Promise<ProductType> {
        return ProductTypeRepository.getByPublicId(publicId, companyId);
    }

    static async create(companyId: number, data: CreateProductTypeData): Promise<ProductType> {
        return ProductTypeRepository.create(companyId, data);
    }

    static async update(publicId: string, companyId: number, data: UpdateProductTypeData): Promise<ProductType> {
        return ProductTypeRepository.update(publicId, companyId, data);
    }

    static async delete(publicId: string, companyId: number): Promise<void> {
        return ProductTypeRepository.delete(publicId, companyId);
    }
}
