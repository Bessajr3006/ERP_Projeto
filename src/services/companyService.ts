import { randomUUID } from 'crypto';
import forge from 'node-forge';
import { Company, CreateCompanyData, UpdateCompanyData, IbgeState } from '../types/Company';
import { DatabaseCompanySchema } from '../schemas/companySchemas';
import { CacheService } from './cacheService';
import { StorageService } from '../utils/storageService';
import { CompanyRepository } from '../repositories/companyRepository';
import { RoleService } from './roleService';

export class CompanyService {
    static async getIbgeStates(): Promise<IbgeState[]> {
        const cacheKey = 'ibge_states_list';
        const cached = CacheService.get<IbgeState[]>(cacheKey);
        if (cached) return cached;

        const rows = await CompanyRepository.getIbgeStates();
        
        CacheService.set(cacheKey, rows, 86400); // 24 hours of cache for completely static UI data
        return rows as IbgeState[];
    }

    static async getAllVisible(): Promise<Company[]> {
        const rows = await CompanyRepository.getAllVisible();
        return rows.map((r) => DatabaseCompanySchema.parse(r)) as Company[];
    }

    /**
     * Defines a new company
     */
    static async create(data: CreateCompanyData): Promise<Company> {
        const { trade_name, company_name, cnpj } = data;

        if (cnpj) {
            // Check if CNPJ already exists
            const existing = await CompanyRepository.getByCnpj(cnpj);
            if (existing && existing.length > 0) {
                throw new Error('CNPJ already registered');
            }
        }

        const publicId = randomUUID();

        const columns = ['public_id', 'trade_name', 'company_name', 'cnpj', 'is_active'];
        const placeholders = ['?', '?', '?', '?', 'true'];
        const values: any[] = [publicId, trade_name, company_name || null, cnpj || null];

        const extraFields = ['tax_regime', 'email', 'phone', 'zipcode', 'street', 'number', 'complement', 'neighborhood', 'city', 'state'];
        for (const field of extraFields) {
            if ((data as any)[field] !== undefined) {
                columns.push(field);
                placeholders.push('?');
                values.push((data as any)[field] || null);
            }
        }

        const insertId = await CompanyRepository.create(columns, placeholders, values);

        // Garante perfis padrão da empresa logo após o cadastro.
        await RoleService.ensureDefaultRoles(insertId);

        return this.getById(insertId);
    }

    /**
     * Retrieves a company by its internal ID
     */
    static async getById(id: number): Promise<Company> {
        const rows = await CompanyRepository.getById(id);

        if (!rows || rows.length === 0) {
            throw new Error('Company not found');
        }

        return DatabaseCompanySchema.parse(rows[0]) as Company;
    }

    /**
     * Retrieves a company by its public UUID
     */
    static async getByPublicId(publicId: string): Promise<Company> {
        const rows = await CompanyRepository.getByPublicId(publicId);

        if (!rows || rows.length === 0) {
            throw new Error('Company not found');
        }

        return DatabaseCompanySchema.parse(rows[0]) as Company;
    }

    static async getBySwaggerToken(swaggerToken: string): Promise<Company> {
        const rows = await CompanyRepository.getBySwaggerToken(swaggerToken);

        if (!rows || rows.length === 0) {
            throw new Error('Company not found');
        }

        return DatabaseCompanySchema.parse(rows[0]) as Company;
    }

