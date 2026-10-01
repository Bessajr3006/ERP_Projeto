import { PosControlConfigService } from './posControlConfigService';
import { EstoqueRepository } from '../repositories/estoqueRepository';
import { ProductTypeRepository } from '../repositories/productTypeRepository';
import { ProductRepository } from '../repositories/productRepository';
import pool from '../config/db';
import logger from '../config/logger';

export class PosControlSyncService {
    private static getEndpoint(urlToken: string | null | undefined, endpoint: string): string {
        const baseTokenUrl = urlToken || 'https://api.poscontrole.com.br/v2/auth/token';
        try {
            const parsed = new URL(baseTokenUrl);
            let pathname = parsed.pathname;
            if (pathname.endsWith('/auth/token')) {
                pathname = pathname.substring(0, pathname.length - '/auth/token'.length);
            } else if (pathname.endsWith('/token')) {
                pathname = pathname.substring(0, pathname.length - '/token'.length);
            }
            if (!pathname.endsWith('/')) {
                pathname += '/';
            }
            parsed.pathname = pathname + endpoint;
            return parsed.toString();
        } catch {
            return `https://api.poscontrole.com.br/v2/${endpoint}`;
        }
    }

    private static async getActiveStatusId(cfg: any, jwt: string): Promise<string> {
        try {
            const statustypesUrl = this.getEndpoint(cfg.url_token, 'statustypes');
            let targetUrl = statustypesUrl;
            if (cfg.subscription_key) {
                try {
                    const urlObj = new URL(targetUrl);
                    urlObj.searchParams.set('subscription-key', cfg.subscription_key);
                    targetUrl = urlObj.toString();
                } catch {}
            }

            const headers: any = {
                'Accept': 'application/json',
                'Authorization': `Bearer ${jwt}`
            };
            if (cfg.ocp_apim_subscription_key) {
                headers['Ocp-Apim-Subscription-Key'] = cfg.ocp_apim_subscription_key;
            }

            logger.info(`[PosControlSyncService] Buscando StatusID de: ${targetUrl}`);
            const response = await fetch(targetUrl, {
                method: 'GET',
                headers
            });

            if (response.ok) {
                const data = await response.json();
                logger.info({ data }, '[PosControlSyncService] Resposta de statustypes');
                
                let list: any[] = [];
                if (Array.isArray(data)) {
                    list = data;
                } else if (data && Array.isArray(data.Result)) {
                    list = data.Result;
                } else if (data && Array.isArray(data.Status)) {
                    list = data.Status;
                } else if (data && typeof data === 'object') {
                    const foundArray = Object.values(data).find(val => Array.isArray(val));
                    if (foundArray) {
                        list = foundArray as any[];
                    }
                }

                for (const item of list) {
                    const statusObj = item?.Product || item?.Status || item?.StatusType || item;
                    const name = statusObj?.Name || '';
                    const shortName = statusObj?.ShortName || '';
                    if (
                        name.toLowerCase().includes('ativo') || 
                        name.toLowerCase().includes('active') ||
                        name.toLowerCase().includes('habilitado') ||
                        name.toLowerCase().includes('enabled') ||
                        shortName.toLowerCase() === 'ati' ||
                        shortName.toLowerCase() === 'act' ||
                        shortName.toLowerCase() === 'hab'
                    ) {
                        const statusId = String(statusObj?.StatusID || '');
                        if (statusId) {
                            logger.info(`[PosControlSyncService] Encontrado StatusID ativo: ${statusId} (${name})`);
                            return statusId;
                        }
                    }
                }

                if (list.length > 0) {
                    const statusObj = list[0]?.Product || list[0]?.Status || list[0]?.StatusType || list[0];
                    const statusId = String(statusObj?.StatusID || '');
                    if (statusId) {
                        logger.info(`[PosControlSyncService] Fallback para o primeiro StatusID: ${statusId}`);
                        return statusId;
                    }
                }
            } else {
                const errText = await response.text();
                logger.error(`[PosControlSyncService] Falha na chamada a statustypes: ${response.statusText} (${response.status}) - ${errText}`);
            }
        } catch (err) {
            logger.error({ err }, '[PosControlSyncService] Erro ao buscar StatusID ativo.');
        }

        return '1';
    }

