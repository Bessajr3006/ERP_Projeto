import fs from 'fs';
import path from 'path';
import forge from 'node-forge';
import { Request, Response } from 'express';
import { generateAndSignNFe } from '../services/nfeService';
import { SefazClient } from '../services/sefazClient';
import { CompanyService } from '../services/companyService';
import { OrderService } from '../services/orderService';
import logger from '../config/logger';

export const testCertificate = async (req: Request, res: Response): Promise<void> => {
    try {
        const companyId = (req as any).user?.company_id;
        if (!companyId) {
            res.status(400).json({ status: 'error', message: 'Empresa não identificada.' });
            return;
        }

        const company = await CompanyService.getById(companyId);
        if (!company?.certificate_url || !company?.certificate_password) {
            res.status(400).json({ status: 'error', message: 'Nenhum certificado instalado. Faça o upload do arquivo .pfx e informe a senha.' });
            return;
        }

        const certPath = path.join(process.cwd(), 'public', company.certificate_url);
        if (!fs.existsSync(certPath)) {
            res.status(400).json({ status: 'error', message: 'Arquivo do certificado não encontrado no servidor.' });
            return;
        }

        const pfxBuffer = fs.readFileSync(certPath);
        const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
        const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, company.certificate_password);

        const certBags: any = p12.getBags({ bagType: forge.pki.oids.certBag });
        const certBag = certBags[forge.pki.oids.certBag as string];
        if (!certBag || certBag.length === 0) {
            res.status(400).json({ status: 'error', message: 'Não foi possível extrair o certificado do arquivo PFX. Verifique o arquivo.' });
            return;
        }

        const cert = certBag[0].cert;
        const subject = cert?.subject?.getField('CN')?.value || 'Desconhecido';
        const notAfter: Date = cert?.validity?.notAfter;
        const notBefore: Date = cert?.validity?.notBefore;
        const now = new Date();

        if (notAfter && now > notAfter) {
            res.status(200).json({
                status: 'warning',
                message: `Certificado expirado em ${notAfter.toLocaleDateString('pt-BR')}.`,
                data: { subject, notBefore: notBefore?.toISOString(), notAfter: notAfter?.toISOString(), expired: true }
            });
            return;
        }

        res.status(200).json({
            status: 'success',
            message: `Certificado válido para: ${subject}`,
            data: { subject, notBefore: notBefore?.toISOString(), notAfter: notAfter?.toISOString(), expired: false }
        });
    } catch (error: any) {
        logger.error({ err: error }, '[nfeController] Erro ao testar certificado');
        res.status(400).json({
            status: 'error',
            message: `Falha ao validar o certificado: ${error.message}`
        });
    }
};

export const generateNFe = async (req: Request, res: Response): Promise<void> => {
    try {
        let { pfxBase64, password } = req.body;
        let pfxBuffer: Buffer | null = null;
        
        // If not sent via body, try retrieving from the logged user's company profile
        if (!pfxBase64 || !password) {
            const companyId = (req as any).user?.company_id;
            if (companyId) {
                const company = await CompanyService.getById(companyId);
                if (company && company.certificate_url && company.certificate_password) {
                    const certPath = path.join(process.cwd(), 'public', company.certificate_url);
                    if (fs.existsSync(certPath)) {
                        pfxBuffer = fs.readFileSync(certPath);
                        password = company.certificate_password;
                    }
                }
            }
        } else {
            pfxBuffer = Buffer.from(pfxBase64, 'base64');
        }

        if (!pfxBuffer || !password) {
            res.status(400).json({
                status: 'error',
                message: 'Certificado PFX (base64 ou arquivo) ou senha não encontrados. Instale o certificado na sua Empresa.'
            });
            return;
        }

        const companyId = (req as any).user?.company_id;
        const company = companyId ? await CompanyService.getById(companyId) : null;
        
        let order = null;
        if (req.body.orderId && companyId) {
            const salesList = await OrderService.listSales(companyId);
            order = salesList.find(s => String(s.id) === String(req.body.orderId));
        }

        // Pass mapping
        const nfeData = {
            ...req.body,
            company,
            order
        };
        
        const nfeOutput = await generateAndSignNFe(pfxBuffer, password, nfeData);

        // Dispara para a Sefaz
        const uf = company?.state || 'SP';
        // Check local config (Homologacao = 2, Producao = 1) -> maps to 'homologacao' | 'producao'
        const isProducao = (!company || company.nfe_environment === 1);
        const envName = isProducao ? 'producao' : 'homologacao';
        
        const client = new SefazClient(pfxBuffer, password, uf, envName);
        let sefazResponse;
        let sefazError;
        
        try {
            sefazResponse = await client.transmitNFe(nfeOutput.signedXml);
        } catch (sErr: any) {
            sefazError = sErr.message;
        }

        res.status(200).json({
            status: 'success',
            message: sefazError ? 'XML gerado, mas falha ao transmitir' : 'NFe gerada com sucesso e transmitida.',
            data: {
                nfeId: nfeOutput.id,
                xml: nfeOutput.signedXml,
                sefazStatus: sefazResponse?.cStat,
                sefazMotivo: sefazResponse?.xMotivo,
                sefazProtocolo: sefazResponse?.nRec,
                sefazError: sefazError
            },
            nfeId: nfeOutput.id,
            xml: nfeOutput.signedXml
        });
    } catch (error: any) {
        logger.error({ err: error, companyId: (req as any).user?.company_id, orderId: req.body.orderId }, '[nfeController] Erro ao gerar e assinar NFe');
        res.status(500).json({
            status: 'error',
            message: 'Erro ao assinar e gerar NFe',
            details: error.message
        });
    }
};
