import { randomUUID } from 'crypto';
import { PurchaseOrder, CreatePurchaseData, SalesOrder, CreateSalesData } from '../types/Order';
import { ApproveQuoteData } from '../types/Dental';
import { OrderRepository } from '../repositories/orderRepository';
import { DOMParser } from '@xmldom/xmldom';
import { toBrazilDate } from '../utils/dateTime';
import { ProductRepository } from '../repositories/productRepository';
import pool from '../config/db';
import { RowDataPacket } from 'mysql2/promise';
import { Product, CreateProductData } from '../types/Product';
import { EntityService } from './entityService';

interface ImportSaleFromXmlData {
    xml_content: string;
    bank_account_public_id?: string | null | undefined;
    category_public_id?: string | null | undefined;
    customer_public_id?: string | null | undefined;
    delivery_address?: string | null | undefined;
    date?: string | null | undefined;
}

export interface ParsedNfeItem {
    sku: string | null;
    ean: string | null;
    name: string;
    quantity: number;
    unitPrice: number;
    xmlItemData: Record<string, any>;
}

export interface ParsedNfeHeader {
    nfeKey: string | null;
    nfeIssueDate: string | null;
    headerData: Record<string, any>;
}

export class OrderService {
    private static readonly MAX_MONEY_VALUE = 99999999.99; // DECIMAL(10,2)

    public static normalizeTextKey(value: string | null | undefined): string {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    public static onlyDigits(value: string | null | undefined): string {
        return String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    }

    public static async resolveCompanyCnpj(companyId: number): Promise<string | null> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT cnpj
             FROM companies
             WHERE id = ?
             LIMIT 1`,
            [companyId]
        );

        if (!rows[0]) return null;

        const cnpjDigits = this.onlyDigits(String(rows[0]!.cnpj || ''));
        return cnpjDigits || null;
    }

    public static async resolveCompanyIdByEmitterDocument(emitterDocument: string | null): Promise<number | null> {
        const emitterDigits = this.onlyDigits(emitterDocument);
        if (!emitterDigits) return null;

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT id FROM companies 
             WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '-', ''), '/', ''), ' ', '') = ?
                OR cnpj = ?
             LIMIT 1`,
            [emitterDigits, emitterDigits]
        );