    static async getAuthToken(cfg: any): Promise<string> {
        if (!cfg.poscontrol_username || !cfg.poscontrol_password) {
            throw new Error('Configuração de autenticação incompleta (Usuário ou Senha ausentes).');
        }

        const params = new URLSearchParams();
        params.append('username', cfg.poscontrol_username);
        params.append('password', cfg.poscontrol_password);

        const headers: any = {
            'Content-Type': 'application/x-www-form-urlencoded'
        };

        if (cfg.ocp_apim_subscription_key) {
            headers['Ocp-Apim-Subscription-Key'] = cfg.ocp_apim_subscription_key;
        }

        let url = cfg.url_token || 'https://api.poscontrole.com.br/v2/auth/token';
        if (cfg.subscription_key) {
            try {
                const urlObj = new URL(url);
                urlObj.searchParams.set('subscription-key', cfg.subscription_key);
                url = urlObj.toString();
            } catch {}
        }

        logger.info(`[PosControlSyncService] Efetuando autenticação em: ${url}`);
        
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: params.toString()
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Falha na autenticação do PosControl: ${response.statusText} (${response.status}) - ${errText}`);
        }

        const data = await response.json() as any;
        if (Array.isArray(data) && data.length > 0 && data[0].jwt) {
            return data[0].jwt;
        } else if (data && data.jwt) {
            return data.jwt;
        }

        throw new Error('Resposta de autenticação inválida (JWT não encontrado).');
    }

    static async syncCategories(companyId: number, configId: number, categories: any): Promise<any> {
        const configs = await PosControlConfigService.list(companyId);
        const cfg = configs.find(c => c.id === configId);
        if (!cfg) {
            throw new Error('Credencial do PosControl não encontrada.');
        }

        const jwt = await this.getAuthToken(cfg);
        const activeStatusId = await this.getActiveStatusId(cfg, jwt);
        const inactiveStatusId = await this.getInactiveStatusId(cfg, jwt);

        let list: any[] = [];
        let isRootObject = false;

        if (categories && typeof categories === 'object' && !Array.isArray(categories)) {
            if (Array.isArray(categories.ProductGroups)) {
                list = categories.ProductGroups;
                isRootObject = true;
            } else {
                list = [categories];
            }
        } else if (Array.isArray(categories)) {
            list = categories;
        }

        const mappedList = list.map(c => {
            const pg = c.ProductGroup || c;
            if (pg) {
                if (pg.StatusID === '0' || pg.StatusID === 'inactive' || pg.StatusID === '2') {
                    pg.StatusID = inactiveStatusId;
                } else {
                    pg.StatusID = activeStatusId;
                }
            }
            return c;
        });

        const productgroupsUrl = this.getEndpoint(cfg.url_token, 'productgroups');

        let targetUrl = productgroupsUrl;
        if (cfg.subscription_key) {
            try {
                const urlObj = new URL(targetUrl);
                urlObj.searchParams.set('subscription-key', cfg.subscription_key);
                targetUrl = urlObj.toString();
            } catch {}
        }

        const headers: any = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwt}`
        };

        if (cfg.ocp_apim_subscription_key) {
            headers['Ocp-Apim-Subscription-Key'] = cfg.ocp_apim_subscription_key;
        }

        const batchSize = 25;
        const results: any[] = [];

        logger.info(`[PosControlSyncService] Iniciando sincronização de ${mappedList.length} categorias em lotes de ${batchSize}...`);

