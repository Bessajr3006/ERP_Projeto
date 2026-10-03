import { FinanceBankStatementRepository } from '../../repositories/financeBankStatementRepository';
import pool from '../../config/db';
import { randomUUID, createHash } from 'crypto';
import logger from '../../config/logger';
import * as https from 'https';

export class InterService {
    /**
     * Retorna o número da conta corrente sanitizado (apenas números, sem zeros à esquerda e sem caracteres especiais)
     */
    private static getSanitizedAccountNumber(account: any): string {
        const raw = String(account?.account_number || '').replace(/\D/g, '').replace(/^0+/, '');
        return raw || String(account?.account_number || '').trim();
    }

    /**
     * Gera um transaction_id garantidamente único e determinístico para o extrato bancário
     * Evita que códigos genéricos como "0", "0000", "-" colidam e sobrescrevam transações legítimas (ex: múltiplos PIX)
     */
    private static generateTransactionId(tx: any, safeDate: string, type: string, amount: number, description: string, txIndex: number): string {
        // 1. Identificadores PIX legítimos do Banco Central / Inter (EndToEndId tem 32+ caracteres)
        const rawE2E = tx.detalhes?.endToEndId || tx.detalhes?.endtoEndId || tx.detalhes?.e2eId || tx.endToEndId || tx.endtoEndId || tx.e2eId;
        if (rawE2E && String(rawE2E).trim().length >= 8 && !/^[0_\- ]+$/.test(String(rawE2E).trim())) {
            return String(rawE2E).trim().slice(0, 100);
        }

        // 2. ID da transação / Código de transação
        const rawTxId = tx.detalhes?.txid || tx.txid || tx.detalhes?.codigoTransacao || tx.codigoTransacao || tx.detalhes?.idTransacao || tx.idTransacao;
        if (rawTxId && String(rawTxId).trim().length >= 6 && !/^[0_\- ]+$/.test(String(rawTxId).trim())) {
            return String(rawTxId).trim().slice(0, 100);
        }

        // 3. Nosso Número de boleto
        const rawNossoNumero = tx.detalhes?.nossoNumero || tx.nossoNumero;
        if (rawNossoNumero && String(rawNossoNumero).trim().length >= 6 && !/^[0_\- ]+$/.test(String(rawNossoNumero).trim())) {
            return `bol_${String(rawNossoNumero).trim().slice(0, 90)}`;
        }

        // 4. NSU / Documento específico (se não for "0", "0000", etc.)
        const rawNsu = tx.detalhes?.nsu || tx.nsu || tx.numDocumento || tx.numeroDocumento || tx.referencia;
        if (rawNsu && String(rawNsu).trim().length >= 6 && !/^[0_\- ]+$/.test(String(rawNsu).trim())) {
            return `doc_${String(rawNsu).trim().slice(0, 90)}`;
        }

        // 5. Hash determinístico único por lançamento para evitar qualquer colisão entre transações de mesmo valor
        const timeStr = tx.horario || tx.hora || tx.dataHoraMovimento || '';
        const hash = createHash('md5')
            .update(`${safeDate}|${timeStr}|${type}|${amount.toFixed(2)}|${description.trim()}|${txIndex}`)
            .digest('hex');
        return `tx_${safeDate}_${hash}`;
    }

    /**
     * Divide um intervalo de datas em blocos de no máximo maxDays dias (padrão 89 dias)
     * para respeitar os limites de requisição da API de extrato do Banco Inter.
     */
    private static splitDateRange(startDateStr: string, endDateStr: string, maxDays = 89): Array<{ start: string; end: string }> {
        const ranges: Array<{ start: string; end: string }> = [];
        let current = new Date(startDateStr + 'T00:00:00Z');
        const finalEnd = new Date(endDateStr + 'T00:00:00Z');

        if (isNaN(current.getTime()) || isNaN(finalEnd.getTime()) || current > finalEnd) {
            return [{ start: startDateStr, end: endDateStr }];
        }

        while (current <= finalEnd) {
            const nextEnd = new Date(current);
            nextEnd.setUTCDate(nextEnd.getUTCDate() + (maxDays - 1));

            const chunkEnd = nextEnd < finalEnd ? nextEnd : finalEnd;
            ranges.push({
                start: current.toISOString().slice(0, 10),
                end: chunkEnd.toISOString().slice(0, 10)
            });

            current = new Date(chunkEnd);
            current.setUTCDate(current.getUTCDate() + 1);
        }

        return ranges;
    }

