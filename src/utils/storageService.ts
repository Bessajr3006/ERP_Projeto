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

export type StorageBucket = 'products' | 'company-logos' | 'documents';

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
        const buckets: StorageBucket[] = ['products', 'company-logos', 'documents'];
        for (const bucket of buckets) {
            const dir = path.join(UPLOADS_ROOT, bucket);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                logger.info({ dir }, '[Storage] Diretório criado');
            }
        }
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
    static saveBuffer(bucket: StorageBucket, buffer: Buffer, mimeType: string): SaveResult {
        const ext = StorageService.mimeToExt(mimeType);
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
        base64: string | null | undefined
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

        return StorageService.saveBuffer(bucket, buffer, mimeType);
    }

    // ─── Deletar ────────────────────────────────────────────────────────────────

    /**
     * Remove um arquivo do disco dado sua URL relativa.
     * Falha silenciosa se o arquivo não existir (idempotente).
     *
     * @param url - URL relativa como /uploads/products/abc.jpg
     */
    static delete(url: string | null | undefined): void {
        if (!url) return;

        // Constrói o caminho absoluto a partir da URL relativa
        // Ex: /uploads/products/abc.jpg → public/uploads/products/abc.jpg
        const relativePath = url.startsWith('/') ? url.slice(1) : url;
        const absolutePath = path.join(process.cwd(), 'public', relativePath);

        if (fs.existsSync(absolutePath)) {
            fs.unlinkSync(absolutePath);
        }
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
