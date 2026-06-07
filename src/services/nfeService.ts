import forge from 'node-forge';
import { SignedXml } from 'xml-crypto';
import logger from '../config/logger';
import { toBrazilIsoDateTime, toBrazilYearMonth } from '../utils/dateTime';

/**
 * Parses a PFX/P12 certificate file and extracts the private key and certificate in PEM format.
 */
function extractFromPfx(pfxBuffer: Buffer, password: string) {
    const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);
    
    let privateKeyPem: string | null = null;
    let certPem: string | null = null;

    // Get the bags
    const bags: any = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const keyBag = bags[forge.pki.oids.pkcs8ShroudedKeyBag as string];
    if (keyBag && keyBag.length > 0) {
        const privateKey = keyBag[0].key;
        if (privateKey) {
            privateKeyPem = forge.pki.privateKeyToPem(privateKey);
        }
    }

    const certBags: any = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certBag = certBags[forge.pki.oids.certBag as string];
    if (certBag && certBag.length > 0) {
        const cert = certBag[0].cert;
        if (cert) {
            certPem = forge.pki.certificateToPem(cert);
            // Removing the header, footer, and newlines for XML-Crypto compatibility inside the custom key info provider
            certPem = certPem
                .replace('-----BEGIN CERTIFICATE-----', '')
                .replace('-----END CERTIFICATE-----', '')
                .replace(/\r?\n|\r/g, '');
        }
    }

    if (!privateKeyPem || !certPem) {
        throw new Error('Falha ao extrair chave privada ou certificado do arquivo PFX.');
    }

    return { privateKeyPem, certPem };
}

/** Map of Brazilian UF abbreviations to their IBGE numeric codes (cUF). */
const UF_CODES: Record<string, string> = {
    AC: '12', AL: '27', AP: '16', AM: '13', BA: '29', CE: '23', DF: '53',
    ES: '32', GO: '52', MA: '21', MT: '51', MS: '50', MG: '31', PA: '15',
    PB: '25', PR: '41', PE: '26', PI: '22', RJ: '33', RN: '24', RS: '43',
    RO: '11', RR: '14', SC: '42', SP: '35', SE: '28', TO: '17',
};

/**
 * Generates a random 8-digit numeric code (cNF) that composes part of the NFe access key.
 * Must be non-zero to avoid issues.
 */
function generateCNF(): string {
    const n = Math.floor(Math.random() * 89_999_999) + 10_000_000; // 10000000–99999999
    return String(n);
}

/**
 * Calculates the check digit (cDV) for an NFe/NFC-e 44-digit access key
 * using the Módulo 11 algorithm defined by SEFAZ.
 * @param key The first 43 digits of the access key (without cDV).
 * @returns A single digit (0–9).
 */