    /**
     * Sincroniza o extrato do Banco Inter usando o Host Validado pelo Teste de Conexão.
     * Suporta qualquer período de datas através de particionamento automático em lotes de até 89 dias,
     * paginação completa da API de extrato e sincronização complementar da API Pix.
     */
    static async syncStatements(companyId: number, bankAccount: any, startDate: string, endDate: string): Promise<number> {
        const { api_client_id, api_client_secret, api_certificate, api_key } = bankAccount;

        if (!api_client_id || !api_client_secret || !api_certificate || !api_key) {
            throw new Error('Credenciais completas (ID, Secret, Certificado e Chave) são necessárias para a API do Inter.');
        }

        const accountNumber = this.getSanitizedAccountNumber(bankAccount);
        if (!accountNumber) {
            throw new Error('O número da conta bancária configurado é inválido ou está em branco.');
        }

        // Ajusta data final para não ultrapassar a data atual (a API do Inter rejeita datas futuras para extrato)
        const todayStr = new Date().toISOString().slice(0, 10);
        let safeStartDate = (startDate || todayStr).slice(0, 10);
        let safeEndDate = (endDate || todayStr).slice(0, 10);

        if (safeEndDate > todayStr) {
            logger.info({ originalEndDate: safeEndDate, adjustedEndDate: todayStr }, '[InterService] Ajustando dataFim para hoje (data futura não permitida no extrato)');
            safeEndDate = todayStr;
        }

        if (safeStartDate > safeEndDate) {
            safeStartDate = safeEndDate;
        }

        try {
            // 1. Obter Token mTLS com escopo extrato.read
            const token = await this.getAccessToken(bankAccount, 'extrato.read');

            // 2. Particionar intervalo em blocos de até 89 dias
            const dateChunks = this.splitDateRange(safeStartDate, safeEndDate, 89);
            let syncedCount = 0;

            for (const chunk of dateChunks) {
                let page = 0;
                let hasMorePages = true;
                let isCompletoEndpoint = true;

                while (hasMorePages) {
                    let path = '';
                    if (isCompletoEndpoint) {
                        path = `/banking/v2/extrato/completo?dataInicio=${chunk.start}&dataFim=${chunk.end}&pagina=${page}&tamanhoPagina=100`;
                    } else {
                        path = `/banking/v2/extrato?dataInicio=${chunk.start}&dataFim=${chunk.end}`;
                    }

                    let response = '';
                    try {
                        response = await this.httpsRequest('cdpj.partners.bancointer.com.br', path, 'GET', {
                            'Authorization': `Bearer ${token}`,
                            'x-inter-conta-corrente': accountNumber
                        }, bankAccount);
                    } catch (reqErr: any) {
                        // Se falhar no endpoint completo na primeira página, tenta o endpoint padrão de extrato
                        if (isCompletoEndpoint && page === 0) {
                            logger.warn({ reqErr: reqErr.message }, '[InterService] Endpoint /banking/v2/extrato/completo falhou, tentando fallback para /banking/v2/extrato');
                            isCompletoEndpoint = false;
                            continue;
                        }
                        throw reqErr;
                    }

                    let data: any;
                    try {
                        data = JSON.parse(response);
                    } catch (e: any) {
                        if (isCompletoEndpoint && page === 0) {
                            logger.warn('[InterService] Resposta não-JSON em /banking/v2/extrato/completo, tentando fallback para /banking/v2/extrato');
                            isCompletoEndpoint = false;
                            continue;
                        }
                        throw new Error(`Erro ao interpretar resposta do Banco Inter: ${e.message}. Resposta: ${response.substring(0, 200)}`);
                    }

                    if (data && !Array.isArray(data)) {
                        if (data.violacoes || data.erros || data.title || data.mensagem || data.error) {
                            if (isCompletoEndpoint && page === 0) {
                                logger.warn({ data }, '[InterService] Erro em /banking/v2/extrato/completo, tentando fallback para /banking/v2/extrato');
                                isCompletoEndpoint = false;
                                continue;
                            }
                            const errMsg = this.extractErrorMessage(data, 'Erro na consulta do extrato');
                            logger.error({ chunk, page, data, errMsg }, '[InterService] Erro retornado pela API do Inter');
                            throw new Error(errMsg);
                        }
                    }

                    let transactions: any[] = [];
                    if (Array.isArray(data)) {
                        transactions = data;
                    } else if (data && Array.isArray(data.transacoes)) {
                        transactions = data.transacoes;
                    }

                    let txIndex = 0;
                    for (const tx of transactions) {
                        txIndex++;
                        const safeDate = this.normalizeTransactionDate(tx);
                        if (!safeDate) {
                            logger.warn({ tx }, '[InterService] Ignorando lançamento sem data válida');
                            continue;
                        }

                        // Tipo de operação
                        const tipoLancamento = String(tx.tipoLancamento || tx.tipoOperacao || tx.tipo || '').toUpperCase();
                        const isCredit = tipoLancamento.includes('CRED') || tipoLancamento === 'C' || tipoLancamento === 'RECEITA' || tipoLancamento === 'ENTRADA';
                        const isDebit = tipoLancamento.includes('DEB') || tipoLancamento === 'D' || tipoLancamento === 'DESPESA' || tipoLancamento === 'SAIDA';
                        
                        let rawAmount = tx.valor !== undefined && tx.valor !== null ? tx.valor : (tx.valorLancamento || tx.amount || '0');
                        let numAmount = 0;
                        if (typeof rawAmount === 'string') {
                            if (rawAmount.includes(',') && !rawAmount.includes('.')) {
                                numAmount = parseFloat(rawAmount.replace(',', '.'));
                            } else if (rawAmount.includes('.') && rawAmount.includes(',')) {
                                numAmount = parseFloat(rawAmount.replace(/\./g, '').replace(',', '.'));
                            } else {
                                numAmount = parseFloat(rawAmount);
                            }
                        } else {
                            numAmount = Number(rawAmount || 0);
                        }
                        if (isNaN(numAmount)) numAmount = 0;

                        let type: 'income' | 'expense' = 'expense';
                        if (isCredit) {
                            type = 'income';
                        } else if (isDebit) {
                            type = 'expense';
                        } else if (numAmount > 0) {
                            type = 'income';
                        } else {
                            type = 'expense';
                        }
                        const amount = Math.abs(numAmount);

                        // Descrição / Título
                        const titulo = String(tx.titulo || tx.tipoTransacao || '').trim();
                        const descricao = String(tx.descricao || tx.historico || tx.detalhe || tx.detalhes?.descricao || '').trim();
                        let description = '';
                        if (titulo && descricao && titulo.toLowerCase() !== descricao.toLowerCase()) {
                            description = `${titulo} - ${descricao}`;
                        } else {
                            description = descricao || titulo || 'Lançamento Inter';
                        }
                        if (description.length > 255) {
                            description = description.substring(0, 255);
                        }

                        // ID Único da transação no Inter (evita colisão de códigos genéricos como "0")
                        const txId = this.generateTransactionId(tx, safeDate, type, amount, description, txIndex);

                        const publicId = randomUUID();
                        const rawData = JSON.stringify(tx);

                        const affected = await FinanceBankStatementRepository.upsertBankStatement(
                            pool,
                            companyId,
                            bankAccount.id,
                            publicId,
                            txId,
                            safeDate,
                            description,
                            amount,
                            type,
                            rawData
                        );

                        if (affected === 1) {
                            syncedCount++;
                        }
                    }

                    // Controle de paginação
                    if (isCompletoEndpoint && data && !Array.isArray(data)) {
                        const totalPages = Number(data.totalPaginas ?? 1);
                        const isLastPage = Boolean(data.ultimaPagina ?? (page >= totalPages - 1));
                        
                        if (!isLastPage && page < totalPages - 1 && transactions.length > 0) {
                            page++;
                            hasMorePages = true;
                        } else {
                            hasMorePages = false;
                        }
                    } else {
                        hasMorePages = false;
                    }
                }
            }

            // 3. Sincronização complementar via API Pix (/pix/v2/pix) para garantir captura de 100% dos Pix Recebidos
            try {
                const pixToken = await this.getAccessToken(bankAccount, 'pix.read');
                const startIso = `${safeStartDate}T00:00:00.000Z`;
                const endIso = `${safeEndDate}T23:59:59.999Z`;
                const pixPath = `/pix/v2/pix?inicio=${encodeURIComponent(startIso)}&fim=${encodeURIComponent(endIso)}`;

                const pixResponse = await this.httpsRequest('cdpj.partners.bancointer.com.br', pixPath, 'GET', {
                    'Authorization': `Bearer ${pixToken}`,
                    'x-inter-conta-corrente': accountNumber
                }, bankAccount);

                if (pixResponse && pixResponse.trim().startsWith('{')) {
                    const pixData = JSON.parse(pixResponse);
                    const pixList = Array.isArray(pixData.pix) ? pixData.pix : [];
                    let pixIdx = 0;

                    for (const p of pixList) {
                        pixIdx++;
                        const rawHorario = p.horario || p.dataHora || '';
                        const pDate = rawHorario ? String(rawHorario).slice(0, 10) : safeStartDate;
                        const rawVal = p.valor || '0';
                        const pAmount = Math.abs(parseFloat(String(rawVal).replace(',', '.')));
                        if (!pAmount || isNaN(pAmount)) continue;

                        const pagadorNome = p.pagador?.nome || p.infoPagador || '';
                        let pDesc = '';
                        if (pagadorNome) {
                            pDesc = `PIX RECEBIDO - ${pagadorNome}`;
                        } else if (p.chave) {
                            pDesc = `PIX RECEBIDO (${p.chave})`;
                        } else {
                            pDesc = 'PIX RECEBIDO';
                        }

                        const pTxId = (p.endToEndId && String(p.endToEndId).trim().length >= 8)
                            ? String(p.endToEndId).trim()
                            : (p.txid && String(p.txid).trim().length >= 6 ? String(p.txid).trim() : `pix_${pDate}_${pAmount}_${pixIdx}`);

                        const publicId = randomUUID();
                        const rawData = JSON.stringify(p);

                        const affected = await FinanceBankStatementRepository.upsertBankStatement(
                            pool,
                            companyId,
                            bankAccount.id,
                            publicId,
                            pTxId.slice(0, 100),
                            pDate,
                            pDesc.slice(0, 255),
                            pAmount,
                            'income',
                            rawData
                        );

                        if (affected === 1) {
                            syncedCount++;
                        }
                    }
                }
            } catch (pixErr: any) {
                logger.info({ err: pixErr.message }, '[InterService] Consulta complementar Pix (/pix/v2/pix) não disponível ou sem escopo pix.read, seguindo com extrato bancário');
            }

            return syncedCount;
        } catch (error: any) {
            logger.error({ error: error.message }, '[InterService] Erro no sync');
            throw new Error(`Erro na API do Banco: ${error.message}`);
        }
    }

