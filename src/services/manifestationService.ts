import { DOMParser } from '@xmldom/xmldom';
import logger from '../config/logger';

export class ManifestationService {
    /**
     * Consulta documentos fiscais eletrônicos destinados ao CNPJ da empresa (DFe).
     * Utiliza o serviço NFeDistribuicaoDFe da SEFAZ.
     */
    static async consultDestinedDocs(pfxBuffer: Buffer, password: string, environment: 'homologacao' | 'producao', cnpj: string, cUFAutor: string, lastNSU: string = '0'): Promise<any> {
        const UF_IBGE: Record<string, string> = {
            'AC':'12','AL':'27','AP':'16','AM':'13','BA':'29','CE':'23','DF':'53',
            'ES':'32','GO':'52','MA':'21','MT':'51','MS':'50','MG':'31','PA':'15',
            'PB':'25','PR':'41','PE':'26','PI':'22','RJ':'33','RN':'24','RS':'43',
            'RO':'11','RR':'14','SC':'42','SP':'35','SE':'28','TO':'17'
        };
        const codigoUF = UF_IBGE[cUFAutor.toUpperCase()] || (/[0-9]{2}/.test(cUFAutor) ? cUFAutor : '35');
        const cleanCnpj = cnpj.replace(/\D/g, '');

        logger.info({ cnpj: cleanCnpj, codigoUF, lastNSU, environment }, '[Manifestation] Iniciando consulta SEFAZ');

        const soapBody = '<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">' +
            `<tpAmb>${environment === 'producao' ? '1' : '2'}</tpAmb>` +
            `<cUFAutor>${codigoUF}</cUFAutor>` +
            `<CNPJ>${cleanCnpj}</CNPJ>` +
            '<distNSU>' +
                `<ultNSU>${lastNSU.padStart(15, '0')}</ultNSU>` +
            '</distNSU>' +
        '</distDFeInt>';

        const soapEnvelope = '<?xml version="1.0" encoding="utf-8"?>' +
            '<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">' +
                '<soap12:Body>' +
                    '<nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">' +
                        '<nfeDadosMsg>' +
                            soapBody +
                        '</nfeDadosMsg>' +
                    '</nfeDistDFeInteresse>' +
                '</soap12:Body>' +
            '</soap12:Envelope>';

        const host = environment === 'producao' ? 'www1.nfe.fazenda.gov.br' : 'hom1.nfe.fazenda.gov.br';
        const path = environment === 'producao' ? '/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx' : '/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';

        const response = await this.performSefazRequest(pfxBuffer, password, host, path, soapEnvelope);
        const parsed = this.parseDistDFeResponse(response, lastNSU);
        
        logger.info({ cStat: parsed.cStat, xMotivo: parsed.xMotivo, docsCount: parsed.docs.length }, '[Manifestation] Resposta SEFAZ');
        
        return { ...parsed, _rawResponse: response };
    }

