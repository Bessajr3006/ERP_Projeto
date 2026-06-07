import * as https from 'https';
import logger from '../config/logger';
import { DOMParser } from '@xmldom/xmldom';

// Minimal definition of Endpoint URLs.
const SEFAZ_URLS: Record<string, Record<string, any>> = {
    'SP': {
        homologacao: {
            autorizacao: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx',
            host: 'homologacao.nfe.fazenda.sp.gov.br',
            path: '/ws/nfeautorizacao4.asmx'
        },
        producao: {
            autorizacao: 'https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx',
            host: 'nfe.fazenda.sp.gov.br',
            path: '/ws/nfeautorizacao4.asmx'
        }
    }
    // ... we can easily map MT, RS, PR ... here when requested
};

export class SefazClient {
    private pfxBuffer: Buffer;
    private password: string;
    private uf: string;
    private environment: 'homologacao' | 'producao';

    constructor(pfxBuffer: Buffer, password: string, uf: string, environment: 'homologacao' | 'producao') {
        this.pfxBuffer = pfxBuffer;
        this.password = password;
        this.uf = uf.toUpperCase();
        this.environment = environment;
    }

    /**
     * Builds the HTTPS Agent customized with the A1 certificate for mTLS authentication.
     */
    private getHttpsAgent(): https.Agent {
        return new https.Agent({
            pfx: this.pfxBuffer,
            passphrase: this.password,
            rejectUnauthorized: false,
            // Sefaz requires specific ciphers
            secureProtocol: 'TLSv1_2_method'
        });
    }

    /**
     * Sends the signed NFe XML to SEFAZ Authorizer endpoint.
     */
    async transmitNFe(xmlAprovado: string): Promise<any> {
        const endpoints = SEFAZ_URLS[this.uf] || SEFAZ_URLS['SP']; // Fallback to SP
        if (!endpoints) {
             throw new Error('Nenhum endpoint SEFAZ mapeado para este UF ou Fallback.');
        }
        const target = endpoints[this.environment];

        // SOAP Envelope wrapping the payload
        const soapPayload = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
    <soap12:Header>
        <nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
            <versaoDados>4.00</versaoDados>
            <cUF>35</cUF>
        </nfeCabecMsg>
    </soap12:Header>
    <soap12:Body>
        <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
            ${xmlAprovado}
        </nfeDadosMsg>
    </soap12:Body>
</soap12:Envelope>`;

        return new Promise((resolve, reject) => {
            const agent = this.getHttpsAgent();
            
            const options: https.RequestOptions = {
                hostname: target.host,
                port: 443,
                path: target.path,
                method: 'POST',
                agent,
                headers: {
                    'Content-Type': 'application/soap+xml; charset=utf-8',
                    'Content-Length': Buffer.byteLength(soapPayload, 'utf8')
                }
            };

            logger.info({ uf: this.uf, env: this.environment, path: target.path }, 'Transmitindo NFe nativa para SEFAZ...');

            const req = https.request(options, (res: any) => {
                let responseText = '';
                res.on('data', (chunk: any) => responseText += chunk);
                res.on('end', () => {
                    logger.debug({ status: res.statusCode }, 'Sefaz Respondeu HTTP');
                    
                    if (!res.statusCode || res.statusCode >= 400) {
                        return reject(new Error(`SEFAZ HTTP Error ${res.statusCode}: ${responseText}`));
                    }
                    
                    try {
                        // Extract specific return values using xmldom since it's already a dependency!
                        const doc = new DOMParser().parseFromString(responseText, 'text/xml');
                        const cStatNode = doc.getElementsByTagName('cStat')[0];
                        const xMotivoNode = doc.getElementsByTagName('xMotivo')[0];
                        const nRecNode = doc.getElementsByTagName('nRec')[0];

                        const responseData = {
                            rawResponse: responseText,
                            cStat: cStatNode ? cStatNode.textContent : null,
                            xMotivo: xMotivoNode ? xMotivoNode.textContent : null,
                            nRec: nRecNode ? nRecNode.textContent : null
                        };

                        resolve(responseData);
                    } catch (parseError) {
                        reject(new Error('Falha ao parsear retorno do XML SEFAZ: ' + String(parseError)));
                    }
                });
            });

            req.on('error', (err: any) => {
                logger.error({ err }, 'Sefaz MTLS Connection Failed');
                reject(err);
            });

            req.write(soapPayload);
            req.end();
        });
    }
}