    /**
     * Consulta o saldo em tempo real da conta no Banco Inter (/banking/v2/saldo)
     */
    static async getBalance(bankAccount: any): Promise<{
        disponivel: number;
        bloqueadoCheque: number;
        bloqueadoJudicial: number;
        bloqueadoAdministrativo: number;
        totalBloqueado: number;
        limite: number;
        totalMaster: number;
    }> {
        const { api_client_id, api_client_secret, api_certificate, api_key } = bankAccount;

        if (!api_client_id || !api_client_secret || !api_certificate || !api_key) {
            throw new Error('Credenciais completas (ID, Secret, Certificado e Chave) são necessárias para consultar o saldo na API do Inter.');
        }

        const accountNumber = this.getSanitizedAccountNumber(bankAccount);
        if (!accountNumber) {
            throw new Error('O número da conta bancária configurado é inválido ou está em branco.');
        }

        try {
            const token = await this.getAccessToken(bankAccount, 'extrato.read');
            const path = '/banking/v2/saldo';

            const response = await this.httpsRequest('cdpj.partners.bancointer.com.br', path, 'GET', {
                'Authorization': `Bearer ${token}`,
                'x-inter-conta-corrente': accountNumber
            }, bankAccount);

            let data: any;
            try {
                data = JSON.parse(response);
            } catch (e: any) {
                throw new Error(`Erro ao interpretar resposta de saldo do Banco Inter: ${e.message}. Resposta: ${response.substring(0, 200)}`);
            }

            if (data && (data.violacoes || data.erros || data.title || data.mensagem || data.error)) {
                throw new Error(this.extractErrorMessage(data, 'Erro na consulta de saldo'));
            }

            const disponivel = Number(data.disponivel ?? 0);
            const bloqueadoCheque = Number(data.bloqueadoCheque ?? 0);
            const bloqueadoJudicial = Number(data.bloqueadoJudicial ?? 0);
            const bloqueadoAdministrativo = Number(data.bloqueadoAdministrativo ?? 0);
            const totalBloqueado = bloqueadoCheque + bloqueadoJudicial + bloqueadoAdministrativo;
            const limite = Number(data.limite ?? 0);
            const totalMaster = Number(data.totalMaster ?? (disponivel + limite));

            return {
                disponivel,
                bloqueadoCheque,
                bloqueadoJudicial,
                bloqueadoAdministrativo,
                totalBloqueado,
                limite,
                totalMaster
            };
        } catch (error: any) {
            logger.error({ error: error.message }, '[InterService] Erro ao consultar saldo');
            throw new Error(`Erro na API do Banco ao consultar saldo: ${error.message}`);
        }
    }

    private static tokenCache: Record<string, { token: string; expiresAt: number }> = {};

    private static async getAccessToken(account: any, scope: string = 'extrato.read'): Promise<string> {
        const accountNumber = this.getSanitizedAccountNumber(account);
        const cacheKey = `${accountNumber}_${scope}_${account.api_client_id.trim()}`;
        const now = Date.now();
        if (this.tokenCache[cacheKey] && this.tokenCache[cacheKey].expiresAt > now) {
            return this.tokenCache[cacheKey].token;
        }

        const payload = new URLSearchParams({
            client_id: account.api_client_id.trim(),
            client_secret: account.api_client_secret.trim(),
            grant_type: 'client_credentials',
            scope: scope
        }).toString();

        const response = await this.httpsRequest('cdpj.partners.bancointer.com.br', '/oauth/v2/token', 'POST', {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(payload)
        }, account, payload);

        let data;
        try {
            if (!response || !response.trim()) {
                throw new Error('Resposta vazia do servidor.');
            }
            data = JSON.parse(response);
        } catch (e: any) {
            throw new Error(`Falha ao obter token de acesso: ${e.message}. Resposta original: ${response}`);
        }
        if (!data.access_token) throw new Error('Falha ao obter token de acesso.');
        
        const expiresInSeconds = Number(data.expires_in) || 3600;
        this.tokenCache[cacheKey] = {
            token: data.access_token,
            expiresAt: now + (expiresInSeconds - 300) * 1000
        };

        return data.access_token;
    }