    static async sendManifestationEvent(
        pfxBuffer: Buffer, 
        password: string, 
        environment: 'homologacao' | 'producao', 
        cnpj: string, 
        cUFAutor: string,
        chNFe: string,
        tpEvento: '210200' | '210210' | '210220' | '210240',
        xJust: string = ''
    ): Promise<any> {
        // Mapa UF sigla -> código IBGE
        const UF_IBGE: Record<string, string> = {
            'AC':'12','AL':'27','AP':'16','AM':'13','BA':'29','CE':'23','DF':'53',
            'ES':'32','GO':'52','MA':'21','MT':'51','MS':'50','MG':'31','PA':'15',
            'PB':'25','PR':'41','PE':'26','PI':'22','RJ':'33','RN':'24','RS':'43',
            'RO':'11','RR':'14','SC':'42','SP':'35','SE':'28','TO':'17'
        };
        const codigoUF = UF_IBGE[cUFAutor.toUpperCase()] || '35';
        const dhEvento = new Date().toISOString().split('.')[0] + '-03:00'; // Formato esperado pela SEFAZ
        
        // XML do Evento (simplificado para manifestação que não exige assinatura complexa no body se usar mTLS em alguns estados, mas o padrão é dentro de envEvento)
        const eventXml = `<evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">` +
            `<infEvento Id="ID${tpEvento}${chNFe}01">` +
                `<cOrgao>${codigoUF}</cOrgao>` +
                `<tpAmb>${environment === 'producao' ? '1' : '2'}</tpAmb>` +
                `<CNPJ>${cnpj.replace(/\D/g, '')}</CNPJ>` +
                `<chNFe>${chNFe}</chNFe>` +
                `<dhEvento>${dhEvento}</dhEvento>` +
                `<tpEvento>${tpEvento}</tpEvento>` +
                `<nSeqEvento>1</nSeqEvento>` +
                `<verEvento>1.00</verEvento>` +
                `<detEvento versao="1.00">` +
                    `<descEvento>${this.getEventDescription(tpEvento)}</descEvento>` +
                    (xJust ? `<xJust>${xJust}</xJust>` : '') +
                `</detEvento>` +
            `</infEvento>` +
        `</evento>`;

        const soapBody = `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">` +
            `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">` +
                `<idLote>1</idLote>` +
                eventXml +
            `</envEvento>` +
        `</nfeDadosMsg>`;

        const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>` +
            `<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">` +
                `<soap12:Body>` +
                    soapBody +
                `</soap12:Body>` +
            `</soap12:Envelope>`;

        // URLs da SEFAZ Nacional para Recepção de Eventos
        const host = 'www.nfe.fazenda.gov.br';
        const path = '/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx';
        const action = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento';

        const response = await this.performSefazRequest(pfxBuffer, password, host, path, soapEnvelope, action);
        return this.parseEventResponse(response);
    }

    private static getEventDescription(tpEvento: string): string {
        switch(tpEvento) {
            case '210200': return 'Confirmacao da Operacao';
            case '210210': return 'Ciencia da Operacao';
            case '210220': return 'Desconhecimento da Operacao';
            case '210240': return 'Operacao nao Realizada';
            default: return '';
        }
    }

    private static parseEventResponse(xml: string) {
        const cleanXml = xml
            .replace(/ xmlns(:\w+)?="[^"]*"/g, '')
            .replace(/<\/?\w+:/g, (match) => match.startsWith('</') ? '</' : '<');

        const doc = new DOMParser().parseFromString(cleanXml, 'text/xml');
        const cStat = doc.getElementsByTagName('cStat')[0]?.textContent;
        const xMotivo = doc.getElementsByTagName('xMotivo')[0]?.textContent;

        return { cStat, xMotivo, _raw: xml };
    }

