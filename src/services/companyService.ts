import { randomUUID } from 'crypto';
import forge from 'node-forge';
import pool from '../config/db';
import { Company, CreateCompanyData, UpdateCompanyData, IbgeState } from '../types/Company';
import { DatabaseCompanySchema } from '../schemas/companySchemas';
import { CacheService } from './cacheService';
import { StorageService } from '../utils/storageService';
import { CompanyRepository } from '../repositories/companyRepository';
import { RoleService } from './roleService';
import { encrypt, decrypt } from '../utils/crypto';
import { generateSwaggerToken, hashSwaggerToken } from '../utils/swaggerToken';

function processCompanyCnpjDocuments(data: any, currentCnpjDocumentUrl?: string | null): string | null {
    const parseCnpjDocuments = (val: any): { name: string; url: string; attachedAt?: string }[] => {
        if (!val) return [];
        let list: any[] = [];
        if (Array.isArray(val)) {
            list = val;
        } else {
            try {
                if (typeof val === 'string' && val.trim().startsWith('[')) {
                    list = JSON.parse(val);
                } else if (typeof val === 'string' && val.trim() !== '') {
                    list = [val];
                }
            } catch (e) {}
        }
        return list.map(item => {
            if (typeof item === 'string') {
                const fileName = item.substring(item.lastIndexOf('/') + 1);
                return { name: fileName, url: item, attachedAt: new Date(2026, 0, 1).toISOString() };
            }
            if (item && typeof item === 'object' && item.url) {
                return {
                    name: item.name || item.url.substring(item.url.lastIndexOf('/') + 1),
                    url: item.url,
                    attachedAt: item.attachedAt || new Date().toISOString()
                };
            }
            return null;
        }).filter(Boolean) as { name: string; url: string; attachedAt: string }[];
    };

    const targetDocs = data.cnpj_document_url !== undefined ? parseCnpjDocuments(data.cnpj_document_url) : parseCnpjDocuments(currentCnpjDocumentUrl);

    if (currentCnpjDocumentUrl && data.cnpj_document_url !== undefined) {
        const currentDocs = parseCnpjDocuments(currentCnpjDocumentUrl);
        const targetUrls = new Set(targetDocs.map(d => d.url));
        for (const doc of currentDocs) {
            if (!targetUrls.has(doc.url)) {
                StorageService.delete(doc.url);
            }
        }
    }

    if (data.cnpj_document_uploads && Array.isArray(data.cnpj_document_uploads)) {
        for (const upload of data.cnpj_document_uploads) {
            if (upload && upload.base64) {
                const saved = StorageService.saveBase64('documents', upload.base64, upload.filename);
                if (saved) {
                    const displayName = upload.name || saved.filename || saved.url.substring(saved.url.lastIndexOf('/') + 1);
                    targetDocs.push({
                        name: displayName,
                        url: saved.url,
                        attachedAt: upload.attachedAt || new Date().toISOString()
                    });
                }
            }
        }
    }

    return targetDocs.length > 0 ? JSON.stringify(targetDocs) : null;
}

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

    static async getAllInGroup(groupId: number): Promise<Company[]> {
        const rows = await CompanyRepository.getAllInGroup(groupId);
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

        if (data.is_general_admin) {
            await pool.query('UPDATE companies SET is_general_admin = 0');
        }

        let groupId: number | null = null;
        if ((data as any).company_group_public_id !== undefined) {
            if ((data as any).company_group_public_id) {
                const [groups] = await pool.query<any[]>(
                    'SELECT id FROM company_groups WHERE public_id = ? LIMIT 1',
                    [(data as any).company_group_public_id]
                );
                groupId = groups[0]?.id || null;
            }
            (data as any).company_group_id = groupId;
        } else if ((data as any).company_group_id !== undefined) {
            groupId = (data as any).company_group_id;
        }

        if (data.is_group_master) {
            if (groupId) {
                await pool.query('UPDATE companies SET is_group_master = 0 WHERE company_group_id = ?', [groupId]);
            } else {
                (data as any).is_group_master = false;
            }
        }

        const extraFields = ['tax_regime', 'email', 'phone', 'zipcode', 'street', 'number', 'complement', 'neighborhood', 'city', 'state', 'is_general_admin', 'is_group_master', 'company_group_id'];
        for (const field of extraFields) {
            if ((data as any)[field] !== undefined) {
                columns.push(field);
                placeholders.push('?');
                const val = (data as any)[field];
                values.push(typeof val === 'boolean' ? val : (val || null));
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
             const rawCurrentCertPass = (current as any).certificate_password ? decrypt((current as any).certificate_password) : '';
             const pfxPassword = data.certificate_password ?? rawCurrentCertPass ?? '';
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

        const typedData = data as Record<string, unknown>;
        if (typedData.cnpj_document_url !== undefined || typedData.cnpj_document_uploads !== undefined) {
            const newCnpjDocUrl = processCompanyCnpjDocuments(typedData, current.cnpj_document_url);
            typedData.cnpj_document_url = newCnpjDocUrl;
        }

        if (data.is_general_admin) {
            await pool.query('UPDATE companies SET is_general_admin = 0');
        }

        let effectiveGroupId = current.company_group_id;
        if ((data as any).company_group_public_id !== undefined) {
            let groupId = null;
            if ((data as any).company_group_public_id) {
                const [groups] = await pool.query<any[]>(
                    'SELECT id FROM company_groups WHERE public_id = ? LIMIT 1',
                    [(data as any).company_group_public_id]
                );
                groupId = groups[0]?.id || null;
            }
            (data as any).company_group_id = groupId;
            effectiveGroupId = groupId;
        } else if ((data as any).company_group_id !== undefined) {
            effectiveGroupId = (data as any).company_group_id;
        }

        if (data.is_group_master !== undefined) {
            if (data.is_group_master && effectiveGroupId) {
                await pool.query('UPDATE companies SET is_group_master = 0 WHERE company_group_id = ? AND id != ?', [effectiveGroupId, current.id]);
            } else if (!effectiveGroupId) {
                (data as any).is_group_master = 0;
            }
        }

        if ((data as any).default_customer_group_public_id !== undefined) {
            const EntityRepository = (await import('../repositories/entityRepository')).EntityRepository;
            const groupId = await EntityRepository.resolveCustomerGroupId(current.id, (data as any).default_customer_group_public_id);
            (data as any).default_customer_group_id = groupId;
        }

        if ((data as any).default_bank_account_public_id !== undefined) {
            let bankId = null;
            if ((data as any).default_bank_account_public_id) {
                const [banks] = await pool.query<any[]>(
                    'SELECT id FROM bank_accounts WHERE public_id = ? AND company_id = ? LIMIT 1',
                    [(data as any).default_bank_account_public_id, current.id]
                );
                bankId = banks[0]?.id || null;
            }
            (data as any).default_bank_account_id = bankId;
        }

        if ((data as any).default_receivable_type_public_id !== undefined) {
            let receivableId = null;
            if ((data as any).default_receivable_type_public_id) {
                const [receivables] = await pool.query<any[]>(
                    'SELECT id FROM receivable_types WHERE public_id = ? AND company_id = ? LIMIT 1',
                    [(data as any).default_receivable_type_public_id, current.id]
                );
                receivableId = receivables[0]?.id || null;
            }
            (data as any).default_receivable_type_id = receivableId;
        }

        if ((data as any).auto_generate_billets !== undefined) {
            const val = (data as any).auto_generate_billets;
            (data as any).auto_generate_billets = (val === true || val === 1 || val === 'true' || val === '1') ? 1 : 0;
        }

        if ((data as any).auto_send_boleto_whatsapp !== undefined) {
            const val = (data as any).auto_send_boleto_whatsapp;
            (data as any).auto_send_boleto_whatsapp = (val === true || val === 1 || val === 'true' || val === '1') ? 1 : 0;
        }

        if ((data as any).whatsapp_allow_all_users_active_sender !== undefined) {
            const val = (data as any).whatsapp_allow_all_users_active_sender;
            (data as any).whatsapp_allow_all_users_active_sender = (val === true || val === 1 || val === 'true' || val === '1') ? 1 : 0;
        }

        const sensitiveEncryptedFields = ['certificate_password', 'senha_solidcon', 'senha_dorsal', 'senha_alterdata'];
        const extraFields = ['tax_regime', 'email', 'phone', 'zipcode', 'street', 'number', 'complement', 'neighborhood', 'city', 'state', 'certificate_password', 'certificate_expiration', 'certificate_name', 'api_token', 'swagger_api_token', 'whatsapp_chat_provider', 'whatsapp_business_scope', 'solidcon_api_token', 'solidcon_url_1', 'solidcon_url_2', 'solidcon_url_3', 'solidcon_url_4', 'solidcon_url_5', 'solidcon_customer_cpf', 'solidcon_customer_name', 'serv_solidcon', 'bd_solidcon', 'login_solidcon', 'senha_solidcon', 'serv_dorsal', 'bd_dorsal', 'login_dorsal', 'senha_dorsal', 'show_solidcon', 'serv_alterdata', 'bd_alterdata', 'login_alterdata', 'senha_alterdata', 'porta_alterdata', 'cdempresa_alterdata', 'show_alterdata', 'cdfilial', 'cdpdv', 'allow_print_without_confirmation', 'show_new_measure_button', 'ie', 'im', 'cnae_principal', 'crt', 'nfe_environment', 'nfe_series', 'nfe_number', 'nfce_series', 'nfce_number', 'csc_id', 'csc_token', 'is_general_admin', 'is_group_master', 'cnpj_document_url', 'default_customer_group_id', 'default_bank_account_id', 'default_receivable_type_id', 'auto_generate_billets', 'auto_generate_billets_time', 'auto_send_boleto_whatsapp', 'boleto_send_time', 'boleto_send_whatsapp_number', 'boleto_send_whatsapp_name', 'whatsapp_allow_all_users_active_sender', 'company_group_id'];
        for (const field of extraFields) {
            if ((data as any)[field] !== undefined) {
                updates.push(`${field} = ?`);
                let fieldValue = (data as any)[field];
                if (fieldValue === '') {
                    fieldValue = null;
                } else if (fieldValue && sensitiveEncryptedFields.includes(field)) {
                    fieldValue = encrypt(String(fieldValue));
                } else if (fieldValue && field === 'swagger_api_token') {
                    fieldValue = hashSwaggerToken(String(fieldValue));
                }
                values.push(fieldValue ?? null);
            }
        }

        if (updates.length > 0) {
            await CompanyRepository.update(publicId, updates, values);
        }

        if (typedData.cnpj_document_url !== undefined) {
            try {
                const targetCnpj = (data as any).cnpj || current.cnpj;
                if (targetCnpj) {
                    const cleanCnpj = String(targetCnpj).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                    await pool.query(
                        `UPDATE customers SET cnpj_document_url = ? 
                         WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj_cpf, '.', ''), '-', ''), '/', ''), ' ', '') = ?
                           AND company_id IN (SELECT id FROM companies WHERE is_general_admin = 1)`,
                        [typedData.cnpj_document_url, cleanCnpj]
                    );
                }
            } catch (err) {
                console.error('[CompanyService.update] Error syncing cnpj_document_url to customer:', err);
            }
        }

        return this.getByPublicId(publicId);
    }

    /**
     * Regenera o token Swagger de uma empresa (retorna a versão em texto puro apenas uma vez).
     */
    static async regenerateSwaggerToken(publicId: string): Promise<{ rawToken: string }> {
        const company = await this.getByPublicId(publicId);
        if (!company) throw new Error('Company not found');

        const { rawToken, tokenHash } = generateSwaggerToken();
        await pool.query(
            'UPDATE companies SET swagger_api_token = ? WHERE id = ?',
            [tokenHash, company.id]
        );

        return { rawToken };
    }

    /**
     * Revoga o token Swagger de uma empresa.
     */
    static async revokeSwaggerToken(publicId: string): Promise<boolean> {
        const company = await this.getByPublicId(publicId);
        if (!company) throw new Error('Company not found');

        await pool.query(
            'UPDATE companies SET swagger_api_token = NULL WHERE id = ?',
            [company.id]
        );

        return true;
    }

    /**
     * Obtém as credenciais do certificado digital A1 da empresa com a senha já descriptografada.
     */
    static async getCertificateCredentials(companyId: number): Promise<{ pfxPath: string; password: string } | null> {
        const company = await this.getById(companyId);
        if (!company || !company.certificate_url || !company.certificate_password) {
            return null;
        }

        const fs = await import('fs');
        const path = await import('path');

        const cleanUrl = company.certificate_url.startsWith('/') ? company.certificate_url.slice(1) : company.certificate_url;
        let pfxPath = path.join(process.cwd(), 'public', cleanUrl);
        if (!fs.existsSync(pfxPath)) {
            pfxPath = path.join(process.cwd(), cleanUrl);
        }

        if (!fs.existsSync(pfxPath)) {
            return null;
        }

        const decryptedPassword = decrypt(company.certificate_password) || company.certificate_password;

        return {
            pfxPath,
            password: decryptedPassword
        };
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
