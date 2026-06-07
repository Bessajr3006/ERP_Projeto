import { CacheService } from './cacheService';
import { RoleRepository } from '../repositories/roleRepository';

export class RoleService {
    static async ensureDefaultRoles(companyId: number): Promise<void> {
        await RoleRepository.ensureDefaultRoles(companyId);
        CacheService.invalidate(`roles_list_${companyId}`);
    }

    static async getAllByCompany(companyId: number) {
        const cacheKey = `roles_list_${companyId}`;
        const cached = CacheService.get<any[]>(cacheKey);
        if (cached) return cached;

        const rows = await RoleRepository.getAllByCompany(companyId);

        CacheService.set(cacheKey, rows, 300); // Cache for 5 minutes
        return rows;
    }

    static async getBySlug(companyId: number, slug: string) {
        return RoleRepository.getBySlug(companyId, slug);
    }

    static async create(companyId: number, data: { name: string; slug: string; description?: string }) {
        const result = await RoleRepository.create(companyId, data);
        CacheService.invalidate(`roles_list_${companyId}`);
        return result;
    }

    static async update(companyId: number, slug: string, data: { name: string; description?: string }) {
        const result = await RoleRepository.update(companyId, slug, data);
        if (result) CacheService.invalidate(`roles_list_${companyId}`);
        return result;
    }

    static async delete(companyId: number, slug: string) {
        // Soft delete
        const result = await RoleRepository.delete(companyId, slug);
        if (result) CacheService.invalidate(`roles_list_${companyId}`);
        return result;
    }
}