    private static async performSefazRequest(pfx: Buffer, pass: string, host: string, path: string, payload: string, action?: string): Promise<string> {
        const https = await import('https');
        const defaultAction = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse';
        const soapAction = action || defaultAction;

        const agent = new https.Agent({
            pfx: pfx,
            passphrase: pass,
            rejectUnauthorized: false,
            secureProtocol: 'TLSv1_2_method'
        });

        return new Promise((resolve, reject) => {
            const req = https.request({
                hostname: host,
                port: 443,
                path: path,
                method: 'POST',
                agent,
                headers: {
                    'Content-Type': `application/soap+xml; charset=utf-8; action="${soapAction}"`,
                    'Content-Length': Buffer.byteLength(payload, 'utf8')
                }
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => resolve(data));
            });
            req.on('error', reject);
            req.write(payload);
            req.end();
        });
    }

    private static parseDistDFeResponse(xml: string, lastNSU: string) {
        // Limpeza agressiva: remove namespaces e prefixos do XML para facilitar o acesso às tags
        const cleanXml = xml
            .replace(/ xmlns(:\w+)?="[^"]*"/g, '') // remove xmlns:...="..."
            .replace(/<\/?\w+:/g, (match) => match.startsWith('</') ? '</' : '<'); // remove prefixos (ex: <soap:Body> vira <Body>)

        const doc = new DOMParser().parseFromString(cleanXml, 'text/xml');
        
        const getTagContentInternal = (parent: any, tagName: string) => {
            const nodes = parent.getElementsByTagName(tagName);
            return nodes.length > 0 ? nodes[0]?.textContent : null;
        };

        const getTagNodesInternal = (parent: any, tagName: string) => {
            const nodes = parent.getElementsByTagName(tagName);
            return nodes.length > 0 ? Array.from(nodes) : [];
        };

        const cStat = getTagContentInternal(doc, 'cStat');
        const xMotivo = getTagContentInternal(doc, 'xMotivo');
        const ultNSU = getTagContentInternal(doc, 'ultNSU');
        const maxNSU = getTagContentInternal(doc, 'maxNSU');

        const docs: any[] = [];
        const docZipNodes = getTagNodesInternal(doc, 'docZip');
        
        const zlib = require('zlib');

        for (let i = 0; i < docZipNodes.length; i++) {
            const node = docZipNodes[i] as any;
            if (!node) continue;
            
            const base64 = node.textContent || '';
            const buffer = Buffer.from(base64, 'base64');
            try {
                const decompressed = zlib.gunzipSync(buffer).toString();
                const innerDoc = new DOMParser().parseFromString(decompressed, 'text/xml');
                
                const isResNFe = decompressed.includes('resNFe');
                const isProcNFe = decompressed.includes('procNFe');

                if (isResNFe) {
                    const resNFe = getTagNodesInternal(innerDoc, 'resNFe')[0] as any;
                    if (resNFe) {
                        docs.push({
                            type: 'summary',
                            chNFe: resNFe.getAttribute('chNFe') || resNFe.getAttribute('Id')?.replace('NFe', ''),
                            cnpj: resNFe.getAttribute('CNPJ') || resNFe.getAttribute('CPF'),
                            xNome: resNFe.getAttribute('xNome'),
                            vNF: resNFe.getAttribute('vNF'),
                            dhEmi: resNFe.getAttribute('dhEmi'),
                            cStat: resNFe.getAttribute('cStat'),
                            nsu: node.getAttribute('NSU') || node.getAttribute('nsu') || ultNSU,
                            xml: decompressed
                        });
                    }
                } else if (isProcNFe) {
                    const infNFe = getTagNodesInternal(innerDoc, 'infNFe')[0] as any;
                    const emit = getTagNodesInternal(innerDoc, 'emit')[0] as any;
                    const total = getTagNodesInternal(innerDoc, 'total')[0] as any;
                    const ide = getTagNodesInternal(innerDoc, 'ide')[0] as any;
                    
                    if (infNFe && emit && total) {
                        docs.push({
                            type: 'full',
                            chNFe: infNFe.getAttribute('Id')?.replace('NFe', '') || infNFe.getAttribute('id')?.replace('NFe', ''),
                            cnpj: getTagContentInternal(emit, 'CNPJ') || getTagContentInternal(emit, 'CPF'),
                            xNome: getTagContentInternal(emit, 'xNome'),
                            vNF: getTagContentInternal(total, 'vNF') || getTagContentInternal(total, 'vOrig'),
                            dhEmi: getTagContentInternal(innerDoc, 'dhEmi') || getTagContentInternal(ide || innerDoc, 'dhEmi'),
                            nsu: node.getAttribute('NSU') || node.getAttribute('nsu') || ultNSU,
                            xml: decompressed
                        });
                    }
                }
            } catch (err) {
                logger.error({ err }, 'Erro ao descompactar docZip da SEFAZ');
            }
        }

        return { 
            cStat: cStat || '', 
            xMotivo: xMotivo || (cStat ? 'Retorno da SEFAZ sem motivo' : 'Erro desconhecido na resposta'), 
            ultNSU: ultNSU || lastNSU, 
            maxNSU: maxNSU || lastNSU, 
            docs 
        };
    }
}