        if (rows[0]) {
            return Number(rows[0].id);
        }
        return null;
    }

    private static async assertNfeEmitterMatchesCompany(companyId: number, emitterDocument: string | null): Promise<void> {
        const companyCnpj = await this.resolveCompanyCnpj(companyId);
        if (!companyCnpj) {
            throw new Error('CNPJ da empresa nao configurado. Configure o CNPJ da empresa antes de importar XML.');
        }

        const emitterDigits = this.onlyDigits(emitterDocument);
        if (!emitterDigits) {
            throw new Error('Nao foi possivel identificar o CNPJ emitente da NF no XML.');
        }

        if (emitterDigits !== companyCnpj) {
            throw new Error('CNPJ do emitente da NF diferente do CNPJ da empresa. Importacao nao permitida.');
        }
    }

    private static async assertNfeNotDuplicated(companyId: number, nfeKey: string | null): Promise<void> {
        if (!nfeKey) {
            throw new Error('Nao foi possivel identificar a chave da NF no XML.');
        }

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT id
             FROM sales_orders
             WHERE company_id = ?
               AND nfe_key = ?
               AND is_deleted = 0
             LIMIT 1`,
            [companyId, nfeKey]
        );

        if (rows.length > 0) {
            throw new Error('Ja existe uma nota com esta chave da NF importada para esta empresa.');
        }
    }

    public static resolveProductByNameFallback(
        productList: Array<{ public_id: string; name: string; selling_price?: number | null }>,
        nfeName: string
    ): { public_id: string; name: string; selling_price?: number | null } | null {
        const normalizedNfeName = this.normalizeTextKey(nfeName);
        if (!normalizedNfeName) return null;

        const exactMatches = productList.filter((product) => this.normalizeTextKey(product.name) === normalizedNfeName);
        if (exactMatches.length === 1) {
            return exactMatches[0] || null;
        }

        const includesMatches = productList.filter((product) => {
            const normalizedProductName = this.normalizeTextKey(product.name);
            return normalizedProductName.includes(normalizedNfeName) || normalizedNfeName.includes(normalizedProductName);
        });

        if (includesMatches.length === 1) {
            return includesMatches[0] || null;
        }

        return null;
    }

    public static parseDecimal(value: string | null | undefined): number {
        if (!value) return 0;

        const raw = String(value).trim();
        if (!raw) return 0;

        // Mantem apenas digitos/sinais/separadores para normalizar formatos como:
        // 1.234,56 | 1,234.56 | 1234.56 | 1234,56
        const cleaned = raw.replace(/[^0-9,.-]/g, '');
        const lastDot = cleaned.lastIndexOf('.');
        const lastComma = cleaned.lastIndexOf(',');

        let normalized = cleaned;

        if (lastDot >= 0 && lastComma >= 0) {
            // O ultimo separador encontrado e tratado como decimal.
            if (lastDot > lastComma) {
                normalized = cleaned.replace(/,/g, '');
            } else {
                normalized = cleaned.replace(/\./g, '').replace(',', '.');
            }
        } else if (lastComma >= 0) {
            normalized = cleaned.replace(/\./g, '').replace(',', '.');
        } else {
            // Apenas ponto ou inteiro.
            normalized = cleaned.replace(/,/g, '');
        }

        const parsed = Number(normalized);
        if (!Number.isFinite(parsed) || parsed < 0) return 0;

        if (parsed > this.MAX_MONEY_VALUE) {
            return this.MAX_MONEY_VALUE;
        }

        return parsed;
    }

    public static getTagText(parent: any, tagName: string): string {
        if (!parent) return '';
        const node = parent.getElementsByTagName ? parent.getElementsByTagName(tagName)[0] : null;
        return String(node?.textContent || '').trim();
    }

    public static parseNfeItems(xmlContent: string): ParsedNfeItem[] {
        const doc = new DOMParser().parseFromString(xmlContent, 'text/xml');
        if (doc.getElementsByTagName('parsererror').length > 0) {
            throw new Error('XML invalido para importacao de notas.');
        }

        const detNodes = Array.from(doc.getElementsByTagName('det'));
        const parsed: ParsedNfeItem[] = [];

        let itemIndex = 0;
        for (const detNode of detNodes) {
            itemIndex++;
            const prodNode = detNode.getElementsByTagName('prod')[0];
            if (!prodNode) continue;

            const nItemAttr = detNode.getAttribute('nItem');
            const nItem = nItemAttr ? Number(nItemAttr) : itemIndex;

            const sku = this.getTagText(prodNode, 'cProd') || null;
            const rawEan = this.getTagText(prodNode, 'cEAN') || this.getTagText(prodNode, 'cEANTrib');
            const ean = rawEan && rawEan.toUpperCase() !== 'SEM GTIN' ? rawEan : null;
            const name = this.getTagText(prodNode, 'xProd');
            const quantity = this.parseDecimal(this.getTagText(prodNode, 'qCom'));
            const unitPrice = this.parseDecimal(this.getTagText(prodNode, 'vUnCom'));
            const vProd = this.parseDecimal(this.getTagText(prodNode, 'vProd'));

            if (!name || quantity <= 0) continue;

            // Extração de Impostos do Item (det -> imposto)
            const impostoNode = detNode.getElementsByTagName('imposto')[0];
            const vTotTribItem = impostoNode ? this.parseDecimal(this.getTagText(impostoNode, 'vTotTrib')) : 0;

            // ICMS
            let icmsData: Record<string, any> | null = null;
            let cstIcms: string | null = null;
            let csosnIcms: string | null = null;
            let vIcmsVal = 0;

            const icmsParent = impostoNode?.getElementsByTagName('ICMS')[0];
            if (icmsParent) {
                let groupNode: any = null;
                for (let i = 0; i < (icmsParent.childNodes?.length || 0); i++) {
                    const node = icmsParent.childNodes[i];
                    if (node && node.nodeType === 1) {
                        groupNode = node;
                        break;
                    }
                }

                if (groupNode) {
                    cstIcms = this.getTagText(groupNode, 'CST') || null;
                    csosnIcms = this.getTagText(groupNode, 'CSOSN') || null;
                    vIcmsVal = this.parseDecimal(this.getTagText(groupNode, 'vICMS'));

                    icmsData = {
                        grupo: groupNode.nodeName || groupNode.localName || null,
                        orig: this.getTagText(groupNode, 'orig') || null,
                        cst: cstIcms,
                        csosn: csosnIcms,
                        modBC: this.getTagText(groupNode, 'modBC') || null,
                        vBC: this.parseDecimal(this.getTagText(groupNode, 'vBC')),
                        pICMS: this.parseDecimal(this.getTagText(groupNode, 'pICMS')),
                        vICMS: vIcmsVal,
                        modBCST: this.getTagText(groupNode, 'modBCST') || null,
                        pMVAST: this.parseDecimal(this.getTagText(groupNode, 'pMVAST')),
                        pRedBCST: this.parseDecimal(this.getTagText(groupNode, 'pRedBCST')),
                        vBCST: this.parseDecimal(this.getTagText(groupNode, 'vBCST')),
                        pICMSST: this.parseDecimal(this.getTagText(groupNode, 'pICMSST')),
                        vICMSST: this.parseDecimal(this.getTagText(groupNode, 'vICMSST')),
                        pRedBC: this.parseDecimal(this.getTagText(groupNode, 'pRedBC')),
                        vICMSDeson: this.parseDecimal(this.getTagText(groupNode, 'vICMSDeson')),
                        motDesICMS: this.getTagText(groupNode, 'motDesICMS') || null,
                        vBCFCP: this.parseDecimal(this.getTagText(groupNode, 'vBCFCP')),
                        pFCP: this.parseDecimal(this.getTagText(groupNode, 'pFCP')),
                        vFCP: this.parseDecimal(this.getTagText(groupNode, 'vFCP')),
                        vBCSTRet: this.parseDecimal(this.getTagText(groupNode, 'vBCSTRet')),
                        pST: this.parseDecimal(this.getTagText(groupNode, 'pST')),
                        vICMSSubstituto: this.parseDecimal(this.getTagText(groupNode, 'vICMSSubstituto')),
                        vICMSSTRet: this.parseDecimal(this.getTagText(groupNode, 'vICMSSTRet')),
                        pCredSN: this.parseDecimal(this.getTagText(groupNode, 'pCredSN')),
                        vCredICMSSN: this.parseDecimal(this.getTagText(groupNode, 'vCredICMSSN')),
                    };
                }
            }

            // PIS
            let pisData: Record<string, any> | null = null;
            let vPisVal = 0;
            const pisParent = impostoNode?.getElementsByTagName('PIS')[0];
            if (pisParent) {
                let pisGroup: any = null;
                for (let i = 0; i < (pisParent.childNodes?.length || 0); i++) {
                    const node = pisParent.childNodes[i];
                    if (node && node.nodeType === 1) {
                        pisGroup = node;
                        break;
                    }
                }
                if (pisGroup) {
                    vPisVal = this.parseDecimal(this.getTagText(pisGroup, 'vPIS'));
                    pisData = {
                        grupo: pisGroup.nodeName || pisGroup.localName || null,
                        cst: this.getTagText(pisGroup, 'CST') || null,
                        vBC: this.parseDecimal(this.getTagText(pisGroup, 'vBC')),
                        pPIS: this.parseDecimal(this.getTagText(pisGroup, 'pPIS')),
                        vPIS: vPisVal,
                        qBCProd: this.parseDecimal(this.getTagText(pisGroup, 'qBCProd')),
                        vAliqProd: this.parseDecimal(this.getTagText(pisGroup, 'vAliqProd')),
                    };
                }
            }

            // COFINS
            let cofinsData: Record<string, any> | null = null;
            let vCofinsVal = 0;
            const cofinsParent = impostoNode?.getElementsByTagName('COFINS')[0];
            if (cofinsParent) {
                let cofinsGroup: any = null;
                for (let i = 0; i < (cofinsParent.childNodes?.length || 0); i++) {
                    const node = cofinsParent.childNodes[i];
                    if (node && node.nodeType === 1) {
                        cofinsGroup = node;
                        break;
                    }
                }
                if (cofinsGroup) {
                    vCofinsVal = this.parseDecimal(this.getTagText(cofinsGroup, 'vCOFINS'));
                    cofinsData = {
                        grupo: cofinsGroup.nodeName || cofinsGroup.localName || null,
                        cst: this.getTagText(cofinsGroup, 'CST') || null,
                        vBC: this.parseDecimal(this.getTagText(cofinsGroup, 'vBC')),
                        pCOFINS: this.parseDecimal(this.getTagText(cofinsGroup, 'pCOFINS')),
                        vCOFINS: vCofinsVal,
                        qBCProd: this.parseDecimal(this.getTagText(cofinsGroup, 'qBCProd')),
                        vAliqProd: this.parseDecimal(this.getTagText(cofinsGroup, 'vAliqProd')),
                    };
                }
            }

            // IPI
            let ipiData: Record<string, any> | null = null;
            let vIpiVal = 0;
            const ipiParent = impostoNode?.getElementsByTagName('IPI')[0];
            if (ipiParent) {
                const ipiTrib = ipiParent.getElementsByTagName('IPITrib')[0] || ipiParent.getElementsByTagName('IPINT')[0];
                vIpiVal = ipiTrib ? this.parseDecimal(this.getTagText(ipiTrib, 'vIPI')) : 0;
                ipiData = {
                    cEnq: this.getTagText(ipiParent, 'cEnq') || null,
                    cst: ipiTrib ? this.getTagText(ipiTrib, 'CST') || null : null,
                    vBC: ipiTrib ? this.parseDecimal(this.getTagText(ipiTrib, 'vBC')) : 0,
                    pIPI: ipiTrib ? this.parseDecimal(this.getTagText(ipiTrib, 'pIPI')) : 0,
                    vIPI: vIpiVal,
                    qUnid: ipiTrib ? this.parseDecimal(this.getTagText(ipiTrib, 'qUnid')) : 0,
                    vUnid: ipiTrib ? this.parseDecimal(this.getTagText(ipiTrib, 'vUnid')) : 0,
                };
            }

            // II (Imposto de Importação)
            let iiData: Record<string, any> | null = null;
            const iiParent = impostoNode?.getElementsByTagName('II')[0];
            if (iiParent) {
                iiData = {
                    vBC: this.parseDecimal(this.getTagText(iiParent, 'vBC')),
                    vDespAdu: this.parseDecimal(this.getTagText(iiParent, 'vDespAdu')),
                    vII: this.parseDecimal(this.getTagText(iiParent, 'vII')),
                    vIOF: this.parseDecimal(this.getTagText(iiParent, 'vIOF')),
                };
            }

            // Informações Adicionais do Produto
            const infAdProd = this.getTagText(detNode, 'infAdProd') || null;

            parsed.push({
                sku,
                ean,
                name,
                quantity,
                unitPrice,
                xmlItemData: {
                    // Propriedades Diretas / Top-level
                    nItem,
                    cProd: sku,
                    cEAN: this.getTagText(prodNode, 'cEAN') || null,
                    cEANTrib: this.getTagText(prodNode, 'cEANTrib') || null,
                    xProd: name,
                    ncm: this.getTagText(prodNode, 'NCM') || null,
                    nve: this.getTagText(prodNode, 'NVE') || null,
                    cest: this.getTagText(prodNode, 'CEST') || null,
                    indEscala: this.getTagText(prodNode, 'indEscala') || null,
                    cBenef: this.getTagText(prodNode, 'cBenef') || null,
                    extipi: this.getTagText(prodNode, 'EXTIPI') || null,
                    cfop: this.getTagText(prodNode, 'CFOP') || null,
                    uCom: this.getTagText(prodNode, 'uCom') || null,
                    qCom: quantity,
                    vUnCom: unitPrice,
                    vProd,
                    uTrib: this.getTagText(prodNode, 'uTrib') || null,
                    qTrib: this.parseDecimal(this.getTagText(prodNode, 'qTrib')) || quantity,
                    vUnTrib: this.parseDecimal(this.getTagText(prodNode, 'vUnTrib')) || unitPrice,
                    vFrete: this.parseDecimal(this.getTagText(prodNode, 'vFrete')),
                    vSeg: this.parseDecimal(this.getTagText(prodNode, 'vSeg')),
                    vDesc: this.parseDecimal(this.getTagText(prodNode, 'vDesc')),
                    vOutro: this.parseDecimal(this.getTagText(prodNode, 'vOutro')),
                    indTot: this.getTagText(prodNode, 'indTot') || null,
                    xPed: this.getTagText(prodNode, 'xPed') || null,
                    nItemPed: this.getTagText(prodNode, 'nItemPed') || null,

                    // Atalhos fiscais
                    cst_icms: cstIcms,
                    csosn: csosnIcms,
                    vTotTrib: vTotTribItem,
                    vICMS: vIcmsVal,
                    vPIS: vPisVal,
                    vCOFINS: vCofinsVal,
                    vIPI: vIpiVal,

                    // Árvore completa de impostos e infAdProd
                    imposto: {
                        vTotTrib: vTotTribItem,
                        icms: icmsData,
                        pis: pisData,
                        cofins: cofinsData,
                        ipi: ipiData,
                        ii: iiData,
                    },
                    infAdProd,
                },
            });
        }

        return parsed;
    }

    public static parseNfeHeader(xmlContent: string): ParsedNfeHeader {
        const doc = new DOMParser().parseFromString(xmlContent, 'text/xml');
        if (doc.getElementsByTagName('parsererror').length > 0) {
            throw new Error('XML invalido para importacao de notas.');
        }

        const infNFeNode = doc.getElementsByTagName('infNFe')[0];
        const ideNode = doc.getElementsByTagName('ide')[0];
        const emitNode = doc.getElementsByTagName('emit')[0];
        const enderEmitNode = emitNode?.getElementsByTagName('enderEmit')[0];
        const destNode = doc.getElementsByTagName('dest')[0];
        const enderDestNode = destNode?.getElementsByTagName('enderDest')[0];
        const totalNode = doc.getElementsByTagName('total')[0];
        const icmsTotNode = totalNode?.getElementsByTagName('ICMSTot')[0];
        const transpNode = doc.getElementsByTagName('transp')[0];
        const transportaNode = transpNode?.getElementsByTagName('transporta')[0];
        const veicTranspNode = transpNode?.getElementsByTagName('veicTransp')[0];
        const cobrNode = doc.getElementsByTagName('cobr')[0];
        const fatNode = cobrNode?.getElementsByTagName('fat')[0];
        const pagNode = doc.getElementsByTagName('pag')[0];
        const infAdicNode = doc.getElementsByTagName('infAdic')[0];

        // Chave NFe
        const infNFeId = String(infNFeNode?.getAttribute('Id') || '').trim();
        const possibleKey = infNFeId.startsWith('NFe') ? infNFeId.slice(3) : infNFeId;
        const nfeKey = /^\d{44}$/.test(possibleKey)
            ? possibleKey
            : (doc.getElementsByTagName('chNFe')[0]?.textContent?.trim() || null);

        // Datas
        const dhEmi = this.getTagText(ideNode, 'dhEmi');
        const dEmi = this.getTagText(ideNode, 'dEmi');
        const issueDateRaw = dhEmi || dEmi;
        const issueDate = issueDateRaw ? new Date(issueDateRaw) : null;
        const nfeIssueDate = issueDate && !Number.isNaN(issueDate.getTime())
            ? (issueDate.toISOString().split('T')[0] as string)
            : null;

        const dhSaiEnt = this.getTagText(ideNode, 'dhSaiEnt') || this.getTagText(ideNode, 'dSaiEnt') || null;

        // Emitente
        const emitDoc = this.getTagText(emitNode, 'CNPJ') || this.getTagText(emitNode, 'CPF') || null;
        const emitNome = this.getTagText(emitNode, 'xNome') || null;
        const emitFant = this.getTagText(emitNode, 'xFant') || null;
        const emitIE = this.getTagText(emitNode, 'IE') || null;
        const emitIEST = this.getTagText(emitNode, 'IEST') || null;
        const emitIM = this.getTagText(emitNode, 'IM') || null;
        const emitCNAE = this.getTagText(emitNode, 'CNAE') || null;
        const emitCRT = this.getTagText(emitNode, 'CRT') || null;

        const emitEndereco = enderEmitNode ? {
            xLgr: this.getTagText(enderEmitNode, 'xLgr') || null,
            nro: this.getTagText(enderEmitNode, 'nro') || null,
            xCpl: this.getTagText(enderEmitNode, 'xCpl') || null,
            xBairro: this.getTagText(enderEmitNode, 'xBairro') || null,
            cMun: this.getTagText(enderEmitNode, 'cMun') || null,
            xMun: this.getTagText(enderEmitNode, 'xMun') || null,
            UF: this.getTagText(enderEmitNode, 'UF') || null,
            CEP: this.getTagText(enderEmitNode, 'CEP') || null,
            cPais: this.getTagText(enderEmitNode, 'cPais') || null,
            xPais: this.getTagText(enderEmitNode, 'xPais') || null,
            fone: this.getTagText(enderEmitNode, 'fone') || null,
        } : null;

        // Destinatário
        const destDoc = this.getTagText(destNode, 'CNPJ') || this.getTagText(destNode, 'CPF') || this.getTagText(destNode, 'idEstrangeiro') || null;
        const destNome = this.getTagText(destNode, 'xNome') || null;
        const destIndIEDest = this.getTagText(destNode, 'indIEDest') || null;
        const destIE = this.getTagText(destNode, 'IE') || null;
        const destISUF = this.getTagText(destNode, 'ISUF') || null;
        const destIM = this.getTagText(destNode, 'IM') || null;
        const destEmail = this.getTagText(destNode, 'email') || null;

        const destEndereco = enderDestNode ? {
            xLgr: this.getTagText(enderDestNode, 'xLgr') || null,
            nro: this.getTagText(enderDestNode, 'nro') || null,
            xCpl: this.getTagText(enderDestNode, 'xCpl') || null,
            xBairro: this.getTagText(enderDestNode, 'xBairro') || null,
            cMun: this.getTagText(enderDestNode, 'cMun') || null,
            xMun: this.getTagText(enderDestNode, 'xMun') || null,
            UF: this.getTagText(enderDestNode, 'UF') || null,
            CEP: this.getTagText(enderDestNode, 'CEP') || null,
            cPais: this.getTagText(enderDestNode, 'cPais') || null,
            xPais: this.getTagText(enderDestNode, 'xPais') || null,
            fone: this.getTagText(enderDestNode, 'fone') || null,
        } : null;

        // Totais
        const vTotTribRaw = this.getTagText(icmsTotNode, 'vTotTrib');
        const tributosTotal = vTotTribRaw ? this.parseDecimal(vTotTribRaw) : null;

        const totais = icmsTotNode ? {
            vBC: this.parseDecimal(this.getTagText(icmsTotNode, 'vBC')),
            vICMS: this.parseDecimal(this.getTagText(icmsTotNode, 'vICMS')),
            vICMSDeson: this.parseDecimal(this.getTagText(icmsTotNode, 'vICMSDeson')),
            vFCPUFDest: this.parseDecimal(this.getTagText(icmsTotNode, 'vFCPUFDest')),
            vICMSUFDest: this.parseDecimal(this.getTagText(icmsTotNode, 'vICMSUFDest')),
            vICMSUFFrem: this.parseDecimal(this.getTagText(icmsTotNode, 'vICMSUFFrem')),
            vFCP: this.parseDecimal(this.getTagText(icmsTotNode, 'vFCP')),
            vBCST: this.parseDecimal(this.getTagText(icmsTotNode, 'vBCST')),
            vST: this.parseDecimal(this.getTagText(icmsTotNode, 'vST')),
            vFCPST: this.parseDecimal(this.getTagText(icmsTotNode, 'vFCPST')),
            vFCPSTRet: this.parseDecimal(this.getTagText(icmsTotNode, 'vFCPSTRet')),
            vProd: this.parseDecimal(this.getTagText(icmsTotNode, 'vProd')),
            vFrete: this.parseDecimal(this.getTagText(icmsTotNode, 'vFrete')),
            vSeg: this.parseDecimal(this.getTagText(icmsTotNode, 'vSeg')),
            vDesc: this.parseDecimal(this.getTagText(icmsTotNode, 'vDesc')),
            vII: this.parseDecimal(this.getTagText(icmsTotNode, 'vII')),
            vIPI: this.parseDecimal(this.getTagText(icmsTotNode, 'vIPI')),
            vIPIDevol: this.parseDecimal(this.getTagText(icmsTotNode, 'vIPIDevol')),
            vPIS: this.parseDecimal(this.getTagText(icmsTotNode, 'vPIS')),
            vCOFINS: this.parseDecimal(this.getTagText(icmsTotNode, 'vCOFINS')),
            vOutro: this.parseDecimal(this.getTagText(icmsTotNode, 'vOutro')),
            vNF: this.parseDecimal(this.getTagText(icmsTotNode, 'vNF')),
            vTotTrib: tributosTotal ?? 0,
        } : null;

        // Transporte
        const volNodes = transpNode ? Array.from(transpNode.getElementsByTagName('vol')) : [];
        const volumes = volNodes.map((vol) => ({
            qVol: this.parseDecimal(this.getTagText(vol, 'qVol')),
            esp: this.getTagText(vol, 'esp') || null,
            marca: this.getTagText(vol, 'marca') || null,
            nVol: this.getTagText(vol, 'nVol') || null,
            pesoL: this.parseDecimal(this.getTagText(vol, 'pesoL')),
            pesoB: this.parseDecimal(this.getTagText(vol, 'pesoB')),
        }));

        const transporte = transpNode ? {
            modFrete: this.getTagText(transpNode, 'modFrete') || null,
            transporta: transportaNode ? {
                CNPJ: this.getTagText(transportaNode, 'CNPJ') || null,
                CPF: this.getTagText(transportaNode, 'CPF') || null,
                xNome: this.getTagText(transportaNode, 'xNome') || null,
                IE: this.getTagText(transportaNode, 'IE') || null,
                xEnder: this.getTagText(transportaNode, 'xEnder') || null,
                xMun: this.getTagText(transportaNode, 'xMun') || null,
                UF: this.getTagText(transportaNode, 'UF') || null,
            } : null,
            veiculo: veicTranspNode ? {
                placa: this.getTagText(veicTranspNode, 'placa') || null,
                UF: this.getTagText(veicTranspNode, 'UF') || null,
                RNTC: this.getTagText(veicTranspNode, 'RNTC') || null,
            } : null,
            volumes,
        } : null;

        // Cobrança
        const dupNodes = cobrNode ? Array.from(cobrNode.getElementsByTagName('dup')) : [];
        const duplicatas = dupNodes.map((dup) => ({
            nDup: this.getTagText(dup, 'nDup') || null,
            dVenc: this.getTagText(dup, 'dVenc') || null,
            vDup: this.parseDecimal(this.getTagText(dup, 'vDup')),
        }));

        const cobranca = cobrNode ? {
            fat: fatNode ? {
                nFat: this.getTagText(fatNode, 'nFat') || null,
                vOrig: this.parseDecimal(this.getTagText(fatNode, 'vOrig')),
                vDesc: this.parseDecimal(this.getTagText(fatNode, 'vDesc')),
                vLiq: this.parseDecimal(this.getTagText(fatNode, 'vLiq')),
            } : null,
            duplicatas,
        } : null;

        // Pagamento
        const detPagNodes = pagNode ? Array.from(pagNode.getElementsByTagName('detPag')) : [];
        const pagamentos = detPagNodes.map((dp) => {
            const cardNode = dp.getElementsByTagName('card')[0];
            return {
                indPag: this.getTagText(dp, 'indPag') || null,
                tPag: this.getTagText(dp, 'tPag') || null,
                vPag: this.parseDecimal(this.getTagText(dp, 'vPag')),
                tpIntegra: this.getTagText(cardNode || dp, 'tpIntegra') || null,
                CNPJ: this.getTagText(cardNode || dp, 'CNPJ') || null,
                tBand: this.getTagText(cardNode || dp, 'tBand') || null,
                cAut: this.getTagText(cardNode || dp, 'cAut') || null,
            };
        });
        const vTroco = pagNode ? this.parseDecimal(this.getTagText(pagNode, 'vTroco')) : 0;

        // Informações Adicionais
        const infAdic = infAdicNode ? {
            infAdFisco: this.getTagText(infAdicNode, 'infAdFisco') || null,
            infCpl: this.getTagText(infAdicNode, 'infCpl') || null,
        } : null;

        // Protocolo de autorização (protNFe / infProt)
        const protNode = doc.getElementsByTagName('protNFe')[0] || doc.getElementsByTagName('protNFCe')[0];
        const infProtNode = protNode?.getElementsByTagName('infProt')[0];
        const nProt = this.getTagText(infProtNode, 'nProt') || this.getTagText(doc, 'nProt') || null;
        const dhRecbto = this.getTagText(infProtNode, 'dhRecbto') || this.getTagText(doc, 'dhRecbto') || null;
        const cStat = this.getTagText(infProtNode, 'cStat') || null;
        const xMotivo = this.getTagText(infProtNode, 'xMotivo') || null;

        return {
            nfeKey,
            nfeIssueDate,
            headerData: {
                // Principais para compatibilidade direta
                numero: this.getTagText(ideNode, 'nNF') || null,
                serie: this.getTagText(ideNode, 'serie') || null,
                naturezaOperacao: this.getTagText(ideNode, 'natOp') || null,
                modelo: this.getTagText(ideNode, 'mod') || null,
                protocolo: nProt,
                dhRecbto,
                emitenteNome: emitNome,
                emitenteDocumento: emitDoc,
                destinatarioNome: destNome,
                destinatarioDocumento: destDoc,
                tributosTotal,

                // Tags estruturadas completas
                prot: infProtNode ? {
                    nProt,
                    dhRecbto,
                    cStat,
                    xMotivo,
                } : null,
                ide: {
                    cUF: this.getTagText(ideNode, 'cUF') || null,
                    cNF: this.getTagText(ideNode, 'cNF') || null,
                    natOp: this.getTagText(ideNode, 'natOp') || null,
                    mod: this.getTagText(ideNode, 'mod') || null,
                    serie: this.getTagText(ideNode, 'serie') || null,
                    nNF: this.getTagText(ideNode, 'nNF') || null,
                    dhEmi: dhEmi || null,
                    dEmi: dEmi || null,
                    dhSaiEnt: dhSaiEnt,
                    tpNF: this.getTagText(ideNode, 'tpNF') || null,
                    idDest: this.getTagText(ideNode, 'idDest') || null,
                    cMunFG: this.getTagText(ideNode, 'cMunFG') || null,
                    tpImp: this.getTagText(ideNode, 'tpImp') || null,
                    tpEmis: this.getTagText(ideNode, 'tpEmis') || null,
                    cDV: this.getTagText(ideNode, 'cDV') || null,
                    tpAmb: this.getTagText(ideNode, 'tpAmb') || null,
                    finNFe: this.getTagText(ideNode, 'finNFe') || null,
                    indFinal: this.getTagText(ideNode, 'indFinal') || null,
                    indPres: this.getTagText(ideNode, 'indPres') || null,
                    procEmi: this.getTagText(ideNode, 'procEmi') || null,
                    verProc: this.getTagText(ideNode, 'verProc') || null,
                },
                emit: {
                    CNPJ: this.getTagText(emitNode, 'CNPJ') || null,
                    CPF: this.getTagText(emitNode, 'CPF') || null,
                    xNome: emitNome,
                    xFant: emitFant,
                    IE: emitIE,
                    IEST: emitIEST,
                    IM: emitIM,
                    CNAE: emitCNAE,
                    CRT: emitCRT,
                    enderEmit: emitEndereco,
                },
                dest: destNode ? {
                    CNPJ: this.getTagText(destNode, 'CNPJ') || null,
                    CPF: this.getTagText(destNode, 'CPF') || null,
                    idEstrangeiro: this.getTagText(destNode, 'idEstrangeiro') || null,
                    xNome: destNome,
                    indIEDest: destIndIEDest,
                    IE: destIE,
                    ISUF: destISUF,
                    IM: destIM,
                    email: destEmail,
                    enderDest: destEndereco,
                } : null,
                total: totais,
                transp: transporte,
                cobr: cobranca,
                pag: {
                    detPag: pagamentos,
                    vTroco,
                },
                infAdic,
            },
        };
    }

    public static async resolveOrCreateProductForNfeItem(
        companyId: number,
        item: ParsedNfeItem,
        allProducts: Product[]
    ): Promise<Product | null> {
        let product = await ProductRepository.getBySkuOrEan(companyId, item.sku, item.ean);

        if (!product) {
            product = this.resolveProductByNameFallback(allProducts, item.name) as Product | null;
        }

        if (product) {
            const updates: Partial<CreateProductData> = {};
            if (!product.ncm && item.xmlItemData?.ncm) updates.ncm = String(item.xmlItemData.ncm).slice(0, 8);
            if (!product.cest && item.xmlItemData?.cest) updates.cest = String(item.xmlItemData.cest).slice(0, 7);
            if (!product.ean && item.ean) updates.ean = item.ean;
            if (!product.sku && item.sku) updates.sku = item.sku;

            if (Object.keys(updates).length > 0) {
                try {
                    await ProductRepository.update(product.public_id, companyId, updates);
                } catch (_) {
                    // Ignora eventuais colisões não críticas
                }
            }
            return product;
        }

        const created = await ProductRepository.create(companyId, {
            name: item.name,
            sku: item.sku || undefined,
            ean: item.ean || undefined,
            external_code: item.sku || undefined,
            is_imported: true,
            ncm: item.xmlItemData?.ncm ? String(item.xmlItemData.ncm).slice(0, 8) : undefined,
            cest: item.xmlItemData?.cest ? String(item.xmlItemData.cest).slice(0, 7) : undefined,
            cost_price: item.unitPrice > 0 ? item.unitPrice : 0,
            selling_price: item.unitPrice > 0 ? item.unitPrice : 0,
            initial_stock: 0,
            min_stock: 0,
            max_stock: 0,
        });

        allProducts.push(created);
        return created;
    }

    public static async resolveDefaultBankAccountPublicId(companyId: number): Promise<string | null> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT public_id
             FROM bank_accounts
             WHERE company_id = ?
             ORDER BY id ASC
             LIMIT 1`,
            [companyId]
        );

        if (rows.length > 0) {
            return String(rows[0]!.public_id || '').trim() || null;
        }

        const publicId = randomUUID();
        await pool.query(
            `INSERT INTO bank_accounts (public_id, name, type, initial_balance, current_balance, company_id)
             VALUES (?, 'Caixa Geral', 'cash', 0.00, 0.00, ?)`,
            [publicId, companyId]
        );
        return publicId;
    }

    private static async resolveDefaultIncomeCategoryPublicId(companyId: number): Promise<string | null> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT public_id
             FROM categories
             WHERE company_id = ?
               AND type = 'income'
             ORDER BY CASE WHEN LOWER(name) LIKE '%venda%' THEN 0 ELSE 1 END, id ASC
             LIMIT 1`,
            [companyId]
        );

        if (rows.length > 0) {
            return String(rows[0]!.public_id || '').trim() || null;
        }

        const publicId = randomUUID();
        await pool.query(
            `INSERT INTO categories (public_id, company_id, name, type)
             VALUES (?, ?, 'Vendas', 'income')`,
            [publicId, companyId]
        );
        return publicId;
    }

    private static async resolveCustomerPublicIdByDocument(companyId: number, xmlContent: string): Promise<string | null> {
        const doc = new DOMParser().parseFromString(xmlContent, 'text/xml');
        const destNode = doc.getElementsByTagName('dest')[0];
        if (!destNode) return null;

        const cnpj = this.getTagText(destNode, 'CNPJ').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const cpf = this.getTagText(destNode, 'CPF').replace(/\D/g, '');
        const documentDigits = cnpj || cpf;

        if (documentDigits) {
            const [rows] = await pool.query<RowDataPacket[]>(
                `SELECT public_id
                 FROM customers
                 WHERE company_id = ?
                   AND REPLACE(REPLACE(REPLACE(REPLACE(cnpj_cpf, '.', ''), '-', ''), '/', ''), ' ', '') = ?
                 LIMIT 1`,
                [companyId, documentDigits]
            );

            if (rows.length > 0) {
                return String(rows[0]!.public_id || '').trim() || null;
            }

            const name = this.getTagText(destNode, 'xNome');
            if (name) {
                try {
                    const enderDest = destNode.getElementsByTagName('enderDest')[0];
                    const created = await EntityService.createCustomer(companyId, {
                        name,
                        cnpj_cpf: documentDigits,
                        inscricao_estadual: this.getTagText(destNode, 'IE') || undefined,
                        email: this.getTagText(destNode, 'email') || undefined,
                        street: this.getTagText(enderDest, 'xLgr') || undefined,
                        number: this.getTagText(enderDest, 'nro') || undefined,
                        complement: this.getTagText(enderDest, 'xCpl') || undefined,
                        neighborhood: this.getTagText(enderDest, 'xBairro') || undefined,
                        city: this.getTagText(enderDest, 'xMun') || undefined,
                        state: this.getTagText(enderDest, 'UF') || undefined,
                        zipcode: this.getTagText(enderDest, 'CEP') || undefined,
                        phone: this.getTagText(enderDest, 'fone') || undefined,
                    });
                    return created.public_id;
                } catch (err) {
                    console.error('Erro ao auto-criar cliente a partir do XML:', err);
                }
            }
        }

        return null;
    }

    private static resolveOrderDate(xmlContent: string): string {
        const doc = new DOMParser().parseFromString(xmlContent, 'text/xml');
        const ideNode = doc.getElementsByTagName('ide')[0];
        const dhEmi = this.getTagText(ideNode, 'dhEmi');
        const dEmi = this.getTagText(ideNode, 'dEmi');
        const candidate = dhEmi || dEmi;

        if (!candidate) {
            return new Date().toISOString().split('T')[0] as string;
        }

        const date = new Date(candidate);
        if (Number.isNaN(date.getTime())) {
            return new Date().toISOString().split('T')[0] as string;
        }

        return date.toISOString().split('T')[0] as string;
    }

    static async importSaleFromXml(
        companyId: number,
        userPublicId: string,
        data: ImportSaleFromXmlData
    ): Promise<{ sale: SalesOrder; imported_items: number; unmatched_items: Array<{ sku: string | null; ean: string | null; name: string }> }> {
        const xmlContent = String(data.xml_content || '').trim();
        if (!xmlContent) {
            throw new Error('Conteudo XML nao informado.');
        }

        const parsedItems = this.parseNfeItems(xmlContent);
        const parsedHeader = this.parseNfeHeader(xmlContent);

        let effectiveCompanyId = Number(companyId || 0);
        if (!effectiveCompanyId || effectiveCompanyId <= 0) {
            const resolved = await this.resolveCompanyIdByEmitterDocument(parsedHeader.headerData.emitenteDocumento);
            if (!resolved) {
                const docFormatted = parsedHeader.headerData.emitenteDocumento || 'nao identificado';
                const docName = parsedHeader.headerData.emitenteNome ? ` (${parsedHeader.headerData.emitenteNome})` : '';
                throw new Error(`Nenhuma empresa cadastrada no sistema encontrada para o CNPJ/CPF emitente: ${docFormatted}${docName}.`);
            }
            effectiveCompanyId = resolved;
        } else {
            await this.assertNfeEmitterMatchesCompany(effectiveCompanyId, parsedHeader.headerData.emitenteDocumento);
        }

        await this.assertNfeNotDuplicated(effectiveCompanyId, parsedHeader.nfeKey);

        if (parsedItems.length === 0) {
            throw new Error('Nenhum item valido encontrado no XML da NFe.');
        }

        const allProducts = await ProductRepository.listByCompany(effectiveCompanyId);

        const matchedItems: Array<{ product_public_id: string; quantity: number; unit_price: number; xml_item_data?: Record<string, any> }> = [];
        const unmatchedItems: Array<{ sku: string | null; ean: string | null; name: string }> = [];

        for (const item of parsedItems) {
            const product = await this.resolveOrCreateProductForNfeItem(effectiveCompanyId, item, allProducts);

            if (!product) {
                unmatchedItems.push({ sku: item.sku, ean: item.ean, name: item.name });
                continue;
            }

            matchedItems.push({
                product_public_id: product.public_id,
                quantity: item.quantity,
                unit_price: item.unitPrice > 0 ? item.unitPrice : Number(product.selling_price || 0),
                xml_item_data: item.xmlItemData,
            });
        }

        if (matchedItems.length === 0) {
            throw new Error('Nao foi possivel processar itens validos da NFe para importacao.');
        }

        const bankAccountPublicId = data.bank_account_public_id
            || await this.resolveDefaultBankAccountPublicId(effectiveCompanyId);
        if (!bankAccountPublicId) {
            throw new Error('Nenhuma conta bancaria encontrada para a empresa.');
        }

        const categoryPublicId = data.category_public_id
            || await this.resolveDefaultIncomeCategoryPublicId(effectiveCompanyId);
        if (!categoryPublicId) {
            throw new Error('Nenhuma categoria de receita encontrada para a empresa.');
        }

        const customerPublicId = data.customer_public_id
            || await this.resolveCustomerPublicIdByDocument(effectiveCompanyId, xmlContent);

        // Auto preenche endereço de entrega se houver endereço do destinatário
        let deliveryAddress = data.delivery_address || null;
        if (!deliveryAddress && parsedHeader.headerData.dest?.enderDest) {
            const e = parsedHeader.headerData.dest.enderDest;
            const parts = [
                e.xLgr ? `${e.xLgr}, ${e.nro || 'S/N'}` : null,
                e.xCpl,
                e.xBairro,
                e.xMun && e.UF ? `${e.xMun}/${e.UF}` : (e.xMun || e.UF),
                e.CEP ? `CEP: ${e.CEP}` : null
            ].filter(Boolean);
            if (parts.length > 0) {
                deliveryAddress = parts.join(' - ');
            }
        }

        const sale = await this.createSalesOrder(effectiveCompanyId, userPublicId, {
            customer_public_id: customerPublicId,
            delivery_address: deliveryAddress,
            bank_account_public_id: bankAccountPublicId,
            category_public_id: categoryPublicId,
            date: data.date || this.resolveOrderDate(xmlContent),
            nfe_key: parsedHeader.nfeKey,
            nfe_issue_date: parsedHeader.nfeIssueDate,
            nfe_header_json: parsedHeader.headerData,
            nfe_xml: xmlContent,
            items: matchedItems,
        });

        return {
            sale,
            imported_items: matchedItems.length,
            unmatched_items: unmatchedItems,
        };
    }

    static async createPurchaseOrder(companyId: number, userPublicId: string, data: CreatePurchaseData): Promise<PurchaseOrder> {
        return OrderRepository.createPurchaseOrder(companyId, userPublicId, data);
    }

    static async createSalesOrder(companyId: number, userPublicId: string, data: CreateSalesData): Promise<SalesOrder> {
        return OrderRepository.createSalesOrder(companyId, userPublicId, data);
    }

    static async createQuote(companyId: number, userPublicId: string, data: CreateSalesData): Promise<SalesOrder> {
        return OrderRepository.createQuote(companyId, userPublicId, data);
    }

    static async getQuoteByPublicId(publicId: string, companyId: number): Promise<any> {
        return OrderRepository.getQuoteByPublicId(publicId, companyId);
    }

    static async updateQuote(publicId: string, companyId: number, data: CreateSalesData): Promise<SalesOrder> {
        return OrderRepository.updateQuote(publicId, companyId, data);
    }

    static async getPurchaseById(id: number, companyId: number): Promise<PurchaseOrder> {
        return OrderRepository.getPurchaseById(id, companyId);
    }

    static async getSaleById(id: number, companyId: number): Promise<SalesOrder> {
        return OrderRepository.getSaleById(id, companyId);
    }

    static async listSales(companyId: number, includeInactive = false): Promise<any[]> {
        return OrderRepository.listSales(companyId, includeInactive);
    }

    static async listQuotes(companyId: number, includeInactive = false): Promise<any[]> {
        return OrderRepository.listQuotes(companyId, includeInactive);
    }

    static async updateSaleStatus(id: number, companyId: number, status: string, nfeEmittedAt?: Date): Promise<void> {
        return OrderRepository.updateSaleStatus(id, companyId, status, nfeEmittedAt);
    }

    static async softDeleteSale(id: number, companyId: number): Promise<void> {
        return OrderRepository.softDeleteSale(id, companyId);
    }

    static async hardDeleteInactiveSale(id: number, companyId: number): Promise<void> {
        return OrderRepository.hardDeleteInactiveSale(id, companyId);
    }

    static async softDeleteSaleItem(saleId: number, itemId: number, companyId: number): Promise<void> {
        return OrderRepository.softDeleteSaleItem(saleId, itemId, companyId);
    }

    static async setSaleActive(id: number, companyId: number, isActive: boolean): Promise<void> {
        return OrderRepository.setSaleActive(id, companyId, isActive);
    }

    static async setSaleItemActive(saleId: number, itemId: number, companyId: number, isActive: boolean): Promise<void> {
        return OrderRepository.setSaleItemActive(saleId, itemId, companyId, isActive);
    }

    static async listSalesByCustomer(customerPublicId: string, companyId: number): Promise<any[]> {
        return OrderRepository.listSalesByCustomer(customerPublicId, companyId);
    }

    static async listPurchasesBySupplier(supplierPublicId: string, companyId: number): Promise<any[]> {
        return OrderRepository.listPurchasesBySupplier(supplierPublicId, companyId);
    }

    static async approveQuote(
        companyId: number,
        userId: string | number,
        publicId: string,
        data: ApproveQuoteData
    ): Promise<SalesOrder> {
        return OrderRepository.approveQuote(companyId, String(userId), publicId, data);
    }

    static async deleteQuoteByPublicId(publicId: string, companyId: number): Promise<void> {
        return OrderRepository.deleteQuoteByPublicId(publicId, companyId);
    }

    static async generateQuotePrintHTML(companyId: number, publicId: string): Promise<string> {
        const quote = await OrderRepository.getQuoteForPrint(publicId, companyId);
        
        const escapeHtml = (value: unknown): string =>
            String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');

        const formatPrintDate = (value: unknown): string => {
            if (!value) return '';
            const isoDate = toBrazilDate(value instanceof Date ? value : new Date(value as any));
            const [year, month, day] = isoDate.split('-');
            return year && month && day ? `${day}/${month}/${year}` : isoDate;
        };

        const formatBrazilDocument = (value: unknown): string => {
            const clean = String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            if (clean.length === 14) return clean.replace(/([a-zA-Z0-9]{2})([a-zA-Z0-9]{3})([a-zA-Z0-9]{3})([a-zA-Z0-9]{4})([a-zA-Z0-9]{2})/, '$1.$2.$3/$4-$5');
            if (clean.length === 11) return clean.replace(/([a-zA-Z0-9]{3})([a-zA-Z0-9]{3})([a-zA-Z0-9]{3})([a-zA-Z0-9]{2})/, '$1.$2.$3-$4');
            return String(value || '-');
        };

        const formatCurrency = (value: number): string => {
            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
        };

        const compLogoBase64 = String(quote.comp_logo_base64 || '').trim();
        const compLogoUrl = String(quote.comp_logo_url || '').trim();
        const compLogoSrc = compLogoBase64
            ? (compLogoBase64.startsWith('data:') ? compLogoBase64 : `data:image/jpeg;base64,${compLogoBase64}`)
            : compLogoUrl;
        const companyLogoHtml = compLogoSrc
            ? `<img class="company-logo" src="${escapeHtml(compLogoSrc)}" alt="Logo da empresa" />`
            : '';

        const customerAddressObj = {
            street: quote.customer_street || '',
            number: quote.customer_number || '',
            neighborhood: quote.customer_neighborhood || '',
            city: quote.customer_city || '',
            state: quote.customer_state || '',
            zip: quote.customer_zipcode || ''
        };
        const customerFullAddress = [
            customerAddressObj.street ? `${customerAddressObj.street}, ${customerAddressObj.number || 'S/N'}` : '',
            customerAddressObj.neighborhood,
            customerAddressObj.city ? `${customerAddressObj.city} - ${customerAddressObj.state}` : '',
            customerAddressObj.zip ? `CEP: ${customerAddressObj.zip.replace(/\D/g, '').replace(/^(\d{5})(\d{3})?.*$/, '$1-$2')}` : ''
        ].filter(Boolean).join(' | ');
        const customerAddressHtml = customerFullAddress ? escapeHtml(customerFullAddress) : 'Não informado';

        const compAddressObj = {
            street: quote.comp_street || '',
            number: quote.comp_number || '',
            neighborhood: quote.comp_neighborhood || '',
            city: quote.comp_city || '',
            state: quote.comp_state || '',
            zip: quote.comp_zipcode || ''
        };
        const compFullAddress = [
            compAddressObj.street ? `${compAddressObj.street}, ${compAddressObj.number || 'S/N'}` : '',
            compAddressObj.neighborhood,
            compAddressObj.city ? `${compAddressObj.city} - ${compAddressObj.state}` : '',
            compAddressObj.zip ? `CEP: ${compAddressObj.zip.replace(/\D/g, '').replace(/^(\d{5})(\d{3})?.*$/, '$1-$2')}` : ''
        ].filter(Boolean).join(' | ');
        const compAddressHtml = compFullAddress ? escapeHtml(compFullAddress) : 'Não informado';

        const items = quote.items || [];
        let totalVal = 0;
        const itemsHtml = items.map((item: any) => {
            const subtotal = Number(item.quantity) * Number(item.unit_price);
            totalVal += subtotal;
            const displayName = item.description ? `${item.description} (${item.product_name})` : item.product_name;
            return `
                <tr>
                    <td>${escapeHtml(displayName)}</td>
                    <td class="text-right">${Number(item.quantity)}</td>
                    <td class="text-right">${formatCurrency(Number(item.unit_price))}</td>
                    <td class="text-right font-medium">${formatCurrency(subtotal)}</td>
                </tr>
            `;
        }).join('');

        const obsHtml = quote.observation
            ? `
            <div class="section">
                <div class="section-title">Observações</div>
                <div class="value font-medium" style="white-space: pre-wrap;">${escapeHtml(quote.observation)}</div>
            </div>
            `
            : '';

        return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Orçamento #${String(quote.id).padStart(4, '0')}</title>
    <style>
        body { font-family: Arial, sans-serif; color: #111827; margin: 0; background: #f9fafb; }
        .page { max-width: 720px; margin: 24px auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 24px; }
        .header { display: flex; justify-content: space-between; gap: 16px; border-bottom: 1px solid #e5e7eb; padding-bottom: 16px; margin-bottom: 16px; }
        .company-info { display: flex; align-items: center; gap: 14px; min-width: 0; }
        .company-logo { width: 82px; height: 82px; object-fit: contain; border: 1px solid #e5e7eb; border-radius: 8px; padding: 6px; background: #fff; flex: 0 0 auto; }
        .title { font-size: 18px; font-weight: 700; margin: 0 0 6px; }
        .subtitle { font-size: 12px; color: #6b7280; margin: 0; }
        .meta { text-align: right; font-size: 12px; color: #374151; }
        .label { font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.04em; }
        .value { font-size: 13px; font-weight: 600; color: #111827; margin-top: 3px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 12px; }
        .section { margin-top: 18px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
        .section-title { font-size: 13px; font-weight: 700; color: #111827; margin-bottom: 8px; }
        .amount { font-size: 20px; font-weight: 700; color: #047857; }
        
        .items-table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
        .items-table th { background: #f3f4f6; color: #374151; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.04em; padding: 8px 12px; text-align: left; }
        .items-table td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; color: #111827; }
        .items-table th.text-right, .items-table td.text-right { text-align: right; }
        .font-medium { font-weight: 500; }
        
        @media print { body { background: #fff; } .page { border: none; box-shadow: none; margin: 0; border-radius: 0; padding: 0; } }
    </style>
</head>
<body>
    <div class="page">
        <div class="header">
            <div class="company-info">
                ${companyLogoHtml}
                <div>
                    <p class="title">Orçamento #${String(quote.id).padStart(4, '0')}</p>
                    <p class="subtitle" style="font-weight:600;">${escapeHtml(quote.comp_name)}</p>
                    ${quote.comp_company_name ? `<p class="subtitle">${escapeHtml(quote.comp_company_name)}</p>` : ''}
                    <p class="subtitle">CNPJ: ${escapeHtml(formatBrazilDocument(quote.comp_doc))}</p>
                    <p class="subtitle">Endereço: ${compAddressHtml}</p>
                    ${quote.comp_phone ? `<p class="subtitle">Telefone: ${escapeHtml(quote.comp_phone)}</p>` : ''}
                    ${quote.comp_email ? `<p class="subtitle">E-mail: ${escapeHtml(quote.comp_email)}</p>` : ''}
                </div>
            </div>
            <div class="meta">
                <div>
                    <div class="label">Emissão</div>
                    <div class="value">${escapeHtml(formatPrintDate(quote.date || quote.created_at))}</div>
                </div>
                ${quote.validity_date ? `
                <div style="margin-top: 8px;">
                    <div class="label">Validade</div>
                    <div class="value">${escapeHtml(formatPrintDate(quote.validity_date))}</div>
                </div>
                ` : ''}
            </div>
        </div>

        <div class="grid">
            <div>
                <div class="label">Cliente</div>
                <div class="value">${escapeHtml(quote.customer_name || 'Não informado')}</div>
                <div class="label" style="margin-top:10px;">CNPJ/CPF</div>
                <div class="value">${escapeHtml(formatBrazilDocument(quote.customer_document))}</div>
                <div class="label" style="margin-top:10px;">Endereço</div>
                <div class="value" style="font-weight: 500;">${customerAddressHtml}</div>
                ${quote.customer_phone ? `
                <div class="label" style="margin-top:10px;">Telefone</div>
                <div class="value">${escapeHtml(quote.customer_phone)}</div>
                ` : ''}
                ${quote.customer_email ? `
                <div class="label" style="margin-top:10px;">E-mail</div>
                <div class="value">${escapeHtml(quote.customer_email)}</div>
                ` : ''}
            </div>
            <div>
                <div class="label">Resumo do Orçamento</div>
                <div class="label" style="margin-top:10px;">Vendedor</div>
                <div class="value">${escapeHtml(quote.seller_name || '-')}</div>
                ${quote.brand ? `
                <div class="label" style="margin-top:10px;">Marca</div>
                <div class="value">${escapeHtml(quote.brand)}</div>
                ` : ''}
                ${quote.payment_method ? `
                <div class="label" style="margin-top:10px;">Forma de Pagamento</div>
                <div class="value">${escapeHtml(quote.payment_method)}</div>
                ` : ''}
                ${quote.payment_terms ? `
                <div class="label" style="margin-top:10px;">Prazo/Parcelamento</div>
                <div class="value">${escapeHtml(quote.payment_terms)}</div>
                ` : ''}
            </div>
        </div>

        <div class="section">
            <div class="section-title">Itens do Orçamento</div>
            <table class="items-table">
                <thead>
                    <tr>
                        <th>Descrição do Item</th>
                        <th class="text-right" style="width: 80px;">Qtd</th>
                        <th class="text-right" style="width: 120px;">Preço Unit.</th>
                        <th class="text-right" style="width: 120px;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>
        </div>

        <div class="section" style="display: flex; justify-content: space-between; align-items: center;">
            <div></div>
            <div style="text-align: right;">
                <div class="label">Valor Total do Orçamento</div>
                <div class="amount" style="margin-top: 4px;">${formatCurrency(totalVal)}</div>
            </div>
        </div>

        ${obsHtml}
    </div>
</body>
</html>`;
    }
}

