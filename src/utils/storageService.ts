/**
 * StorageService — armazenamento local de arquivos (imagens, documentos).
 *
 * Escrito como uma classe com interface estável para que no futuro seja
 * possível trocar o backend de disk → S3/GCS modificando apenas este arquivo.
 *
 * Estrutura no disco:
 *   public/uploads/
 *     products/   → imagens de produtos (image_url)
 *     company-logos/ → logos de empresas
 *     documents/  → reservado (contratos, etc.)
 */

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import logger from '../config/logger';

// Raiz dos uploads — sempre relativa à raiz do projeto (onde node roda)
const UPLOADS_ROOT = path.join(process.cwd(), 'public', 'uploads');

export type StorageBucket = 'products' | 'company-logos' | 'documents' | 'Impkey';

export interface SaveResult {
    /** URL pública relativa, ex: /uploads/products/abc.jpg */
    url: string;
    /** Caminho absoluto no disco */
    absolutePath: string;
    /** Nome do arquivo gerado */
    filename: string;
}

export class StorageService {

    // ─── Inicialização ──────────────────────────────────────────────────────────

    /**
     * Garante que os diretórios de upload existam.
     * Chame uma vez no boot do servidor.
     */
    static ensureDirectories(): void {
        const buckets: StorageBucket[] = ['products', 'company-logos', 'documents', 'Impkey'];
        for (const bucket of buckets) {
            try {
                const dir = path.join(UPLOADS_ROOT, bucket);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                    logger.info({ dir }, '[Storage] Diretório criado');
                }
            } catch (err: any) {
                logger.warn({ bucket, error: err?.message }, '[Storage] Aviso ao criar diretório de uploads');
            }
        }
        try {
            const rootImpkey = path.join(process.cwd(), 'Impkey');
            if (!fs.existsSync(rootImpkey)) {
                fs.mkdirSync(rootImpkey, { recursive: true });
            }
        } catch (err: any) {
            logger.warn({ error: err?.message }, '[Storage] Aviso ao criar pasta raiz Impkey');
        }
    }

    /**
     * Salva ou move arquivos importados de XML/ZIP para a pasta Impkey da empresa.
     * @param companyId Identificador da empresa
     * @param originalFilename Nome original do arquivo
     * @param content Conteúdo em Buffer ou String
     */
    static saveToImpkey(
        companyId: number,
        originalFilename: string,
        content: Buffer | string
    ): SaveResult {
        const safeOriginal = path.basename(originalFilename).replace(/[^a-zA-Z0-9._-]/g, '_');
        const companyDir = path.join(UPLOADS_ROOT, 'Impkey', String(companyId));
        try {
            if (!fs.existsSync(companyDir)) {
                fs.mkdirSync(companyDir, { recursive: true });
            }
        } catch (_) {}

        const rootCompanyDir = path.join(process.cwd(), 'Impkey', String(companyId));
        try {
            if (!fs.existsSync(rootCompanyDir)) {
                fs.mkdirSync(rootCompanyDir, { recursive: true });
            }
        } catch (_) {}

        const filename = safeOriginal;
        const absolutePath = path.join(companyDir, filename);
        const rootAbsolutePath = path.join(rootCompanyDir, filename);
        const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;

        try {
            fs.writeFileSync(absolutePath, buffer);
            try {
                fs.writeFileSync(rootAbsolutePath, buffer);
            } catch (_) {}
            logger.info({ companyId, path: absolutePath, bytes: buffer.length }, '[Storage] Arquivo salvo na pasta Impkey');
        } catch (error) {
            logger.error({ companyId, path: absolutePath, error }, '[Storage] Erro ao salvar arquivo na pasta Impkey');
        }

        return {
            url: `/uploads/Impkey/${companyId}/${filename}`,
            absolutePath,
            filename
        };
    }

    // ─── Salvar ─────────────────────────────────────────────────────────────────

    /**
     * Salva um buffer de arquivo no bucket especificado.
     * Gera um nome de arquivo único baseado em UUID para evitar colisões.
     *
    * @param bucket   - 'products' | 'company-logos' | 'documents'
     * @param buffer   - Conteúdo do arquivo
     * @param mimeType - MIME type original (ex: 'image/jpeg')
     * @returns SaveResult com URL pública e caminho absoluto
     */
    static saveBuffer(bucket: StorageBucket, buffer: Buffer, mimeType: string, overrideExt?: string | null): SaveResult {
        const ext = overrideExt || StorageService.mimeToExt(mimeType);
        const filename = `${randomUUID()}${ext}`;
        const absolutePath = path.join(UPLOADS_ROOT, bucket, filename);

        StorageService.ensureBucketDir(bucket);
        try {
            fs.writeFileSync(absolutePath, buffer);
            logger.info({ bucket, mimeType, bytes: buffer.length, path: absolutePath }, '[Storage] Arquivo gravado');
        } catch (error) {
            logger.error({ bucket, mimeType, bytes: buffer.length, path: absolutePath, error }, '[Storage] Falha ao gravar arquivo');
            throw new Error('Falha ao gravar arquivo de upload. Verifique o volume de armazenamento.');
        }

        return {
            url: `/uploads/${bucket}/${filename}`,
            absolutePath,
            filename,
        };
    }

    /**
     * Salva um base64 string no bucket especificado.
     * Suporta data URI (data:image/jpeg;base64,...) ou base64 puro.
     *
     * @returns SaveResult ou null se o input for nulo/vazio
     */
    static saveBase64(
        bucket: StorageBucket,
        base64: string | null | undefined,
        originalFilename?: string | null
    ): SaveResult | null {
        if (!base64) return null;

        let mimeType = 'application/octet-stream';
        let data = base64;

        // Detecta data URI: "data:image/jpeg;base64,/9j/..."
        const dataUriMatch = base64.match(/^data:([^;]+);base64,(.+)$/);
        if (dataUriMatch) {
            mimeType = dataUriMatch[1] ?? 'application/octet-stream';
            data = dataUriMatch[2] ?? base64;
        } else {
            // Tenta inferir pelo prefixo do base64
            mimeType = StorageService.inferMimeFromBase64(data);
        }

        const buffer = Buffer.from(data, 'base64');
        if (buffer.length === 0) {
            logger.warn({ bucket, mimeType }, '[Storage] Upload base64 vazio');
            throw new Error('Arquivo de upload vazio ou inválido.');
        }

        const overrideExt = originalFilename ? path.extname(originalFilename) : null;
        return StorageService.saveBuffer(bucket, buffer, mimeType, overrideExt);
    }

    // ─── Deletar ────────────────────────────────────────────────────────────────

    /**
     * Remove um arquivo do disco dado sua URL relativa.
     * Garante contenção estrita dentro de public/uploads.
     *
     * @param url - URL relativa como /uploads/products/abc.jpg ou products/abc.jpg
     * @returns boolean - true se o arquivo foi excluído com sucesso, false caso contrário
     */
    static delete(url: string | null | undefined): boolean {
        if (!url) return false;

        let relativePath = url.replace(/^[/\\]+/, '');
        if (!relativePath.startsWith('uploads/') && !relativePath.startsWith('public/uploads/')) {
            relativePath = path.join('uploads', relativePath);
        }

        const absolutePath = relativePath.startsWith('public/')
            ? path.resolve(process.cwd(), relativePath)
            : path.resolve(process.cwd(), 'public', relativePath);

        const resolvedUploadsRoot = path.resolve(UPLOADS_ROOT);

        // Garante que o caminho esteja estritamente dentro do diretório de uploads (prevenção de Path Traversal)
        if (!absolutePath.startsWith(resolvedUploadsRoot + path.sep) && absolutePath !== resolvedUploadsRoot) {
            logger.warn({ url, absolutePath, resolvedUploadsRoot }, '[Storage] Tentativa de exclusão com path traversal bloqueada');
            return false;
        }

        if (fs.existsSync(absolutePath)) {
            try {
                fs.unlinkSync(absolutePath);
                return true;
            } catch (err) {
                logger.error({ err, absolutePath }, '[Storage] Erro ao excluir arquivo');
                return false;
            }
        }
        return false;
    }

    // ─── Helpers privados ───────────────────────────────────────────────────────

    private static ensureBucketDir(bucket: StorageBucket): void {
        const dir = path.join(UPLOADS_ROOT, bucket);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    private static mimeToExt(mimeType: string): string {
        const map: Record<string, string> = {
            'image/jpeg': '.jpg',
            'image/jpg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/webp': '.webp',
            'image/svg+xml': '.svg',
            'application/pdf': '.pdf',
            'application/octet-stream': '.bin',
        };
        return map[mimeType] ?? '.bin';
    }

    /**
     * Tenta inferir o MIME type pelo magic bytes do base64 decodificado.
     */
    private static inferMimeFromBase64(base64: string): string {
        try {
            const bytes = Buffer.from(base64.slice(0, 12), 'base64');
            const hex = bytes.toString('hex').toUpperCase();

            if (hex.startsWith('FFD8FF')) return 'image/jpeg';
            if (hex.startsWith('89504E47')) return 'image/png';
            if (hex.startsWith('47494638')) return 'image/gif';
            if (hex.startsWith('52494646') && hex.slice(16, 24) === '57454250') return 'image/webp';
            if (hex.startsWith('25504446')) return 'application/pdf';
        } catch {
            // ignora erro de decodificação
        }
        return 'application/octet-stream';
    }
}
