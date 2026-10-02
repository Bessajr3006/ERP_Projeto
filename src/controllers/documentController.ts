import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import pool from '../config/db';
import { RowDataPacket } from 'mysql2/promise';
import logger from '../config/logger';

const UPLOADS_ROOT = path.resolve(process.cwd(), 'public', 'uploads');
const DOCUMENTS_ROOT = path.resolve(UPLOADS_ROOT, 'documents');

export class DocumentController {
    /**
     * GET /api/v1/documents/:id
     * Serve um documento de forma segura e autenticada garantindo o isolamento multi-tenant.
     */
    static async getDocument(req: Request, res: Response): Promise<void> {
        const user = req.user;
        if (!user || (!user.company_id && user.role !== 'super_admin')) {
            res.status(401).json({ status: 'error', message: 'Usuário não autenticado.' });
            return;
        }

        const rawDocId = req.params.id;
        if (!rawDocId || typeof rawDocId !== 'string') {
            res.status(400).json({ status: 'error', message: 'Identificador do documento inválido.' });
            return;
        }

        const isGeneralAdmin = Boolean(
            user.is_general_admin ||
            user.role === 'super_admin' ||
            user.role === 'superadmin' ||
            user.role === 'general_admin'
        );

        let targetCompanyId: number | null = null;
        let relativeDocPath: string | null = null;

        // 1. Tenta encontrar na tabela `documents` (por public_id, id ou file_path)
        try {
            const [docRows] = await pool.query<RowDataPacket[]>(
                `SELECT company_id, file_path FROM documents 
                 WHERE public_id = ? OR id = ? OR file_path = ? OR file_path LIKE ? LIMIT 1`,
                [rawDocId, isNaN(Number(rawDocId)) ? -1 : Number(rawDocId), rawDocId, `%${rawDocId}%`]
            );

            if (docRows && docRows.length > 0) {
                targetCompanyId = Number(docRows[0]!.company_id);
                relativeDocPath = docRows[0]!.file_path;
            }
        } catch (err) {
            logger.warn({ err }, '[DocumentController] Erro ao consultar tabela documents');
        }

        // 2. Se não encontrou na tabela `documents`, busca nas demais entidades com anexos de documentos
        if (!targetCompanyId || !relativeDocPath) {
            const searchPattern = `%${path.basename(rawDocId)}%`;

            // Companies
            const [compRows] = await pool.query<RowDataPacket[]>(
                `SELECT id AS company_id, cnpj_document_url, certificate_name, certificate_url, logo_url 
                 FROM companies 
                 WHERE cnpj_document_url LIKE ? OR certificate_name LIKE ? OR certificate_url LIKE ? OR logo_url LIKE ? 
                 LIMIT 1`,
                [searchPattern, searchPattern, searchPattern, searchPattern]
            );
            if (compRows && compRows.length > 0) {
                targetCompanyId = Number(compRows[0]!.company_id);
                relativeDocPath = compRows[0]!.cnpj_document_url || compRows[0]!.certificate_url || compRows[0]!.certificate_name || rawDocId;
            }

            // Customers
            if (!targetCompanyId) {
                const [custRows] = await pool.query<RowDataPacket[]>(
                    `SELECT company_id, cnpj_document_url, social_contract_url, certificate_url 
                     FROM customers 
                     WHERE cnpj_document_url LIKE ? OR social_contract_url LIKE ? OR certificate_url LIKE ? 
                     LIMIT 1`,
                    [searchPattern, searchPattern, searchPattern]
                );
                if (custRows && custRows.length > 0) {
                    targetCompanyId = Number(custRows[0]!.company_id);
                    relativeDocPath = custRows[0]!.cnpj_document_url || custRows[0]!.social_contract_url || custRows[0]!.certificate_url || rawDocId;
                }
            }

            // Suppliers
            if (!targetCompanyId) {
                const [suppRows] = await pool.query<RowDataPacket[]>(
                    `SELECT company_id, cnpj_document_url, social_contract_url, certificate_url 
                     FROM suppliers 
                     WHERE cnpj_document_url LIKE ? OR social_contract_url LIKE ? OR certificate_url LIKE ? 
                     LIMIT 1`,
                    [searchPattern, searchPattern, searchPattern]
                );
                if (suppRows && suppRows.length > 0) {
                    targetCompanyId = Number(suppRows[0]!.company_id);
                    relativeDocPath = suppRows[0]!.cnpj_document_url || suppRows[0]!.social_contract_url || suppRows[0]!.certificate_url || rawDocId;
                }
            }

            // Contacts
            if (!targetCompanyId) {
                const [contactRows] = await pool.query<RowDataPacket[]>(
                    `SELECT company_id, cnpj_document_url, social_contract_url, certificate_url 
                     FROM contacts 
                     WHERE cnpj_document_url LIKE ? OR social_contract_url LIKE ? OR certificate_url LIKE ? 
                     LIMIT 1`,
                    [searchPattern, searchPattern, searchPattern]
                );
                if (contactRows && contactRows.length > 0) {
                    targetCompanyId = Number(contactRows[0]!.company_id);
                    relativeDocPath = contactRows[0]!.cnpj_document_url || contactRows[0]!.social_contract_url || contactRows[0]!.certificate_url || rawDocId;
                }
            }

            // Tasks
            if (!targetCompanyId) {
                const [taskRows] = await pool.query<RowDataPacket[]>(
                    `SELECT company_id, attachments_json FROM tasks WHERE attachments_json LIKE ? LIMIT 1`,
                    [searchPattern]
                );
                if (taskRows && taskRows.length > 0) {
                    targetCompanyId = Number(taskRows[0]!.company_id);
                    relativeDocPath = rawDocId;
                }
            }
        }

        // Se ainda não achou o caminho físico, usa o rawDocId sanitizado
        if (!relativeDocPath) {
            relativeDocPath = rawDocId;
        }

        // Validação de isolamento multi-tenant (se não for admin geral)
        if (!isGeneralAdmin) {
            if (!targetCompanyId || targetCompanyId !== user.company_id) {
                logger.warn({ rawDocId, targetCompanyId, userCompanyId: user.company_id, userId: user.id }, '[DocumentController] Acesso negado a documento de outra empresa');
                res.status(403).json({
                    status: 'error',
                    message: 'Acesso não autorizado: o documento não pertence à sua empresa.'
                });
                return;
            }
        }

        // Resolução do caminho físico no disco
        let resolvedPath: string;
        const normalizedRel = relativeDocPath.replace(/\\/g, '/').replace(/^\/+/, '');
        
        if (normalizedRel.startsWith('documents/')) {
            resolvedPath = path.resolve(UPLOADS_ROOT, normalizedRel);
        } else if (normalizedRel.startsWith('uploads/documents/')) {
            resolvedPath = path.resolve(process.cwd(), 'public', normalizedRel);
        } else if (normalizedRel.startsWith('public/uploads/documents/')) {
            resolvedPath = path.resolve(process.cwd(), normalizedRel);
        } else {
            resolvedPath = path.resolve(DOCUMENTS_ROOT, normalizedRel);
        }

        // Prevenção estrita de Path Traversal
        if (!resolvedPath.startsWith(DOCUMENTS_ROOT + path.sep) && resolvedPath !== DOCUMENTS_ROOT) {
            logger.warn({ rawDocId, resolvedPath, userId: user.id, companyId: user.company_id }, '[DocumentController] Tentativa de path traversal detectada');
            res.status(403).json({ status: 'error', message: 'Acesso negado: caminho de arquivo inválido.' });
            return;
        }

        // Bloqueio rigoroso e incondicional de certificados digitais .pfx / .p12 (NUNCA baixáveis)
        const ext = path.extname(resolvedPath).toLowerCase();
        if (ext === '.pfx' || ext === '.p12') {
            logger.warn({ rawDocId, resolvedPath, userId: user.id, companyId: user.company_id }, '[DocumentController] Bloqueio de download de certificado .pfx');
            res.status(403).json({
                status: 'error',
                message: 'Certificados .pfx não podem ser baixados por esta rota por motivos de segurança.'
            });
            return;
        }

        // Verifica existência física do arquivo
        if (!fs.existsSync(resolvedPath)) {
            res.status(404).json({ status: 'error', message: 'Documento não encontrado.' });
            return;
        }

        // Headers de segurança HTTP
        res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('X-Content-Type-Options', 'nosniff');

        res.sendFile(resolvedPath, (err) => {
            if (err) {
                logger.error({ err, resolvedPath }, '[DocumentController] Erro ao enviar documento');
                if (!res.headersSent) {
                    res.status(500).json({ status: 'error', message: 'Erro ao transferir o documento.' });
                }
            }
        });
    }
}
export default DocumentController;