function calculateNFeDV(key: string): number {
    let sum = 0;
    let weight = 2;
    for (let i = key.length - 1; i >= 0; i--) {
        sum += Number(key.charAt(i)) * weight;
        weight = weight === 9 ? 2 : weight + 1;
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
}

/**
 * Creates a generic KeyInfoProvider required by xml-crypto to embed the X509 certificate within the `<Signature>` node.
 */
class MyKeyInfo {
    private certificatePem: string;

    constructor(certificatePem: string) {
        this.certificatePem = certificatePem;
    }

    getKeyInfo(_key?: any, prefix?: string) {
        const prefixStr = prefix ? `${prefix}:` : '';
        return `<${prefixStr}X509Data><${prefixStr}X509Certificate>${this.certificatePem}</${prefixStr}X509Certificate></${prefixStr}X509Data>`;
    }

    getKey(_keyInfo?: any) {
        // Only used for validation, since this class is mainly to inject the cert, we just return the cert string.
        return this.certificatePem;
    }
}

/**
 * Generates an NFe compliant XML structure and signs it using SEFAZ standards
 * @param pfxBuffer PFX binary buffer
 * @param password PFX password
 * @param nfeData Input data object mapped for NFe
 * @returns Object with the signed XML and generating details
 */
export const generateAndSignNFe = async (pfxBuffer: Buffer, password: string, nfeData: any) => {
    // Basic demonstration of logic to satisfy linters and allow using nfeData
    logger.debug({ elementCount: Object.keys(nfeData || {}).length }, 'Buscando dados recebidos para emissão');
    // 1. Extract Key and Cert
    const { privateKeyPem, certPem } = extractFromPfx(pfxBuffer, password);

    // 2. Map real data
    const cp = nfeData.company || {};
    const ord = nfeData.order || {};
    const emitCNPJ = (cp.cnpj || '12345678000199').replace(/\D/g, '');
    const emitName = cp.company_name || cp.trade_name || 'MINHA EMPRESA LIMITADA';
    
    const nfType = (nfeData && nfeData.nfType) ? nfeData.nfType : '55';

    // ── Chave de Acesso (44 dígitos) ──────────────────────────────────────────
    // cUF: código IBGE da UF do emitente (2 dígitos)
    const uf = (cp.state || 'SP').toUpperCase().trim();
    const cUF = UF_CODES[uf] ?? '35';

    // AAMM: ano e mês de emissão (4 dígitos)
    const emissionDate = ord.nfe_emitted_at ? new Date(ord.nfe_emitted_at) : (ord.created_at || new Date());
    const aamm = toBrazilYearMonth(emissionDate).replace('-', '').slice(2);

    // emitCNPJ já sanitizado (14 dígitos)
    const cnpjPadded = emitCNPJ.replace(/\D/g, '').padStart(14, '0').slice(0, 14);

    // mod: modelo do documento (55 = NF-e, 65 = NFC-e)
    const mod = nfType.padStart(2, '0').slice(0, 2);

    // serie: série do documento (3 dígitos); usa config da empresa ou padrão 001
    const serieObj = nfType === '65' ? (cp.nfce_series || 1) : (cp.nfe_series || 1);
    const serie = String(serieObj).padStart(3, '0').slice(0, 3);

    // nNF: número do documento fiscal (9 dígitos)
    // Se estivesse no fluxo real de emissão incremental, deveria registrar no banco CP.nfe_number++
    const nNFObj = nfType === '65' ? (cp.nfce_number || 1) : (cp.nfe_number || 1);
    const nNF = String(nNFObj).padStart(9, '0').slice(0, 9);

    // tpEmis: forma de emissão (1 = emissão normal)
    const tpEmis = '1';
    
    const tpAmb = cp.nfe_environment === 1 ? '1' : '2';

    // cNF: código numérico aleatório de 8 dígitos (integra a chave e é verificado pelo cDV)
    const cNF = generateCNF();

    // Concatena os 43 primeiros dígitos para calcular o cDV
    const keyBase43 = `${cUF}${aamm}${cnpjPadded}${mod}${serie}${nNF}${tpEmis}${cNF}`;
    if (keyBase43.length !== 43) {
        throw new Error(`Chave base da NF-e tem ${keyBase43.length} dígitos; esperado 43. Verifique CNPJ, série e número.`);
    }

    // cDV: dígito verificador calculado pelo Módulo 11
    const cDV = calculateNFeDV(keyBase43);

    // Chave completa de 44 dígitos (usada como Id XML com prefixo "NFe")
    const nfeId = `NFe${keyBase43}${cDV}`;
    
    // Items
    let detXml = '';
    let totalProd = 0;
    const items = ord.items || [];
    if (items.length === 0) {
        detXml = `
            <det nItem="1">
                <prod>
                    <cProd>001</cProd>
                    <cEAN>SEM GTIN</cEAN>
                    <xProd>PRODUTO DE TESTE</xProd>
                    <NCM>99999999</NCM>
                    <CFOP>5102</CFOP>
                    <uCom>UN</uCom>
                    <qCom>1.0000</qCom>
                    <vUnCom>10.0000000000</vUnCom>
                    <vProd>10.00</vProd>
                    <cEANTrib>SEM GTIN</cEANTrib>
                    <uTrib>UN</uTrib>
                    <qTrib>1.0000</qTrib>
                    <vUnTrib>10.0000000000</vUnTrib>
                    <indTot>1</indTot>
                </prod>
                <imposto>
                    <ICMS><ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102></ICMS>
                    <PIS><PISOutr><CST>99</CST><vBC>0.00</vBC><pPIS>0.0000</pPIS><vPIS>0.00</vPIS></PISOutr></PIS>
                    <COFINS><COFINSOutr><CST>99</CST><vBC>0.00</vBC><pCOFINS>0.0000</pCOFINS><vCOFINS>0.00</vCOFINS></COFINSOutr></COFINS>
                </imposto>
            </det>`;
        totalProd = 10.00;
    } else {
        items.forEach((item: any, idx: number) => {
            const qty = parseFloat(item.quantity) || 1;
            const price = parseFloat(item.unit_price) || 0;
            const vProd = (parseFloat(item.total_price) || (qty * price)).toFixed(2);
            totalProd += parseFloat(vProd);
            
            detXml += `
            <det nItem="${idx + 1}">
                <prod>
                    <cProd>${item.sku || item.product_id || '001'}</cProd>
                    <cEAN>${item.ean || 'SEM GTIN'}</cEAN>
                    <xProd>${item.product_name || 'PRODUTO'}</xProd>
                    <NCM>${item.ncm || '99999999'}</NCM>
                    <CFOP>${item.cfop || '5102'}</CFOP>
                    <uCom>UN</uCom>
                    <qCom>${qty.toFixed(4)}</qCom>
                    <vUnCom>${price.toFixed(10)}</vUnCom>
                    <vProd>${vProd}</vProd>
                    <cEANTrib>${item.ean || 'SEM GTIN'}</cEANTrib>
                    <uTrib>UN</uTrib>
                    <qTrib>${qty.toFixed(4)}</qTrib>
                    <vUnTrib>${price.toFixed(10)}</vUnTrib>
                    <indTot>1</indTot>
                </prod>
                <imposto>
                    <ICMS><ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102></ICMS>
                    <PIS><PISOutr><CST>99</CST><vBC>0.00</vBC><pPIS>0.0000</pPIS><vPIS>0.00</vPIS></PISOutr></PIS>
                    <COFINS><COFINSOutr><CST>99</CST><vBC>0.00</vBC><pCOFINS>0.0000</pCOFINS><vCOFINS>0.00</vCOFINS></COFINSOutr></COFINS>
                </imposto>
            </det>`;
        });
    }

    const tProd = totalProd.toFixed(2);
    const totalOrder = (parseFloat(ord.total_amount) || totalProd).toFixed(2);
    const dateEmi = toBrazilIsoDateTime(emissionDate);
    
    let destXml = '';
    if (ord.customer_name && ord.customer_document) {
        let destCNPJ = ord.customer_document.replace(/\D/g, '');
        let destTag = destCNPJ.length === 11 ? `<CPF>${destCNPJ}</CPF>` : `<CNPJ>${destCNPJ}</CNPJ>`;
        let destName = ord.customer_name;
        destXml = `
            <dest>
                ${destTag}
                <xNome>${destName}</xNome>
                <enderDest>
                    <xLgr>${ord.customer_street || 'NAO INFORMADO'}</xLgr>
                    <nro>${ord.customer_number || '0'}</nro>
                    <xBairro>${ord.customer_neighborhood || 'NAO INFORMADO'}</xBairro>
                    <cMun>3550308</cMun>
                    <xMun>${ord.customer_city || 'SAO PAULO'}</xMun>
                    <UF>${ord.customer_state || 'SP'}</UF>
                    <CEP>${(ord.customer_zip || '01000000').replace(/\D/g, '')}</CEP>
                    <cPais>1058</cPais>
                    <xPais>BRASIL</xPais>
                </enderDest>
                <indIEDest>9</indIEDest>
            </dest>
        `;
    }

    const unsignedXml = 
`<?xml version="1.0" encoding="UTF-8"?>
<enviNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
    <idLote>1</idLote>
    <indSinc>1</indSinc>
    <NFe>
        <infNFe versao="4.00" Id="${nfeId}">
            <ide>
                <cUF>${cUF}</cUF>
                <cNF>${cNF}</cNF>
                <natOp>VENDA</natOp>
                <mod>${mod}</mod>
                <serie>${parseInt(serie, 10)}</serie>
                <nNF>${parseInt(nNF, 10)}</nNF>
                <dhEmi>${dateEmi}</dhEmi>
                <tpNF>1</tpNF>
                <idDest>1</idDest>
                <cMunFG>3550308</cMunFG>
                <tpImp>1</tpImp>
                <tpEmis>${tpEmis}</tpEmis>
                <cDV>${cDV}</cDV>
                <tpAmb>${tpAmb}</tpAmb>
                <finNFe>1</finNFe>
                <indFinal>1</indFinal>
                <indPres>1</indPres>
                <indIntermed>0</indIntermed>
                <procEmi>0</procEmi>
                <verProc>1.0.0</verProc>
            </ide>
            <emit>
                <CNPJ>${emitCNPJ}</CNPJ>
                <xNome>${emitName}</xNome>
                <enderEmit>
                    <xLgr>${cp.street || 'RUA TESTE'}</xLgr>
                    <nro>${cp.number || '123'}</nro>
                    <xBairro>${cp.neighborhood || 'CENTRO'}</xBairro>
                    <cMun>3550308</cMun>
                    <xMun>${cp.city || 'SAO PAULO'}</xMun>
                    <UF>${cp.state || 'SP'}</UF>
                    <CEP>${(cp.zipcode || '01000000').replace(/\D/g, '')}</CEP>
                    <cPais>1058</cPais>
                    <xPais>BRASIL</xPais>
                </enderEmit>
                <IE>${(cp.ie || '123456789012').replace(/\\D/g, '')}</IE>
                ${cp.im ? '<IM>' + cp.im.replace(/\\D/g, '') + '</IM>' : ''}
                ${cp.cnae_principal ? '<CNAE>' + cp.cnae_principal.replace(/\\D/g, '') + '</CNAE>' : ''}
                <CRT>${cp.crt || 1}</CRT>
            </emit>${destXml ? '\\n' + destXml : ''}
            ${detXml}
            <total>
                <ICMSTot>
                    <vBC>0.00</vBC>
                    <vICMS>0.00</vICMS>
                    <vICMSDeson>0.00</vICMSDeson>
                    <vFCP>0.00</vFCP>
                    <vBCST>0.00</vBCST>
                    <vST>0.00</vST>
                    <vFCPST>0.00</vFCPST>
                    <vFCPSTRet>0.00</vFCPSTRet>
                    <vProd>${tProd}</vProd>
                    <vFrete>0.00</vFrete>
                    <vSeg>0.00</vSeg>
                    <vDesc>0.00</vDesc>
                    <vII>0.00</vII>
                    <vIPI>0.00</vIPI>
                    <vIPIDevol>0.00</vIPIDevol>
                    <vPIS>0.00</vPIS>
                    <vCOFINS>0.00</vCOFINS>
                    <vOutro>0.00</vOutro>
                    <vNF>${totalOrder}</vNF>
                </ICMSTot>
            </total>
            <transp>
                <modFrete>9</modFrete>
            </transp>
            <pag>
                <detPag>
                    <tPag>01</tPag>
                    <vPag>${totalOrder}</vPag>
                </detPag>
            </pag>
            <infAdic>
                <infCpl>EMPRESA OPTANTE PELO REGIME: ${cp.tax_regime ? cp.tax_regime.toUpperCase() : 'NAO INFORMADO'}. DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL. NAO GERA DIREITO A CREDITO FISCAL DE IPI.</infCpl>
            </infAdic>
        </infNFe>
    </NFe>
</enviNFe>`;

    // 3. Configure the XML Signature
    const sig: any = new SignedXml();
    // SEFAZ uses RSA-SHA1 for XML signature
    sig.signatureAlgorithm = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";
    // Required by new xml-crypto version
    sig.canonicalizationAlgorithm = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
    // We pass our KeyInfo implementation to embed the raw X509 certificate
    sig.keyInfoProvider = new MyKeyInfo(certPem);
    // The private key to actual compute the hash (v6+ API)
    sig.privateKey = privateKeyPem;
    
    // NFe standard requires two transforms, Enveloped Signature and C14n Canonicalization.
    // The node signed is the `<infNFe>` identified by Id attribute. So URI="#NFe..."
    sig.addReference({
        xpath: `//*[local-name(.)='infNFe']`,               // XPath locating the infNFe element
        transforms: ["http://www.w3.org/2000/09/xmldsig#enveloped-signature", "http://www.w3.org/TR/2001/REC-xml-c14n-20010315"], // Transforms
        digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",    // Digest algorithm
        uri: `#${nfeId}`,                                 // Reference URI to the node
        inclusiveNamespacesPrefixList: ""                 // Inclusive namespaces prefix list
    });
    
    // We compute the signature over the unsigned XML
    sig.computeSignature(unsignedXml, {
        location: { reference: "//*[local-name(.)='infNFe']", action: "after" } // Inject the <Signature> immediately after <infNFe> inside <NFe>
    });

    const signedXml = sig.getSignedXml();
    
    // Returning successfully
    return {
        id: nfeId,
        signedXml: signedXml
    };
};