    /**
     * Updates an existing company
     */
    static async update(publicId: string, data: Partial<UpdateCompanyData>): Promise<Company> {
        // First check if company exists
        const current = await this.getByPublicId(publicId);

        if (data.cnpj && data.cnpj !== current.cnpj) {
            // Check if new CNPJ already exists
            const existing = await CompanyRepository.getByCnpjExcludingPublicId(data.cnpj, publicId);
            if (existing && existing.length > 0) {
                throw new Error('CNPJ already registered by another company');
            }
        }

        const updates: string[] = [];
        const values: any[] = [];

        if (data.trade_name !== undefined) {
            updates.push('trade_name = ?');
            values.push(data.trade_name);
        }
        if (data.company_name !== undefined) {
            updates.push('company_name = ?');
            values.push(data.company_name);
        }
        if (data.cnpj !== undefined) {
            updates.push('cnpj = ?');
            values.push(data.cnpj || null);
        }
        if (data.is_active !== undefined) {
            updates.push('is_active = ?');
            values.push(data.is_active);
        }
        // Save certificate as file and store URL if base64 provided
        if (data.certificate_base64 !== undefined) {
             if (current.certificate_url) StorageService.delete(current.certificate_url);
             const saved = StorageService.saveBase64('documents', data.certificate_base64);
             if (saved) {
                 updates.push('certificate_url = ?');
                 values.push(saved.url);
             }
             // Auto-extract expiration date from the PFX when password is available
             const pfxPassword = data.certificate_password ?? (current as any).certificate_password ?? '';
             if (pfxPassword && !data.certificate_expiration) {
                 try {
                     const pfxBuf = Buffer.from(data.certificate_base64, 'base64');
                     const p12Asn1 = forge.asn1.fromDer(pfxBuf.toString('binary'));
                     const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, pfxPassword);
                     const certBags: any = p12.getBags({ bagType: forge.pki.oids.certBag });
                     const certBag = certBags[forge.pki.oids.certBag as string];
                     if (certBag && certBag.length > 0) {
                         const notAfter: Date = certBag[0].cert?.validity?.notAfter;
                         if (notAfter) {
                             data.certificate_expiration = notAfter.toISOString().split('T')[0];
                         }
                     }
                 } catch {
                     // Non-fatal: expiration stays empty if parsing fails
                 }
             }
        }

        if (data.logo_base64 !== undefined) {
            if (data.logo_base64) {
                const saved = StorageService.saveBase64('company-logos', data.logo_base64);
                if (saved) {
                    if (current.logo_url) StorageService.delete(current.logo_url);
                    updates.push('logo_url = ?');
                    values.push(saved.url);
                    updates.push('logo_filename = ?');
                    values.push(data.logo_filename || saved.filename);
                    updates.push('logo_base64 = ?');
                    values.push(data.logo_base64);
                }
            } else {
                if (current.logo_url) StorageService.delete(current.logo_url);
                updates.push('logo_url = ?');
                values.push(null);
                updates.push('logo_filename = ?');
                values.push(null);
                updates.push('logo_base64 = ?');
                values.push(null);
            }
        }

        const extraFields = ['tax_regime', 'email', 'phone', 'zipcode', 'street', 'number', 'complement', 'neighborhood', 'city', 'state', 'certificate_password', 'certificate_expiration', 'certificate_name', 'api_token', 'swagger_api_token', 'whatsapp_chat_provider', 'whatsapp_business_scope', 'solidcon_api_token', 'solidcon_url_1', 'solidcon_url_2', 'solidcon_url_3', 'solidcon_url_4', 'solidcon_url_5', 'allow_print_without_confirmation', 'ie', 'im', 'cnae_principal', 'crt', 'nfe_environment', 'nfe_series', 'nfe_number', 'nfce_series', 'nfce_number', 'csc_id', 'csc_token'];
        for (const field of extraFields) {
            if ((data as any)[field] !== undefined) {
                updates.push(`${field} = ?`);
                const fieldValue = (data as any)[field];
                values.push(typeof fieldValue === 'boolean' ? fieldValue : (fieldValue || null));
            }
        }

        if (updates.length > 0) {
            await CompanyRepository.update(publicId, updates, values);
        }

        return this.getByPublicId(publicId);
    }

    /**
     * Exclui permanentemente uma empresa e todos os seus dados.
     */
    static async delete(publicId: string): Promise<void> {
        const company = await this.getByPublicId(publicId);
        if (!company) {
            throw new Error('Empresa não encontrada.');
        }

        // Deleta em cascata
        await CompanyRepository.deleteCascading(company.id);
        
        // Limpa cache se necessário
        CacheService.invalidate('ibge_states_list');
    }
}