    private static normalizeTransactionDate(tx: any): string | null {
        const raw = tx.dataEntrada || 
                    tx.dataLancamento || 
                    tx.dataHoraMovimento || 
                    tx.dataMovimento || 
                    tx.data || 
                    tx.dataHora || 
                    tx.data_extrato || 
                    tx.date || 
                    tx.inclusao ||
                    tx.detalhes?.dataHora ||
                    tx.detalhes?.dataLancamento;
        if (raw === undefined || raw === null) return null;

        if (typeof raw === 'number') {
            const d = new Date(raw);
            if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
            return null;
        }

        const str = String(raw).trim();
        if (!str) return null;

        // Match YYYY-MM-DD (e.g. "2026-10-03" or "2026-10-03T14:30:00" or "2026-10-03 14:30:00")
        const ymdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
        if (ymdMatch && ymdMatch[1] && ymdMatch[2] && ymdMatch[3]) {
            const y = ymdMatch[1];
            const m = ymdMatch[2].padStart(2, '0');
            const d = ymdMatch[3].padStart(2, '0');
            return `${y}-${m}-${d}`;
        }

        // Match DD/MM/YYYY or DD-MM-YYYY (e.g. "03/10/2026" or "03-10-2026" or "03/10/2026 14:30:00")
        const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
        if (dmyMatch && dmyMatch[1] && dmyMatch[2] && dmyMatch[3]) {
            const d = dmyMatch[1].padStart(2, '0');
            const m = dmyMatch[2].padStart(2, '0');
            const y = dmyMatch[3];
            return `${y}-${m}-${d}`;
        }

        const parsed = new Date(str);
        if (!isNaN(parsed.getTime())) {
            return parsed.toISOString().slice(0, 10);
        }

        return null;
    }

    private static extractErrorMessage(data: any, defaultMsg: string): string {
        if (!data) return defaultMsg;
        if (typeof data === 'string') {
            try {
                data = JSON.parse(data);
            } catch {
                return data;
            }
        }

        const violations = data.violacoes || data.erros || data.violations || data.campos || data.detalhes;
        let detailedViolations = '';
        if (Array.isArray(violations) && violations.length > 0) {
            detailedViolations = violations.map((v: any) => {
                if (typeof v === 'string') return v;
                const prop = v.propriedade || v.campo || v.property || v.nome || '';
                const reason = v.razao || v.mensagem || v.message || v.motivo || v.detalhe || v.descricao || JSON.stringify(v);
                const val = v.valor !== undefined ? ` (Valor: "${v.valor}")` : '';
                return prop ? `${prop}: ${reason}${val}` : `${reason}${val}`;
            }).join('; ');
        } else if (violations && typeof violations === 'object') {
            detailedViolations = JSON.stringify(violations);
        }

        if (detailedViolations) {
            const prefix = data.detail || data.title || data.mensagem || data.message || '';
            return prefix ? `${prefix}: ${detailedViolations}` : detailedViolations;
        }

        if (data.detail && data.title && data.detail !== data.title) {
            return `${data.title}: ${data.detail}`;
        }
        if (data.detail) return data.detail;
        if (data.mensagem) return data.mensagem;
        if (data.message) return data.message;
        if (data.title) return data.title;
        if (data.error_description) return data.error_description;
        if (data.error) return typeof data.error === 'string' ? data.error : JSON.stringify(data.error);

        return JSON.stringify(data);
    }

