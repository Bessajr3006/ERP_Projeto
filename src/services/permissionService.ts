import { PermissionRepository } from '../repositories/permissionRepository';

export class PermissionService {
    static async getByRole(companyId: number, role: string) {
        return PermissionRepository.getByRole(companyId, role);
    }

    static async updateByRole(companyId: number, role: string, permissions: { module: string, can_view: boolean }[]) {
        return PermissionRepository.updateByRole(companyId, role, permissions);
    }

    static async updateByRoleAllCompanies(role: string, permissions: { module: string, can_view: boolean }[], includeCompanyId?: number) {
        return PermissionRepository.updateByRoleAllCompanies(role, permissions, includeCompanyId);
    }
}