        for (let i = 0; i < mappedList.length; i += batchSize) {
            const chunk = mappedList.slice(i, i + batchSize);
            const batchNum = Math.floor(i / batchSize) + 1;
            const bodyPayload = isRootObject ? { ProductGroups: chunk } : chunk;

            logger.info(`[PosControlSyncService] Enviando lote ${batchNum} (${chunk.length} categorias) para: ${targetUrl}`);

            const response = await fetch(targetUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(bodyPayload)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Erro ao sincronizar lote de categorias ${batchNum}: ${response.statusText} (${response.status}) - ${errText}`);
            }

            const resJson = await response.json();
            if (resJson && typeof resJson === 'object' && !Array.isArray(resJson)) {
                if (resJson.retorno === null) {
                    const detail = resJson.mensagem || resJson.erro || resJson.message || resJson.errors || JSON.stringify(resJson);
                    throw new Error(`A API do Pos-Control rejeitou a sincronização (retorno: null). Detalhes da API: ${detail}`);
                }
            }
            results.push(resJson);
        }

        // Fetch the full categories list from Pos-Controll GET /productgroups to get their IDs
        let fullList: any[] = [];
        try {
            logger.info(`[PosControlSyncService] Buscando lista atualizada de categorias de: ${targetUrl}`);
            const getResponse = await fetch(targetUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${jwt}`,
                    ...(cfg.ocp_apim_subscription_key ? { 'Ocp-Apim-Subscription-Key': cfg.ocp_apim_subscription_key } : {})
                }
            });

            if (getResponse.ok) {
                const getData = await getResponse.json();
                if (Array.isArray(getData)) {
                    fullList = getData;
                } else if (getData && Array.isArray(getData.Result)) {
                    fullList = getData.Result;
                } else if (getData && Array.isArray(getData.ProductGroups)) {
                    fullList = getData.ProductGroups;
                } else if (getData && typeof getData === 'object') {
                    const foundArray = Object.values(getData).find(val => Array.isArray(val));
                    if (foundArray) {
                        fullList = foundArray as any[];
                    }
                }
            }
        } catch (err) {
            logger.error({ err }, '[PosControlSyncService] Erro ao buscar lista de categorias pós-sincronização.');
        }

        return { success: true, batches: results.length, details: [ ...results, fullList ] };
    }

    static async syncProducts(companyId: number, configId: number, products: any[]): Promise<any> {
        const configs = await PosControlConfigService.list(companyId);
        const cfg = configs.find(c => c.id === configId);
        if (!cfg) {
            throw new Error('Credencial do PosControl não encontrada.');
        }

        const jwt = await this.getAuthToken(cfg);
        const activeStatusId = await this.getActiveStatusId(cfg, jwt);
        const inactiveStatusId = await this.getInactiveStatusId(cfg, jwt);
        const mappedProducts = products.map(p => {
            const prod = p.Product || p;
            if (prod) {
                // Truncate Name and NameEng to maximum 50 characters
                if (prod.Name) {
                    prod.Name = String(prod.Name).substring(0, 50);
                }
                if (prod.NameEng) {
                    prod.NameEng = String(prod.NameEng).substring(0, 50);
                }

                if (prod.StatusID === '0' || prod.StatusID === 'inactive' || prod.StatusID === '2' || prod.StatusID === 'ABCDEABC-ABCD-ABCD-ABCD-ABCED1457822' || prod.StatusID === inactiveStatusId) {
                    prod.StatusID = inactiveStatusId;
                } else if (prod.StatusID && prod.StatusID !== '1' && prod.StatusID !== 'active' && prod.StatusID !== activeStatusId) {
                    if (prod.StatusID.length === 36) {
                        // Keep it!
                    } else {
                        prod.StatusID = activeStatusId;
                    }
                } else {
                    prod.StatusID = activeStatusId;
                }
            }
            return p;
        });

        const productsUrl = this.getEndpoint(cfg.url_token, 'products');

        let targetUrl = productsUrl;
        if (cfg.subscription_key) {
            try {
                const urlObj = new URL(targetUrl);
                urlObj.searchParams.set('subscription-key', cfg.subscription_key);
                targetUrl = urlObj.toString();
            } catch {}
        }

        const headers: any = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwt}`
        };

        if (cfg.ocp_apim_subscription_key) {
            headers['Ocp-Apim-Subscription-Key'] = cfg.ocp_apim_subscription_key;
        }

        const batchSize = 25;
        const results: any[] = [];
        const failures: any[] = [];
        let sentCount = 0;
        let failedCount = 0;

        logger.info(`[PosControlSyncService] Iniciando sincronização de ${mappedProducts.length} produtos em lotes de ${batchSize}...`);

        for (let i = 0; i < mappedProducts.length; i += batchSize) {
            const chunk = mappedProducts.slice(i, i + batchSize);
            const batchNum = Math.floor(i / batchSize) + 1;
            logger.info(`[PosControlSyncService] Enviando lote ${batchNum} (${chunk.length} produtos) para: ${targetUrl}`);

            try {
                const response = await fetch(targetUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(chunk)
                });

                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`Status ${response.status}: ${errText || response.statusText}`);
                }

                const resJson = await response.json();
                if (resJson && typeof resJson === 'object' && !Array.isArray(resJson) && resJson.retorno === null) {
                    const detail = resJson.mensagem || resJson.erro || resJson.message || resJson.errors || JSON.stringify(resJson);
                    throw new Error(`Rejeitado pelo Pos-Control: ${detail}`);
                }

                // Batch succeeded!
                results.push(resJson);
                sentCount += chunk.length;
            } catch (batchError: any) {
                logger.warn(`[PosControlSyncService] Lote ${batchNum} falhou (${batchError.message}). Iniciando retransmissão individual para este lote...`);
                
                // Fallback: sync products in this batch one-by-one
                for (const item of chunk) {
                    const prod = item.Product || item;
                    const productName = prod?.Name || 'Produto sem nome';
                    const productSku = prod?.InternalCode || 'Sem SKU';
                    
                    try {
                        const response = await fetch(targetUrl, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify([item])
                        });

                        if (!response.ok) {
                            const errText = await response.text();
                            
                            if (response.status === 404) {
                                try {
                                    const resJson = JSON.parse(errText);
                                    if (resJson && Array.isArray(resJson.Result)) {
                                        const sku = resJson.Result[0];
                                        const posId = resJson.Result[1];
                                        
                                        // Clear invalid idprodutopos and status in database
                                        await pool.query(
                                            'UPDATE products SET idprodutopos = NULL, poscontrol_synced = 0 WHERE company_id = ? AND (sku = ? OR idprodutopos = ?)',
                                            [companyId, sku, posId]
                                        );
                                    }
                                } catch {}
                            }
                            throw new Error(`Erro ${response.status}: ${errText || response.statusText}`);
                        }

                        const resJson = await response.json();
                        if (resJson && typeof resJson === 'object' && !Array.isArray(resJson) && resJson.retorno === null) {
                            const detail = resJson.mensagem || resJson.erro || resJson.message || resJson.errors || JSON.stringify(resJson);
                            throw new Error(`Rejeitado pelo Pos-Control: ${detail}`);
                        }

                        // Single product succeeded!
                        results.push(resJson);
                        sentCount++;
                    } catch (itemError: any) {
                        logger.error(`[PosControlSyncService] Falha ao sincronizar produto individual "${productName}" (SKU: ${productSku}): ${itemError.message}`);
                        failedCount++;
                        failures.push({
                            sku: productSku,
                            name: productName,
                            error: itemError.message
                        });
                    }
                }
            }
        }

        // Fetch the full products list from Pos-Controll GET /products to get their IDs
        let fullProdList: any[] = [];
        try {
            logger.info(`[PosControlSyncService] Buscando lista atualizada de produtos de: ${targetUrl}`);
            const getResponse = await fetch(targetUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${jwt}`,
                    ...(cfg.ocp_apim_subscription_key ? { 'Ocp-Apim-Subscription-Key': cfg.ocp_apim_subscription_key } : {})
                }
            });

            if (getResponse.ok) {
                const getData = await getResponse.json();
                if (Array.isArray(getData)) {
                    fullProdList = getData;
                } else if (getData && Array.isArray(getData.Result)) {
                    fullProdList = getData.Result;
                } else if (getData && Array.isArray(getData.Products)) {
                    fullProdList = getData.Products;
                } else if (getData && typeof getData === 'object') {
                    const foundArray = Object.values(getData).find(val => Array.isArray(val));
                    if (foundArray) {
                        fullProdList = foundArray as any[];
                    }
                }
            }
        } catch (err) {
            logger.error({ err }, '[PosControlSyncService] Erro ao buscar lista de produtos pós-sincronização.');
        }

        return { success: true, batches: results.length, details: [ ...results, fullProdList ], sentCount, failedCount, failures };
    }

    private static getAbbreviation(name: string): string {
        const n = name.trim().toLowerCase();
        if (n === 'unidade' || n === 'unidades') return 'UN';
        if (n === 'quilograma' || n === 'quilogramas' || n === 'quilo') return 'KG';
        if (n === 'grama' || n === 'gramas') return 'G';
        if (n === 'litro' || n === 'litros') return 'L';
        if (n === 'mililitro' || n === 'mililitros') return 'ML';
        if (n === 'caixa' || n === 'caixas') return 'CX';
        if (n === 'pacote' || n === 'pacotes') return 'PCT';
        if (n === 'par' || n === 'pares') return 'PR';
        if (n === 'metro' || n === 'metros') return 'M';
        if (n === 'centimetro' || n === 'centímetros') return 'CM';
        if (n === 'milimetro' || n === 'milímetros') return 'MM';
        if (n === 'duzia' || n === 'dúzia' || n === 'duzias') return 'DZ';
        if (n === 'fardo' || n === 'fardos') return 'FD';
        if (n === 'lata' || n === 'latas') return 'LT';
        if (n === 'garrafa' || n === 'garrafas') return 'GF';
        if (n === 'rolo' || n === 'rolos') return 'RL';
        if (n === 'bloco' || n === 'blocos') return 'BL';
        if (n === 'balde' || n === 'baldes') return 'BD';
        if (n === 'saco' || n === 'sacos') return 'SC';
        if (n === 'bisnaga' || n === 'bisnagas') return 'BS';
        if (n === 'cartela' || n === 'cartelas') return 'CT';
        if (n === 'kit' || n === 'kits') return 'KIT';
        if (n === 'milhar' || n === 'milhares') return 'MIL';
        if (n === 'cento' || n === 'centos') return 'CEN';
        if (n === 'folha' || n === 'folhas') return 'FL';
        if (n === 'resma' || n === 'resmas') return 'RM';
        if (n === 'tubo' || n === 'tubos') return 'TB';
        if (n === 'tonelada' || n === 'toneladas') return 'TON';

        return name.substring(0, 3).toUpperCase();
    }

    static async importUnitTypes(companyId: number, configId: number): Promise<{ imported: number, skipped: number }> {
        const configs = await PosControlConfigService.list(companyId);
        const cfg = configs.find(c => c.id === configId);
        if (!cfg) {
            throw new Error('Credencial do PosControl não encontrada.');
        }

        const jwt = await this.getAuthToken(cfg);
        const unittypesUrl = this.getEndpoint(cfg.url_token, 'unittypes');

        let targetUrl = unittypesUrl;
        if (cfg.subscription_key) {
            try {
                const urlObj = new URL(targetUrl);
                urlObj.searchParams.set('subscription-key', cfg.subscription_key);
                targetUrl = urlObj.toString();
            } catch {}
        }

        const headers: any = {
            'Authorization': `Bearer ${jwt}`,
            'Accept': 'application/json'
        };

        if (cfg.ocp_apim_subscription_key) {
            headers['Ocp-Apim-Subscription-Key'] = cfg.ocp_apim_subscription_key;
        }

        logger.info(`[PosControlSyncService] Buscando tipos de unidade de: ${targetUrl}`);

        const response = await fetch(targetUrl, {
            method: 'GET',
            headers
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Falha ao buscar tipos de unidade do Pos-Controll: ${response.statusText} (${response.status}) - ${errText}`);
        }

        const data = await response.json();
        
        let list: any[] = [];
        if (Array.isArray(data)) {
            list = data;
        } else if (data && Array.isArray(data.Result)) {
            list = data.Result;
        } else if (data && Array.isArray(data.UnitTypes)) {
            list = data.UnitTypes;
        } else if (data && typeof data === 'object') {
            const foundArray = Object.values(data).find(val => Array.isArray(val));
            if (foundArray) {
                list = foundArray as any[];
            }
        }

        let imported = 0;
        let skipped = 0;

        for (const item of list) {
            const unitType = item?.UnitType || item;
            const name = unitType?.Name;
            if (!name) continue;

            const abbreviation = this.getAbbreviation(name);
            
            // Check if already exists in database
            const existing = await EstoqueRepository.getMeasureByNameOrAbbreviation(companyId, name);
            const existingAbbr = await EstoqueRepository.getMeasureByNameOrAbbreviation(companyId, abbreviation);

            if (existing || existingAbbr) {
                skipped++;
                continue;
            }

            await EstoqueRepository.createMeasure(companyId, {
                name,
                abbreviation,
                idmedidapos: String(unitType?.UnitTypeID || '')
            });
            imported++;
        }

        return { imported, skipped };
    }

    static async importProductTypes(companyId: number, configId: number): Promise<{ imported: number, skipped: number }> {
        const configs = await PosControlConfigService.list(companyId);
        const cfg = configs.find(c => c.id === configId);
        if (!cfg) {
            throw new Error('Credencial do PosControl não encontrada.');
        }

        const jwt = await this.getAuthToken(cfg);
        const producttypesUrl = this.getEndpoint(cfg.url_token, 'producttypes');

        let targetUrl = producttypesUrl;
        if (cfg.subscription_key) {
            try {
                const urlObj = new URL(targetUrl);
                urlObj.searchParams.set('subscription-key', cfg.subscription_key);
                targetUrl = urlObj.toString();
            } catch {}
        }

        const headers: any = {
            'Authorization': `Bearer ${jwt}`,
            'Accept': 'application/json'
        };

        if (cfg.ocp_apim_subscription_key) {
            headers['Ocp-Apim-Subscription-Key'] = cfg.ocp_apim_subscription_key;
        }

        logger.info(`[PosControlSyncService] Buscando tipos de produto de: ${targetUrl}`);

        const response = await fetch(targetUrl, {
            method: 'GET',
            headers
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Falha ao buscar tipos de produto do Pos-Controll: ${response.statusText} (${response.status}) - ${errText}`);
        }

        const data = await response.json();
        
        let list: any[] = [];
        if (Array.isArray(data)) {
            list = data;
        } else if (data && Array.isArray(data.Result)) {
            list = data.Result;
        } else if (data && Array.isArray(data.ProductTypes)) {
            list = data.ProductTypes;
        } else if (data && typeof data === 'object') {
            const foundArray = Object.values(data).find(val => Array.isArray(val));
            if (foundArray) {
                list = foundArray as any[];
            }
        }

        let imported = 0;
        let skipped = 0;

        for (const item of list) {
            const prodType = item?.ProductType || item;
            const name = prodType?.Name;
            if (!name) continue;

            const idprodutotipopos = String(prodType?.ProductTypeID || '');
            
            const existing = await ProductTypeRepository.getByNameOrPosId(companyId, name, idprodutotipopos);

            if (existing) {
                skipped++;
                continue;
            }

            await ProductTypeRepository.create(companyId, {
                name,
                description: null,
                idprodutotipopos
            });
            imported++;
        }

        return { imported, skipped };
    }

    static async fetchProducts(companyId: number, configId: number): Promise<any[]> {
        const configs = await PosControlConfigService.list(companyId);
        const cfg = configs.find(c => c.id === configId);
        if (!cfg) {
            throw new Error('Credencial do PosControl não encontrada.');
        }

        const jwt = await this.getAuthToken(cfg);
        const productsUrl = this.getEndpoint(cfg.url_token, 'products');

        let targetUrl = productsUrl;
        if (cfg.subscription_key) {
            try {
                const urlObj = new URL(targetUrl);
                urlObj.searchParams.set('subscription-key', cfg.subscription_key);
                targetUrl = urlObj.toString();
            } catch {}
        }

        const headers: any = {
            'Authorization': `Bearer ${jwt}`,
            'Accept': 'application/json'
        };

        if (cfg.ocp_apim_subscription_key) {
            headers['Ocp-Apim-Subscription-Key'] = cfg.ocp_apim_subscription_key;
        }

        logger.info(`[PosControlSyncService] Buscando produtos de: ${targetUrl}`);

        const response = await fetch(targetUrl, {
            method: 'GET',
            headers
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Falha ao buscar produtos do Pos-Controll: ${response.statusText} (${response.status}) - ${errText}`);
        }

        const data = await response.json();
        
        let list: any[] = [];
        if (Array.isArray(data)) {
            list = data;
        } else if (data && Array.isArray(data.Result)) {
            list = data.Result;
        } else if (data && Array.isArray(data.Products)) {
            list = data.Products;
        } else if (data && typeof data === 'object') {
            const foundArray = Object.values(data).find(val => Array.isArray(val));
            if (foundArray) {
                list = foundArray as any[];
            }
        }
        return list;
    }

    static async importProducts(companyId: number, configId: number, customProducts?: any[]): Promise<{ imported: number, updated: number, failed: number }> {
        let list: any[] = [];

        if (customProducts) {
            if (Array.isArray(customProducts)) {
                list = customProducts;
            } else if (customProducts && typeof customProducts === 'object') {
                list = [customProducts];
            }
        } else {
            list = await this.fetchProducts(companyId, configId);
        }

        let imported = 0;
        let updated = 0;
        let failed = 0;

        for (const item of list) {
            try {
                const prod = item?.Product || item;
                const name = prod?.Name;
                if (!name) continue;

                const idprodutopos = String(prod?.ProductID || '');
                if (!idprodutopos) continue;

                const sku = prod?.InternalCode || null;
                const ean = prod?.BarCode || null;
                const ncm = prod?.NFCeNCM || null;
                const cest = prod?.NFCeCEST || null;
                const costPrice = parseFloat(prod?.CostPrice || '0') || 0;
                const sellingPrice = parseFloat(prod?.SalePrice || '0') || 0;

                // Look up relations
                let category_id: number | null = null;
                if (prod?.ProductGroupID) {
                    const [catRows] = await pool.query<any[]>(
                        'SELECT id FROM product_categories WHERE company_id = ? AND idgrupopos = ? LIMIT 1',
                        [companyId, String(prod.ProductGroupID)]
                    );
                    if (catRows.length > 0) category_id = catRows[0].id;
                }

                let product_type_id: number | null = null;
                if (prod?.ProductTypeID) {
                    const [ptRows] = await pool.query<any[]>(
                        'SELECT id FROM product_types WHERE company_id = ? AND idprodutotipopos = ? LIMIT 1',
                        [companyId, String(prod.ProductTypeID)]
                    );
                    if (ptRows.length > 0) product_type_id = ptRows[0].id;
                }

                let measure_id: number | null = null;
                if (prod?.UnitTypeID) {
                    const [mRows] = await pool.query<any[]>(
                        'SELECT id FROM measures WHERE company_id = ? AND idmedidapos = ? LIMIT 1',
                        [companyId, String(prod.UnitTypeID)]
                    );
                    if (mRows.length > 0) measure_id = mRows[0].id;
                }

                // Check if product exists by idprodutopos
                let existing = await ProductRepository.getByPosId(companyId, idprodutopos);

                // If not found, check by SKU or EAN
                if (!existing && (sku || ean)) {
                    existing = await ProductRepository.getBySkuOrEan(companyId, sku, ean);
                }

                // Determine active status
                let active = true;
                if (prod?.StatusID) {
                    const statusStr = String(prod.StatusID).toLowerCase();
                    if (statusStr === 'ABCDEABC-ABCD-ABCD-ABCD-ABCED1457822'.toLowerCase() || statusStr === 'inactive' || statusStr === '0' || statusStr === '2') {
                        active = false;
                    }
                }

                if (existing) {
                    // Update existing product
                    await ProductRepository.update(existing.public_id, companyId, {
                        name,
                        sku: sku || existing.sku,
                        ean: ean || existing.ean,
                        ncm: ncm || existing.ncm,
                        cest: cest || existing.cest,
                        cost_price: costPrice || existing.cost_price,
                        selling_price: sellingPrice || existing.selling_price,
                        category_id: category_id || existing.category_id,
                        product_type_id: product_type_id || existing.product_type_id,
                        measure_id: measure_id || existing.measure_id,
                        idprodutopos,
                        status_pos_id: prod?.StatusID || null,
                        active,
                        poscontrol_synced: true
                    });
                    updated++;
                } else {
                    // Create new product
                    await ProductRepository.create(companyId, {
                        name,
                        sku: sku || undefined,
                        ean: ean || undefined,
                        ncm: ncm || undefined,
                        cest: cest || undefined,
                        cost_price: costPrice,
                        selling_price: sellingPrice,
                        category_id,
                        product_type_id,
                        measure_id,
                        idprodutopos,
                        status_pos_id: prod?.StatusID || null,
                        active,
                        poscontrol_synced: true,
                        initial_stock: 0
                    });
                    imported++;
                }
            } catch (err) {
                logger.error({ err, item }, '[PosControlSyncService] Erro ao importar produto individual do Pos-Control');
                failed++;
            }
        }

        return { imported, updated, failed };
    }

    static async fetchCategories(companyId: number, configId: number): Promise<any[]> {
        const configs = await PosControlConfigService.list(companyId);
        const cfg = configs.find(c => c.id === configId);
        if (!cfg) {
            throw new Error('Credencial do PosControl não encontrada.');
        }

        const jwt = await this.getAuthToken(cfg);
        const productgroupsUrl = this.getEndpoint(cfg.url_token, 'productgroups');

        let targetUrl = productgroupsUrl;
        if (cfg.subscription_key) {
            try {
                const urlObj = new URL(targetUrl);
                urlObj.searchParams.set('subscription-key', cfg.subscription_key);
                targetUrl = urlObj.toString();
            } catch {}
        }

        const headers: any = {
            'Authorization': `Bearer ${jwt}`,
            'Accept': 'application/json'
        };

        if (cfg.ocp_apim_subscription_key) {
            headers['Ocp-Apim-Subscription-Key'] = cfg.ocp_apim_subscription_key;
        }

        logger.info(`[PosControlSyncService] Buscando grupos de produto de: ${targetUrl}`);

        const response = await fetch(targetUrl, {
            method: 'GET',
            headers
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Falha ao buscar grupos de produto do Pos-Controll: ${response.statusText} (${response.status}) - ${errText}`);
        }

        const data = await response.json();
        
        let list: any[] = [];
        if (Array.isArray(data)) {
            list = data;
        } else if (data && Array.isArray(data.Result)) {
            list = data.Result;
        } else if (data && Array.isArray(data.ProductGroups)) {
            list = data.ProductGroups;
        } else if (data && typeof data === 'object') {
            const foundArray = Object.values(data).find(val => Array.isArray(val));
            if (foundArray) {
                list = foundArray as any[];
            }
        }
        return list;
    }

    static async importCategories(companyId: number, configId: number, customCategories?: any[]): Promise<{ imported: number, updated: number, failed: number }> {
        let list: any[] = [];

        if (customCategories) {
            if (Array.isArray(customCategories)) {
                list = customCategories;
            } else if (customCategories && typeof customCategories === 'object') {
                list = [customCategories];
            }
        } else {
            list = await this.fetchCategories(companyId, configId);
        }

        let imported = 0;
        let updated = 0;
        let failed = 0;

        for (const item of list) {
            try {
                const pg = item?.ProductGroup || item;
                const name = pg?.Name;
                if (!name) continue;

                const idgrupopos = String(pg?.ProductGroupID || '');
                const description = pg?.Description || null;

                const existing = await EstoqueRepository.getCategoryByNameOrPosId(companyId, name, idgrupopos);

                if (existing) {
                    await EstoqueRepository.updateCategory(existing.public_id, companyId, {
                        name,
                        description,
                        idgrupopos,
                        poscontrol_synced: true
                    });
                    updated++;
                } else {
                    await EstoqueRepository.createCategory(companyId, {
                        name,
                        description,
                        idgrupopos,
                        poscontrol_synced: true
                    });
                    imported++;
                }
            } catch (err) {
                logger.error({ err, item }, '[PosControlSyncService] Erro ao importar categoria individual do Pos-Control');
                failed++;
            }
        }

        return { imported, updated, failed };
    }

    private static async getInactiveStatusId(cfg: any, jwt: string): Promise<string> {
        try {
            const statustypesUrl = this.getEndpoint(cfg.url_token, 'statustypes');
            let targetUrl = statustypesUrl;
            if (cfg.subscription_key) {
                try {
                    const urlObj = new URL(targetUrl);
                    urlObj.searchParams.set('subscription-key', cfg.subscription_key);
                    targetUrl = urlObj.toString();
                } catch {}
            }

            const headers: any = {
                'Accept': 'application/json',
                'Authorization': `Bearer ${jwt}`
            };
            if (cfg.ocp_apim_subscription_key) {
                headers['Ocp-Apim-Subscription-Key'] = cfg.ocp_apim_subscription_key;
            }

            logger.info(`[PosControlSyncService] Buscando StatusID inativo de: ${targetUrl}`);
            const response = await fetch(targetUrl, {
                method: 'GET',
                headers
            });

            if (response.ok) {
                const data = await response.json();
                
                let list: any[] = [];
                if (Array.isArray(data)) {
                    list = data;
                } else if (data && Array.isArray(data.Result)) {
                    list = data.Result;
                } else if (data && Array.isArray(data.Status)) {
                    list = data.Status;
                } else if (data && typeof data === 'object') {
                    const foundArray = Object.values(data).find(val => Array.isArray(val));
                    if (foundArray) {
                        list = foundArray as any[];
                    }
                }

                for (const item of list) {
                    const statusObj = item?.Product || item?.Status || item?.StatusType || item;
                    const name = statusObj?.Name || '';
                    const shortName = statusObj?.ShortName || '';
                    if (
                        name.toLowerCase().includes('inativo') || 
                        name.toLowerCase().includes('inactive') ||
                        name.toLowerCase().includes('desabilitado') ||
                        name.toLowerCase().includes('disabled') ||
                        shortName.toLowerCase() === 'ina' ||
                        shortName.toLowerCase() === 'des'
                    ) {
                        const statusId = String(statusObj?.StatusID || '');
                        if (statusId) {
                            logger.info(`[PosControlSyncService] Encontrado StatusID inativo: ${statusId} (${name})`);
                            return statusId;
                        }
                    }
                }
            }
        } catch (err) {
            logger.error({ err }, '[PosControlSyncService] Erro ao buscar StatusID inativo.');
        }

        return '2'; // Fallback to '2' (typically 2 means inactive)
    }

    static async inactivateCategories(companyId: number, configId: number, categoryIds: string[]): Promise<{ success: boolean, updatedCount: number, transmittedCount: number }> {
        // 1. Bulk inactivate locally
        await EstoqueRepository.bulkInactivateCategories(companyId, categoryIds);

        // 2. Fetch configs and categories
        const configs = await PosControlConfigService.list(companyId);
        const cfg = configs.find(c => c.id === configId);
        if (!cfg) {
            throw new Error('Credencial do PosControl não encontrada.');
        }

        const [categories] = await pool.query<any[]>(
            `SELECT * FROM product_categories WHERE company_id = ? AND public_id IN (?)`,
            [companyId, categoryIds]
        );

        // Filter categories that have idgrupopos
        const mappedCategories = categories.filter(c => c.idgrupopos);
        
        let transmittedCount = 0;

        if (mappedCategories.length > 0) {
            const jwt = await this.getAuthToken(cfg);
            const inactiveStatusId = await this.getInactiveStatusId(cfg, jwt);

            const payload = mappedCategories.map(c => ({
                ProductGroup: {
                    ProductGroupID: String(c.idgrupopos),
                    StatusID: inactiveStatusId,
                    Name: String(c.name || ''),
                    ImageGroupBase64: String(c.image_base64 || '')
                }
            }));

            const productgroupsUrl = this.getEndpoint(cfg.url_token, 'productgroups');
            let targetUrl = productgroupsUrl;
            if (cfg.subscription_key) {
                try {
                    const urlObj = new URL(targetUrl);
                    urlObj.searchParams.set('subscription-key', cfg.subscription_key);
                    targetUrl = urlObj.toString();
                } catch {}
            }

            const headers: any = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwt}`
            };
            if (cfg.ocp_apim_subscription_key) {
                headers['Ocp-Apim-Subscription-Key'] = cfg.ocp_apim_subscription_key;
            }

            const response = await fetch(targetUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Erro ao inativar no Pos-Control: ${response.statusText} (${response.status}) - ${errText}`);
            }

            transmittedCount = mappedCategories.length;
            
            // Mark those categories as synced
            await pool.query(
                `UPDATE product_categories SET poscontrol_synced = 1 WHERE company_id = ? AND idgrupopos IN (?)`,
                [companyId, mappedCategories.map(c => c.idgrupopos)]
            );
        }

        return { success: true, updatedCount: categories.length, transmittedCount };
    }

    static async fetchSales(companyId: number, configId: number, startDate: string, endDate: string): Promise<any[]> {
        const configs = await PosControlConfigService.list(companyId);
        const cfg = configs.find(c => c.id === configId);
        if (!cfg) {
            throw new Error('Credencial do PosControl não encontrada.');
        }

        try {
            const jwt = await this.getAuthToken(cfg);
            const salesUrl = this.getEndpoint(cfg.url_token, 'sales');

            let targetUrl = salesUrl;
            const urlObj = new URL(targetUrl);
            
            // Format dates as YYYY-MM-DDTHH:mm:ss for POS-Control API
            const startDt = `${startDate}T00:00:00`;
            const endDt = `${endDate}T23:59:59`;
            
            urlObj.searchParams.set('datetimeini', startDt);
            urlObj.searchParams.set('datetimeend', endDt);
            
            if (cfg.subscription_key) {
                urlObj.searchParams.set('subscription-key', cfg.subscription_key);
            }
            targetUrl = urlObj.toString();

            const headers: any = {
                'Authorization': `Bearer ${jwt}`,
                'Accept': 'application/json'
            };

            if (cfg.ocp_apim_subscription_key) {
                headers['Ocp-Apim-Subscription-Key'] = cfg.ocp_apim_subscription_key;
            }

            logger.info(`[PosControlSyncService] Buscando vendas de: ${targetUrl}`);

            const response = await fetch(targetUrl, {
                method: 'GET',
                headers
            });

            if (!response.ok) {
                throw new Error(`API retornou status ${response.status} - ${await response.text()}`);
            }

            const data = await response.json() as any;
            
            let list: any[] = [];
            if (Array.isArray(data)) {
                list = data;
            } else if (data && Array.isArray(data.Result)) {
                list = data.Result;
            } else if (data && Array.isArray(data.retorno)) {
                list = data.retorno;
            } else if (data && Array.isArray(data.Sales)) {
                list = data.Sales;
            } else if (data && typeof data === 'object') {
                list = [data];
            }

            // Fetch local products to resolve names, external_code, and ean
            const [localProducts] = await pool.query<any[]>(
                'SELECT idprodutopos, sku, name, external_code, ean FROM products WHERE company_id = ?',
                [companyId]
            );
            const productMap = new Map<string, string>();
            const externalCodeMap = new Map<string, string>();
            const eanMap = new Map<string, string>();
            localProducts.forEach(p => {
                const extCode = p.external_code ? String(p.external_code).trim() : '';
                const eanVal = p.ean ? String(p.ean).trim() : '';
                if (p.idprodutopos) {
                    productMap.set(p.idprodutopos.toLowerCase(), p.name);
                    if (extCode) externalCodeMap.set(p.idprodutopos.toLowerCase(), extCode);
                    if (eanVal) eanMap.set(p.idprodutopos.toLowerCase(), eanVal);
                }
                if (p.sku) {
                    productMap.set(p.sku.toLowerCase(), p.name);
                    if (extCode) externalCodeMap.set(p.sku.toLowerCase(), extCode);
                    if (eanVal) eanMap.set(p.sku.toLowerCase(), eanVal);
                }
            });
            
            if (list.length > 0) {
                return list.map((item, idx) => {
                    // Compute total from SalePaymentType or SaleItems
                    let totalVal = 0;
                    if (item.SalePaymentType && Array.isArray(item.SalePaymentType)) {
                        totalVal = item.SalePaymentType.reduce((sum: number, pt: any) => sum + parseFloat(pt.PaidAmount || '0'), 0);
                    } else if (item.SaleItems && Array.isArray(item.SaleItems)) {
                        totalVal = item.SaleItems.reduce((sum: number, si: any) => sum + parseFloat(si.AmntTotal || '0'), 0);
                    } else {
                        totalVal = Number(item.total || item.TotalValue || item.Value || 0);
                    }

                    // Compute paymentType
                    let payType = 'Outro';
                    if (item.SalePaymentType && Array.isArray(item.SalePaymentType)) {
                        payType = item.SalePaymentType.map((pt: any) => pt.Name || 'Outro').join(', ');
                    } else {
                        payType = item.paymentType || item.PaymentType || 'Outro';
                    }

                    // Compute status
                    let saleStatusStr = 'Pendente';
                    if (String(item.SaleStatus) === '1') {
                        saleStatusStr = 'Finalizada';
                    } else {
                        saleStatusStr = item.status || item.Status || 'Pendente';
                    }

                    const subItems = Array.isArray(item.items || item.Items || item.SaleItems)
                        ? (item.items || item.Items || item.SaleItems).map((sub: any) => {
                            const prodId = String(sub.ProductID || '').toLowerCase();
                            const prodCode = String(sub.InternalCode || '').toLowerCase();

                            const name = productMap.get(prodId) 
                                || productMap.get(prodCode) 
                                || sub.name 
                                || sub.ProductName 
                                || `Produto #${sub.InternalCode || 'Sem Código'}`;

                            const externalCode = externalCodeMap.get(prodId) || externalCodeMap.get(prodCode) || '';
                            const ean = eanMap.get(prodId) || eanMap.get(prodCode) || '';

                            return {
                                name,
                                quantity: Number(sub.quantity || sub.Qty || sub.Quantity || 1),
                                price: Number(sub.price || sub.UnitPrice || sub.PriceAmount || 0),
                                externalCode,
                                ean
                            };
                        })
                        : [];

                    let cardInfoVal: any = null;
                    if (item.SalePaymentType && Array.isArray(item.SalePaymentType) && item.SalePaymentType.length > 0) {
                        const firstPt = item.SalePaymentType[0];
                        if (firstPt.TEFBandeira || firstPt.TEFCartao || firstPt.TEFRede || firstPt.TEFAutorizacao) {
                            cardInfoVal = {
                                brand: firstPt.TEFBandeira || null,
                                card: firstPt.TEFCartao || null,
                                network: firstPt.TEFRede || null,
                                authorization: firstPt.TEFAutorizacao || null,
                                nsu: firstPt.TEFNSUHost || null,
                                installments: firstPt.TEFParcelas || null
                            };
                        }
                    }

                    return {
                        id: String(item.id || item.SaleID || idx + 1),
                        salePosCodeId: item.salePosCodeId || item.SalePosCodeID || 'PC-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
                        date: item.date || item.DatetimeSale || item.SaleDate || new Date().toISOString(),
                        total: totalVal,
                        status: saleStatusStr,
                        paymentType: payType,
                        items: subItems,
                        cardInfo: cardInfoVal
                    };
                });
            }
        } catch (err: any) {
            logger.warn({ err }, '[PosControlSyncService] Falha ao consultar vendas da API Pos-Control.');
            throw err;
        }

        return [];
    }
}