    private static httpsRequest(hostname: string, path: string, method: string, headers: any, account: any, payload?: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const cert = Buffer.from(account.api_certificate, 'base64').toString('ascii');
            const key = Buffer.from(account.api_key, 'base64').toString('ascii');

            const options = { hostname, port: 443, path, method, headers, cert, key };
            const req = https.request(options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
                        const trimmed = body.trim();
                        if (!trimmed) {
                            return reject(new Error(`API do Banco retornou status ${res.statusCode} sem conteúdo.`));
                        }
                        if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
                            return reject(new Error(`API do Banco retornou status ${res.statusCode}: ${trimmed.substring(0, 200)}`));
                        }
                    }
                    resolve(body);
                });
            });
            req.on('error', reject);
            if (payload) req.write(payload);
            req.end();
        });
    }

    private static httpsRequestBinary(hostname: string, path: string, method: string, headers: any, account: any, payload?: string): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const cert = Buffer.from(account.api_certificate, 'base64').toString('ascii');
            const key = Buffer.from(account.api_key, 'base64').toString('ascii');

            const options = { hostname, port: 443, path, method, headers, cert, key };
            const req = https.request(options, (res) => {
                const chunks: Buffer[] = [];
                res.on('data', chunk => chunks.push(Buffer.from(chunk)));
                res.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
                        const bodyStr = buffer.toString('utf8').trim();
                        if (!bodyStr) {
                            return reject(new Error(`API do Banco retornou status ${res.statusCode} sem conteúdo.`));
                        }
                        if (!bodyStr.startsWith('{') && !bodyStr.startsWith('[')) {
                            return reject(new Error(`API do Banco retornou status ${res.statusCode}: ${bodyStr.substring(0, 200)}`));
                        }
                    }
                    resolve(buffer);
                });
            });
            req.on('error', reject);
            if (payload) req.write(payload);
            req.end();
        });
    }

    /**
     * Gera um boleto usando a API v2/v3 do Inter
     */
    static async generateBoleto(bankAccount: any, transaction: any, customer: any): Promise<{ nossoNumero: string, linhaDigitavel: string, codigoBarras: string, pixCopiaECola?: string }> {
        const accountNumber = this.getSanitizedAccountNumber(bankAccount);
        if (!accountNumber) {
            throw new Error('O número da conta bancária configurado é inválido ou está em branco.');
        }

        // Obter token com o escopo de cobranca
        const token = await this.getAccessToken(bankAccount, 'boleto-cobranca.read boleto-cobranca.write');

        const todayStr = new Date().toISOString().slice(0, 10);
        let dueDateStr = todayStr;
        const targetDate = transaction.due_date || transaction.date;
        if (targetDate) {
            if (targetDate instanceof Date) {
                const tzOffset = targetDate.getTimezoneOffset() * 60000;
                dueDateStr = new Date(targetDate.getTime() - tzOffset).toISOString().slice(0, 10);
            } else {
                dueDateStr = String(targetDate).slice(0, 10);
            }
        }
        // Banco Inter rejeita data de vencimento anterior à data atual para nova emissão
        if (dueDateStr < todayStr) {
            dueDateStr = todayStr;
        }
        const dueDate = dueDateStr;
        
        let cpfCnpj = String(customer?.document || '').replace(/\D/g, '');
        const tipoPessoa = cpfCnpj.length === 14 ? 'JURIDICA' : 'FISICA';
        const cleanCep = customer?.zip_code ? String(customer.zip_code).replace(/\D/g, '').padStart(8, '0').slice(0, 8) : '00000000';
        const cleanName = String(customer?.name || 'Cliente').trim().substring(0, 100);
        const cleanAddress = String(customer?.address || 'Não informado').trim().substring(0, 100);
        const cleanNumber = String(customer?.address_number || 'S/N').trim().substring(0, 20);
        const cleanNeighborhood = String(customer?.neighborhood || 'Não informado').trim().substring(0, 50);
        const cleanCity = String(customer?.city || 'Não informado').trim().substring(0, 50);
        const cleanUf = String(customer?.state || 'SP').trim().toUpperCase().substring(0, 2);

        // Monta o payload conforme documentação da API v3 do Inter para Boleto Híbrido (Boleto + Pix)
        const payload: any = {
            seuNumero: String(transaction.public_id || randomUUID()).replace(/[^a-zA-Z0-9]/g, '').substring(0, 15),
            valorNominal: Number(transaction.original_amount !== null && transaction.original_amount !== undefined ? transaction.original_amount : transaction.amount),
            dataVencimento: dueDate,
            numDiasAgenda: bankAccount.billet_validity !== null && bankAccount.billet_validity !== undefined ? Number(bankAccount.billet_validity) : 30, // dias para baixa automática
            formasRecebimento: ['BOLETO', 'PIX'],
            pagador: {
                tipoPessoa,
                nome: cleanName,
                endereco: cleanAddress,
                numero: cleanNumber,
                bairro: cleanNeighborhood,
                cidade: cleanCity,
                uf: cleanUf,
                cep: cleanCep,
                cpfCnpj: cpfCnpj || '00000000000'
            }
        };

        const isCustomerExempt = Boolean(
            (customer as any)?.exempt_interest_fine === 1 ||
            (customer as any)?.exempt_interest_fine === true ||
            transaction.cust_exempt_interest_fine === 1 ||
            transaction.cust_exempt_interest_fine === true ||
            transaction.customer_exempt_interest_fine === 1 ||
            transaction.customer_exempt_interest_fine === true
        );

        if (!isCustomerExempt && bankAccount.billet_fine !== null && bankAccount.billet_fine !== undefined && Number(bankAccount.billet_fine) > 0) {
            payload.multa = {
                codigo: 'PERCENTUAL',
                taxa: Number(bankAccount.billet_fine)
            };
        }

        if (!isCustomerExempt && bankAccount.billet_interest !== null && bankAccount.billet_interest !== undefined && Number(bankAccount.billet_interest) > 0) {
            payload.mora = {
                codigo: 'TAXAMENSAL',
                taxa: Number(bankAccount.billet_interest)
            };
        }

        if (transaction.description) {
            payload.mensagem = {
                linha1: String(transaction.description).substring(0, 78)
            };
        }

        const payloadStr = JSON.stringify(payload);

        const response = await this.httpsRequest('cdpj.partners.bancointer.com.br', '/cobranca/v3/cobrancas', 'POST', {
            'Authorization': `Bearer ${token}`,
            'x-inter-conta-corrente': accountNumber,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payloadStr)
        }, bankAccount, payloadStr);

        let data;
        try {
            data = JSON.parse(response);
        } catch (e) {
            throw new Error(`Erro ao ler resposta do banco: ${response}`);
        }

        if (data.violacoes || data.erros || data.title || data.mensagem || data.error) {
            if (data.violacoes && Array.isArray(data.violacoes) && data.violacoes.length > 0) {
                const razao = data.violacoes[0].razao;
                if (razao && razao.includes('existe uma cobrança emitida há poucos minutos')) {
                    const match = razao.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
                    if (match && match[0]) {
                        return {
                            nossoNumero: match[0],
                            linhaDigitavel: '',
                            codigoBarras: ''
                        };
                    }
                }
            }
            throw new Error(`Erro na API do Banco: ${this.extractErrorMessage(data, 'Erro na requisição')}`);
        }

        if (!data.codigoSolicitacao && !data.nossoNumero) {
            throw new Error(`Resposta inválida da API do Inter: ${response}`);
        }

        const codigoSolicitacao = data.codigoSolicitacao || data.nossoNumero;
        let linhaDigitavel = data.linhaDigitavel || data.boleto?.linhaDigitavel || '';
        let codigoBarras = data.codigoBarras || data.boleto?.codigoBarras || '';
        let pixCopiaECola = data.pix?.pixCopiaECola || data.cobranca?.pix?.pixCopiaECola || '';

        // Se ainda não temos os detalhes completos (porque a v3 processa de forma assíncrona), faz uma consulta rápida
        if (codigoSolicitacao && (!linhaDigitavel || !codigoBarras || !pixCopiaECola)) {
            try {
                await new Promise(resolve => setTimeout(resolve, 500));
                const detailPath = `/cobranca/v3/cobrancas/${codigoSolicitacao}`;
                const detailResponse = await this.httpsRequest('cdpj.partners.bancointer.com.br', detailPath, 'GET', {
                    'Authorization': `Bearer ${token}`,
                    'x-inter-conta-corrente': accountNumber
                }, bankAccount);
                const detailData = JSON.parse(detailResponse);
                if (detailData) {
                    linhaDigitavel = detailData.boleto?.linhaDigitavel || detailData.linhaDigitavel || linhaDigitavel;
                    codigoBarras = detailData.boleto?.codigoBarras || detailData.codigoBarras || codigoBarras;
                    pixCopiaECola = detailData.pix?.pixCopiaECola || detailData.cobranca?.pix?.pixCopiaECola || pixCopiaECola;
                }
            } catch (err) {
                logger.warn({ err }, '[InterService] Aviso: Detalhes imediatos do boleto/pix indisponíveis, seguindo com codigoSolicitacao');
            }
        }

        // Na V3, a cobrança retorna codigoSolicitacao. Usamos ele no lugar de nossoNumero para pegar o PDF
        return {
            nossoNumero: codigoSolicitacao,
            linhaDigitavel,
            codigoBarras,
            pixCopiaECola
        };
    }

    /**
     * Retorna o base64 do PDF do Boleto
     */
    static async getBoletoPdfBase64(bankAccount: any, nossoNumero: string): Promise<string> {
        const accountNumber = this.getSanitizedAccountNumber(bankAccount);
        const token = await this.getAccessToken(bankAccount, 'boleto-cobranca.read');

        const path = `/cobranca/v3/cobrancas/${nossoNumero}/pdf`;
        
        const responseBuffer = await this.httpsRequestBinary('cdpj.partners.bancointer.com.br', path, 'GET', {
            'Authorization': `Bearer ${token}`,
            'x-inter-conta-corrente': accountNumber
        }, bankAccount);

        const responseStr = responseBuffer.toString('utf8');
        try {
            const data = JSON.parse(responseStr);
            if (data.pdf) {
                return data.pdf;
            }
            if (data.violacoes || data.erros || data.title || data.mensagem || data.error) {
                throw new Error(`Erro do Inter: ${this.extractErrorMessage(data, 'Erro na requisição')}`);
            }
        } catch (e) {
            if (responseStr.startsWith('%PDF')) {
                return responseBuffer.toString('base64');
            }
            throw new Error(`Erro ao obter PDF: ${responseStr}`);
        }
        return "";
    }

    /**
     * Cancela um boleto via API V3 do Inter
     */
    static async cancelBoleto(bankAccount: any, nossoNumero: string): Promise<void> {
        const accountNumber = this.getSanitizedAccountNumber(bankAccount);
        const token = await this.getAccessToken(bankAccount, 'boleto-cobranca.write');

        const path = `/cobranca/v3/cobrancas/${nossoNumero}/cancelar`;
        const payload = {
            motivoCancelamento: "ACERTOS"
        };
        const payloadStr = JSON.stringify(payload);

        const response = await this.httpsRequest('cdpj.partners.bancointer.com.br', path, 'POST', {
            'Authorization': `Bearer ${token}`,
            'x-inter-conta-corrente': accountNumber,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payloadStr)
        }, bankAccount, payloadStr);

        if (response) {
            let data;
            try {
                data = JSON.parse(response);
            } catch (e) {
                // if it's not JSON and not empty, it might be an error page, but usually Inter v3 responds with JSON on error
            }
            if (data && (data.violacoes || data.erros || data.title || data.mensagem || data.error)) {
                const errMsg = this.extractErrorMessage(data, 'Erro na requisição');
                const lowerErr = errMsg.toLowerCase();
                if (
                    lowerErr.includes('expirad') || 
                    lowerErr.includes('cancelad') || 
                    lowerErr.includes('baixad') || 
                    lowerErr.includes('liquid') ||
                    lowerErr.includes('não pode ser cancelada') ||
                    lowerErr.includes('nao pode ser cancelada') ||
                    lowerErr.includes('não encontrada') ||
                    lowerErr.includes('nao encontrada')
                ) {
                    logger.info(`[InterService] Cobrança ${nossoNumero} não está mais ativa no Inter (${errMsg}). Prosseguindo com limpeza local no ERP.`);
                    return;
                }
                throw new Error(`Erro ao cancelar: ${errMsg}`);
            }
        }
    }

    /**
     * Registra o webhook na API v3 do Inter
     */
    static async registerWebhook(bankAccount: any, webhookUrl: string): Promise<void> {
        const accountNumber = this.getSanitizedAccountNumber(bankAccount);
        const token = await this.getAccessToken(bankAccount, 'boleto-cobranca.write');
        const payload = { webhookUrl };
        const payloadStr = JSON.stringify(payload);

        const response = await this.httpsRequest(
            'cdpj.partners.bancointer.com.br',
            '/cobranca/v3/cobrancas/webhook',
            'PUT',
            {
                'Authorization': `Bearer ${token}`,
                'x-inter-conta-corrente': accountNumber,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payloadStr)
            },
            bankAccount,
            payloadStr
        );

        if (response) {
            let data;
            try {
                data = JSON.parse(response);
            } catch (e) {}
            if (data && (data.violacoes || data.erros || data.title || data.mensagem || data.error)) {
                throw new Error(`Erro ao registrar webhook: ${this.extractErrorMessage(data, 'Erro na requisição')}`);
            }
        }
    }

    /**
     * Exclui o webhook na API v3 do Inter
     */
    static async deleteWebhook(bankAccount: any): Promise<void> {
        const accountNumber = this.getSanitizedAccountNumber(bankAccount);
        const token = await this.getAccessToken(bankAccount, 'boleto-cobranca.write');
        const response = await this.httpsRequest(
            'cdpj.partners.bancointer.com.br',
            '/cobranca/v3/cobrancas/webhook',
            'DELETE',
            {
                'Authorization': `Bearer ${token}`,
                'x-inter-conta-corrente': accountNumber
            },
            bankAccount
        );

        if (response) {
            let data;
            try {
                data = JSON.parse(response);
            } catch (e) {}
            if (data && (data.violacoes || data.erros || data.title || data.mensagem || data.error)) {
                throw new Error(`Erro ao excluir webhook: ${this.extractErrorMessage(data, 'Erro na requisição')}`);
            }
        }
    }

    /**
     * Registra o webhook do Pix na API do Inter
     */
    static async registerPixWebhook(bankAccount: any, webhookUrl: string): Promise<void> {
        if (!bankAccount.pix_key) return;
        const accountNumber = this.getSanitizedAccountNumber(bankAccount);
        const token = await this.getAccessToken(bankAccount, 'webhook.write');
        const payload = { webhookUrl };
        const payloadStr = JSON.stringify(payload);

        const response = await this.httpsRequest(
            'cdpj.partners.bancointer.com.br',
            `/pix/v2/webhook/${encodeURIComponent(bankAccount.pix_key.trim())}`,
            'PUT',
            {
                'Authorization': `Bearer ${token}`,
                'x-inter-conta-corrente': accountNumber,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payloadStr)
            },
            bankAccount,
            payloadStr
        );

        if (response) {
            let data;
            try {
                data = JSON.parse(response);
            } catch (e) {}
            if (data && (data.violacoes || data.erros || data.title || data.mensagem || data.error)) {
                throw new Error(`Erro ao registrar webhook Pix: ${this.extractErrorMessage(data, 'Erro na requisição')}`);
            }
        }
    }

    /**
     * Exclui o webhook do Pix na API do Inter
     */
    static async deletePixWebhook(bankAccount: any): Promise<void> {
        if (!bankAccount.pix_key) return;
        const accountNumber = this.getSanitizedAccountNumber(bankAccount);
        const token = await this.getAccessToken(bankAccount, 'webhook.write');
        const response = await this.httpsRequest(
            'cdpj.partners.bancointer.com.br',
            `/pix/v2/webhook/${encodeURIComponent(bankAccount.pix_key.trim())}`,
            'DELETE',
            {
                'Authorization': `Bearer ${token}`,
                'x-inter-conta-corrente': accountNumber
            },
            bankAccount
        );

        if (response) {
            let data;
            try {
                data = JSON.parse(response);
            } catch (e) {}
            if (data && (data.violacoes || data.erros || data.title || data.mensagem || data.error)) {
                throw new Error(`Erro ao excluir webhook Pix: ${this.extractErrorMessage(data, 'Erro na requisição')}`);
            }
        }
    }

    /**
     * Consulta os dados detalhados da cobrança/boleto na API V3 do Inter
     */
    static async getBoletoDetails(bankAccount: any, nossoNumero: string): Promise<any> {
        const accountNumber = this.getSanitizedAccountNumber(bankAccount);
        const token = await this.getAccessToken(bankAccount, 'boleto-cobranca.read');
        const path = `/cobranca/v3/cobrancas/${nossoNumero}`;
        
        const response = await this.httpsRequest(
            'cdpj.partners.bancointer.com.br',
            path,
            'GET',
            {
                'Authorization': `Bearer ${token}`,
                'x-inter-conta-corrente': accountNumber
            },
            bankAccount
        );

        let data;
        try {
            if (!response || !response.trim()) {
                throw new Error('Resposta vazia da API de Cobrança do Banco Inter');
            }
            data = JSON.parse(response);
        } catch (e: any) {
            throw new Error(`Erro ao ler resposta do banco: ${e.message}. Resposta original: ${response}`);
        }

        if (data.violacoes || data.erros || data.title || data.mensagem || data.error) {
            throw new Error(`Erro ao consultar detalhes no Banco Inter: ${this.extractErrorMessage(data, 'Erro na requisição')}`);
        }

        return data;
    }

    /**
     * Consulta o status da cobrança/boleto na API V3 do Inter
     */
    static async getBoletoStatus(bankAccount: any, nossoNumero: string): Promise<string> {
        const data = await this.getBoletoDetails(bankAccount, nossoNumero);
        const situacao = data.cobranca?.situacao || data.situacao;
        if (!situacao) {
            throw new Error(`Situação do boleto não encontrada na resposta do Banco Inter. Resposta: ${JSON.stringify(data)}`);
        }
        return situacao; // e.g. "PAGO", "RECEBIDO", "ABERTO", "VENCIDO", "CANCELADO"
    }

    /**
     * Consulta os dados detalhados da cobrança Pix imediata na API v2 do Inter
     */
    static async getPixDetails(bankAccount: any, txid: string): Promise<any> {
        const accountNumber = this.getSanitizedAccountNumber(bankAccount);
        const token = await this.getAccessToken(bankAccount, 'pix.read');
        const path = `/pix/v2/cob/${txid}`;
        
        const response = await this.httpsRequest(
            'cdpj.partners.bancointer.com.br',
            path,
            'GET',
            {
                'Authorization': `Bearer ${token}`,
                'x-inter-conta-corrente': accountNumber
            },
            bankAccount
        );

        let data;
        try {
            if (!response || !response.trim()) {
                throw new Error('Resposta vazia da API Pix do Banco Inter');
            }
            data = JSON.parse(response);
        } catch (e: any) {
            throw new Error(`Erro ao ler resposta de Pix do banco: ${e.message}. Resposta original: ${response}`);
        }

        if (data.violacoes || data.erros || data.title || data.mensagem || data.error) {
            throw new Error(`Erro ao consultar detalhes Pix no Banco Inter: ${this.extractErrorMessage(data, 'Erro na requisição')}`);
        }

        return data;
    }

    /**
     * Consulta o status da cobrança Pix imediata na API v2 do Inter
     */
    static async getPixStatus(bankAccount: any, txid: string): Promise<string> {
        const data = await this.getPixDetails(bankAccount, txid);
        return data.status || ''; // e.g. "ATIVA", "CONCLUIDA", "REMOVIDA_PELO_USUARIO_RECEBEDOR"
    }

    /**
     * Efetua o pagamento de uma despesa via PIX ou Boleto
     */
    static async payTransaction(bankAccount: any, transaction: any): Promise<{ status: string, message: string, codigoSolicitacao?: string }> {
        const barcode = transaction.barcode ? String(transaction.barcode).trim().replace(/\D/g, '') : '';
        const pixCode = transaction.pix_code ? String(transaction.pix_code).trim() : '';
        const pixKey = transaction.pix_key ? String(transaction.pix_key).trim() : '';
        const sanitizedAccount = this.getSanitizedAccountNumber(bankAccount);
        if (!sanitizedAccount || !/^[1-9]\d*$/.test(sanitizedAccount)) {
            throw new Error('O número da conta bancária configurado é inválido ou está em branco. Acesse o menu "Contas Bancárias", edite esta conta e preencha o campo "Número da Conta" (apenas números, sem zeros à esquerda).');
        }

        if (!barcode && !pixCode && !pixKey) {
            throw new Error('A transação não possui código de barras (Boleto), código Pix ou chave Pix para pagamento.');
        }

        const todayStr = new Date().toISOString().slice(0, 10);

        if (pixCode || pixKey) {
            // Pagamento via PIX
            const token = await this.getAccessToken(bankAccount, 'pagamento-pix.write');
            const payload: any = {
                valor: Number(transaction.amount),
                dataPagamento: todayStr,
                descricao: `Pagamento Despesa #${transaction.id} - ${String(transaction.description || '').substring(0, 30)}`,
                destinatario: {}
            };

            if (pixCode) {
                payload.destinatario = {
                    tipo: 'PIX_COPIA_E_COLA',
                    pixCopiaECola: pixCode
                };
            } else {
                payload.destinatario = {
                    tipo: 'CHAVE',
                    chave: pixKey
                };
            }
            const payloadStr = JSON.stringify(payload);

            const response = await this.httpsRequest(
                'cdpj.partners.bancointer.com.br',
                '/banking/v2/pix',
                'POST',
                {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payloadStr),
                    'x-inter-conta-corrente': sanitizedAccount,
                    'x-conta-corrente': sanitizedAccount,
                    'x-id-idempotente': randomUUID()
                },
                bankAccount,
                payloadStr
            );

            let data;
            try {
                data = JSON.parse(response);
            } catch (e) {
                if (response && response.toLowerCase().includes('sucesso')) {
                    return { status: 'success', message: 'Pagamento Pix efetuado ou agendado.' };
                }
                throw new Error(`Erro ao ler resposta de pagamento Pix do banco: ${response}`);
            }

            if (data.violacoes || data.erros || data.title || data.mensagem || data.error) {
                throw new Error(`Erro no Banco Inter: ${this.extractErrorMessage(data, 'Erro no pagamento Pix')}`);
            }

            return {
                status: 'success',
                message: 'Pagamento Pix incluído com sucesso.',
                codigoSolicitacao: data.codigoSolicitacao
            };
        } else {
            // Pagamento via Código de Barras (Boleto)
            const token = await this.getAccessToken(bankAccount, 'pagamento-boleto.write');
            const dueDateStr = this.normalizeTransactionDate(transaction) || todayStr;
            const payload = {
                codBarraLinhaDigitavel: barcode,
                valorPagar: Number(transaction.amount).toFixed(2),
                dataPagamento: todayStr,
                dataVencimento: dueDateStr
            };
            const payloadStr = JSON.stringify(payload);

            const response = await this.httpsRequest(
                'cdpj.partners.bancointer.com.br',
                '/banking/v2/pagamento',
                'POST',
                {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payloadStr),
                    'x-inter-conta-corrente': sanitizedAccount,
                    'x-conta-corrente': sanitizedAccount,
                    'x-id-idempotente': randomUUID()
                },
                bankAccount,
                payloadStr
            );

            let data;
            try {
                data = JSON.parse(response);
            } catch (e) {
                if (response && response.toLowerCase().includes('sucesso')) {
                    return { status: 'success', message: 'Pagamento de Boleto efetuado ou agendado.' };
                }
                throw new Error(`Erro ao ler resposta de pagamento de boleto do banco: ${response}`);
            }

            if (data.violacoes || data.erros || data.title || data.mensagem || data.error) {
                throw new Error(`Erro no Banco Inter: ${this.extractErrorMessage(data, 'Erro no pagamento de boleto')}`);
            }

            return {
                status: 'success',
                message: 'Pagamento de boleto incluído com sucesso.',
                codigoSolicitacao: data.codigoSolicitacao
            };
        }
    }

    /**
     * Cria uma cobrança Pix imediata (cob) no Banco Inter
     */
    static async createImmediatePix(bankAccount: any, amount: number, description: string, txid?: string): Promise<{ txid: string; pixCopiaECola: string; qrCodeBase64?: string }> {
        const accountNumber = this.getSanitizedAccountNumber(bankAccount);
        const token = await this.getAccessToken(bankAccount, 'cob.write');
        
        // Se não vier um txid, gerar um UUID sem hífens (que é aceito pelo Pix)
        const activeTxid = txid || randomUUID().replace(/-/g, '');
        const path = `/pix/v2/cob/${activeTxid}`;
        
        const bodyPayload = {
            calendario: {
                expiracao: 3600 // 1 hora de expiração
            },
            valor: {
                original: Number(amount).toFixed(2)
            },
            chave: String(bankAccount.pix_key || '').trim(),
            solicitacaoPagador: String(description || '').substring(0, 140)
        };
        
        const payloadStr = JSON.stringify(bodyPayload);
        const response = await this.httpsRequest('cdpj.partners.bancointer.com.br', path, 'PUT', {
            'Authorization': `Bearer ${token}`,
            'x-inter-conta-corrente': accountNumber,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payloadStr)
        }, bankAccount, payloadStr);
        
        let data;
        try {
            if (!response || !response.trim()) {
                throw new Error('Resposta vazia da API Pix do Banco Inter');
            }
            data = JSON.parse(response);
        } catch (e: any) {
            throw new Error(`Erro ao ler resposta de Pix do banco: ${e.message}. Resposta original: ${response}`);
        }
        
        if (data.violacoes || data.erros || data.title || data.mensagem || data.error || !data.pixCopiaECola) {
            throw new Error(`Erro ao criar cobrança Pix no Banco Inter: ${this.extractErrorMessage(data, 'Erro na requisição')}`);
        }
        
        let qrCodeBase64 = '';
        if (data.loc && data.loc.id) {
            try {
                const qrResponse = await this.httpsRequest('cdpj.partners.bancointer.com.br', `/pix/v2/loc/${data.loc.id}/qrcode`, 'GET', {
                    'Authorization': `Bearer ${token}`,
                    'x-inter-conta-corrente': accountNumber
                }, bankAccount);
                if (qrResponse) {
                    const qrData = JSON.parse(qrResponse);
                    qrCodeBase64 = qrData.imagemPng || '';
                }
            } catch (e) {
                console.error('Erro ao buscar imagem do QRCode Pix:', e);
            }
        }
        
        return {
            txid: data.txid || activeTxid,
            pixCopiaECola: data.pixCopiaECola,
            qrCodeBase64
        };
    }
}
