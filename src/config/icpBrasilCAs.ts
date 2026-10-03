import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as tls from 'tls';
import logger from './logger';

let cachedIcpCAs: string[] | null = null;
let cachedCombinedCAs: string[] | null = null;

/**
 * Procura o diretório de certificados ICP-Brasil
 */
function resolveCertsDir(): string {
    if (process.env.ICP_BRASIL_CERTS_DIR && fs.existsSync(process.env.ICP_BRASIL_CERTS_DIR)) {
        return process.env.ICP_BRASIL_CERTS_DIR;
    }
    const cwdDir = path.resolve(process.cwd(), 'certs/icp-brasil');
    if (fs.existsSync(cwdDir)) {
        return cwdDir;
    }
    const relativeDir = path.resolve(__dirname, '../../certs/icp-brasil');
    if (fs.existsSync(relativeDir)) {
        return relativeDir;
    }
    return cwdDir;
}

/**
 * Carrega e valida todos os certificados (.crt, .pem) da pasta certs/icp-brasil/.
 */
export function loadIcpBrasilCertificates(forceReload: boolean = false): string[] {
    if (cachedIcpCAs !== null && !forceReload) {
        return cachedIcpCAs;
    }

    const certsDir = resolveCertsDir();
    const loadedCAs: string[] = [];

    if (!fs.existsSync(certsDir)) {
        logger.error(
            { certsDir },
            'Diretório certs/icp-brasil/ não encontrado. Nenhum certificado ICP-Brasil carregado. Baixe as ACs oficiais em: https://www.gov.br/iti/pt-br/assuntos/repositorio'
        );
        cachedIcpCAs = [];
        return cachedIcpCAs;
    }

    try {
        const files = fs.readdirSync(certsDir);
        const certFiles = files.filter(f => f.endsWith('.crt') || f.endsWith('.pem'));

        for (const file of certFiles) {
            const fullPath = path.join(certsDir, file);
            try {
                const buffer = fs.readFileSync(fullPath);
                // Valida o certificado usando a API nativa do Node crypto.X509Certificate
                const x509 = new crypto.X509Certificate(buffer);
                loadedCAs.push(x509.toString());
            } catch (certErr) {
                logger.error(
                    { file, err: certErr instanceof Error ? certErr.message : String(certErr) },
                    'Falha ao validar certificado X.509 em certs/icp-brasil/'
                );
            }
        }

        if (loadedCAs.length === 0) {
            logger.error(
                { certsDir, totalFilesFound: certFiles.length },
                'A pasta certs/icp-brasil/ está vazia ou não contém certificados válidos (.crt/.pem). Baixe as ACs Raiz e intermediárias da SEFAZ em: https://www.gov.br/iti/pt-br/assuntos/repositorio'
            );
        } else {
            logger.info(
                { certsDir, count: loadedCAs.length },
                'Certificados ICP-Brasil carregados e validados com sucesso'
            );
        }
    } catch (readErr) {
        logger.error(
            { certsDir, err: readErr instanceof Error ? readErr.message : String(readErr) },
            'Erro ao ler diretório de certificados ICP-Brasil'
        );
    }

    cachedIcpCAs = loadedCAs;
    cachedCombinedCAs = null;
    return cachedIcpCAs;
}

/**
 * Retorna a cadeia completa de autoridades certificadoras (CAs nativas do Node.js + CAs ICP-Brasil carregadas em runtime).
 */
export function getIcpBrasilCAs(): string[] {
    if (cachedCombinedCAs !== null) {
        return cachedCombinedCAs;
    }
    const defaultRoots = tls.rootCertificates || [];
    const icpCAs = loadIcpBrasilCertificates();
    cachedCombinedCAs = [...defaultRoots, ...icpCAs];
    return cachedCombinedCAs;
}
