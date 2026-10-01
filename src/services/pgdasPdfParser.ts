import pdfParse from 'pdf-parse';

export interface PgdasMonthlyRevenue {
    mesAno: string;       // MM/YYYY
    competencia: string;  // YYYY-MM
    valor: number;
}

export interface PgdasTaxes {
    irpj: number;
    csll: number;
    cofins: number;
    pis: number;
    cpp: number;
    icms: number;
    ipi: number;
    iss: number;
    total: number;
}

export interface PgdasExtractedData {
    cnpj: string | null;
    cnpj_limpo: string | null;
    razao_social: string | null;
    competencia: string | null;      // YYYY-MM
    periodo_inicio: string | null;   // YYYY-MM-DD
    periodo_fim: string | null;      // YYYY-MM-DD
    numero_declaracao: string | null;
    numero_recibo: string | null;
    autenticacao: string | null;
    faturamento_mes: number;
    rbt12: number;
    rbt12p: number;
    rba: number;
    rbaa: number;
    total_das: number;
    aliquota_efetiva: number;
    tributos: PgdasTaxes;
    substituicao_tributaria: string | null;
    valor_tributado: number;
    valor_nao_tributado: number;
    receitas_anteriores: PgdasMonthlyRevenue[];
    raw_text?: string;
}

export class PgdasPdfParser {
    /**
     * Extrai todos os campos do PGDAS-D / Extrato do Simples Nacional a partir do Buffer do PDF
     */
    static async parseBuffer(buffer: Buffer): Promise<PgdasExtractedData> {
        const data = await pdfParse(buffer);
        return this.parseText(data.text);
    }

    /**
     * Extrai a partir de Base64
     */
    static async parseBase64(base64Data: string): Promise<PgdasExtractedData> {
        const base64Str = base64Data.replace(/^data:application\/pdf;base64,/, '');
        const buffer = Buffer.from(base64Str, 'base64');
        return this.parseBuffer(buffer);
    }

    private static parseBrMoney(str?: string | null): number {
        if (!str) return 0;
        const clean = str.trim().replace(/\./g, '').replace(',', '.');
        const num = parseFloat(clean);
        return isNaN(num) ? 0 : num;
    }

    static parseText(text: string): PgdasExtractedData {
        const result: PgdasExtractedData = {
            cnpj: null,
            cnpj_limpo: null,
            razao_social: null,
            competencia: null,
            periodo_inicio: null,
            periodo_fim: null,
            numero_declaracao: null,
            numero_recibo: null,
            autenticacao: null,
            faturamento_mes: 0,
            rbt12: 0,
            rbt12p: 0,
            rba: 0,
            rbaa: 0,
            total_das: 0,
            aliquota_efetiva: 0,
            tributos: {
                irpj: 0,
                csll: 0,
                cofins: 0,
                pis: 0,
                cpp: 0,
                icms: 0,
                ipi: 0,
                iss: 0,
                total: 0
            },
            substituicao_tributaria: null,
            valor_tributado: 0,
            valor_nao_tributado: 0,
            receitas_anteriores: []
        };

        if (!text) return result;

        // 1. CNPJ Matriz / Estabelecimento
        const cnpjMatch = text.match(/CNPJ\s*(?:Matriz|Estabelecimento)?:\s*([0-9.\-/]{14,18})/i)
                       || text.match(/CNPJ:\s*([0-9.\-/]{14,18})/i);
        if (cnpjMatch && cnpjMatch[1]) {
            result.cnpj = cnpjMatch[1].trim();
            result.cnpj_limpo = result.cnpj.replace(/\D/g, '');
        }

        // 2. Razão Social / Nome Empresarial
        const nomeMatch = text.match(/Nome\s+empresarial:\s*([^\r\n]+)/i);
        if (nomeMatch && nomeMatch[1]) {
            result.razao_social = nomeMatch[1].trim();
        }

        // 3. Período de Apuração / Competência
        const periodMatch = text.match(/Per[ií]odo\s+de\s+Apura[cç][aã]o:\s*(\d{2})\/(\d{2})\/(\d{4})\s*a\s*(\d{2})\/(\d{2})\/(\d{4})/i);
        if (periodMatch) {
            result.periodo_inicio = `${periodMatch[3]}-${periodMatch[2]}-${periodMatch[1]}`;
            result.periodo_fim = `${periodMatch[6]}-${periodMatch[5]}-${periodMatch[4]}`;
            result.competencia = `${periodMatch[6]}-${periodMatch[5]}`;
        } else {
            const singlePeriod = text.match(/Per[ií]odo\s+de\s+Apura[cç][aã]o[^\d]*(\d{2})\/(\d{4})/i);
            if (singlePeriod) {
                result.competencia = `${singlePeriod[2]}-${singlePeriod[1]}`;
            }
        }

        // 4. Número da Declaração
        const declMatch = text.match(/N[ºo°]?\s*da\s*Declara[cç][aã]o:\s*([0-9]+)/i)
                       || text.match(/N[úu]mero\s+da\s+Declara[cç][aã]o:\s*([0-9]+)/i);
        if (declMatch && declMatch[1]) {
            result.numero_declaracao = declMatch[1].trim();
        }

        // 5. Número do Recibo
        const reciboMatch = text.match(/N[úu]mero\s+do\s+Recibo:\s*([0-9.\-]+)/i);
        if (reciboMatch && reciboMatch[1]) {
            result.numero_recibo = reciboMatch[1].trim();
        }

        // 6. Autenticação
        const autMatch = text.match(/Autentica[cç][aã]o:\s*([0-9.]+)/i);
        if (autMatch && autMatch[1]) {
            result.autenticacao = autMatch[1].trim();
        }

        // 7. Receita Bruta do PA (RPA) - Competência
        const rpaMatch = text.match(/Receita\s+Bruta\s+do\s+PA\s*\(RPA\)\s*-\s*Compet[êe]ncia\s+(\d{1,3}(?:\.\d{3})*,\d{2})/i)
                      || text.match(/Receita\s+Bruta\s+Auferida[^\d]*(\d{1,3}(?:\.\d{3})*,\d{2})/i)
                      || text.match(/Receita\s+Bruta\s+Informada:\s*R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i);
        if (rpaMatch && rpaMatch[1]) {
            result.faturamento_mes = this.parseBrMoney(rpaMatch[1]);
        }

        // 8. RBT12 (Receita Bruta Acumulada nos doze meses anteriores)
        const rbt12Match = text.match(/ao\s+PA\s*\(RBT12\)\s+(\d{1,3}(?:\.\d{3})*,\d{2})/i)
                        || text.match(/\(RBT12\)\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i);
        if (rbt12Match && rbt12Match[1]) {
            result.rbt12 = this.parseBrMoney(rbt12Match[1]);
        }

        // 9. RBT12p (Proporcionalizada)
        const rbt12pMatch = text.match(/proporcionalizada\s*\(RBT12p\)\s+(\d{1,3}(?:\.\d{3})*,\d{2})/i)
                         || text.match(/\(RBT12p\)\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i);
        if (rbt12pMatch && rbt12pMatch[1]) {
            result.rbt12p = this.parseBrMoney(rbt12pMatch[1]);
        }

        // 10. RBA (Ano-calendário corrente)
        const rbaMatch = text.match(/corrente\s*\(RBA\)\s+(\d{1,3}(?:\.\d{3})*,\d{2})/i)
                      || text.match(/\(RBA\)\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i);
        if (rbaMatch && rbaMatch[1]) {
            result.rba = this.parseBrMoney(rbaMatch[1]);
        }

        // 11. RBAA (Ano-calendário anterior)
        const rbaaMatch = text.match(/anterior\s*\(RBAA\)\s+(\d{1,3}(?:\.\d{3})*,\d{2})/i)
                       || text.match(/\(RBAA\)\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i);
        if (rbaaMatch && rbaaMatch[1]) {
            result.rbaa = this.parseBrMoney(rbaaMatch[1]);
        }

        // 12. Receitas Brutas Anteriores (Meses Anteriores listados)
        const section22Match = text.match(/2\.2\)\s*Receitas\s+Brutas\s+Anteriores([\s\S]*?)(?:2\.3\)|2\.4\)|Folha\s+de\s+Sal[aá]rios)/i);
        const revenuesMap = new Map<string, number>();

        if (section22Match && section22Match[1]) {
            const block = section22Match[1];
            // No pdf-parse, a data e o valor podem vir colados (ex: 04/202627.800,00)
            const pairRegex = /(\d{2}\/\d{4})\s*(\d{1,3}(?:\.\d{3})*,\d{2})/g;
            let m: RegExpExecArray | null;
            while ((m = pairRegex.exec(block)) !== null) {
                const mesAno = m[1];
                if (!mesAno) continue;
                const valor = this.parseBrMoney(m[2]);
                const parts = mesAno.split('/');
                const mes = parts[0];
                const ano = parts[1];
                if (!mes || !ano) continue;
                const comp = `${ano}-${mes}`;
                
                // Se já existe e for 0, só substitui se o novo for > 0 (por causa de Mercado Externo que repete os meses com 0,00)
                if (!revenuesMap.has(comp) || valor > 0) {
                    revenuesMap.set(comp, valor);
                }
            }
        }

        // Adiciona o mês do PA atual na listagem se houver
        if (result.competencia && result.faturamento_mes > 0) {
            if (!revenuesMap.has(result.competencia) || (revenuesMap.get(result.competencia) === 0 && result.faturamento_mes > 0)) {
                revenuesMap.set(result.competencia, result.faturamento_mes);
            }
        }

        // Converte mapa para array ordenado por competência
        const sortedComps = Array.from(revenuesMap.keys()).sort();
        result.receitas_anteriores = sortedComps.map(comp => {
            const [ano, mes] = comp.split('-');
            return {
                competencia: comp,
                mesAno: `${mes}/${ano}`,
                valor: revenuesMap.get(comp) || 0
            };
        });

        // 13. Resumo da Declaração / Total do Débito Declarado (DAS Total)
        const resumoMatch = text.match(/Receita\s+Bruta\s+Auferida[^\r\n]*Valor\s+Total\s+do\s+D[eé]bito\s+Declarado[^\r\n]*[\r\n]+([\d.,\s]+)/i);
        if (resumoMatch && resumoMatch[1]) {
            const numbers = resumoMatch[1].match(/\d{1,3}(?:\.\d{3})*,\d{2}/g);
            if (numbers && numbers.length >= 2) {
                if (result.faturamento_mes === 0 && numbers[0]) {
                    result.faturamento_mes = this.parseBrMoney(numbers[0]);
                }
                if (numbers[1]) {
                    result.total_das = this.parseBrMoney(numbers[1]);
                    result.tributos.total = result.total_das;
                }
            }
        }

        if (result.total_das === 0) {
            const debitoMatch = text.match(/Valor\s+Total\s+do\s+D[eé]bito\s+Declarado[^\d]*(\d{1,3}(?:\.\d{3})*,\d{2})/i)
                             || text.match(/Total\s+do\s+D[eé]bito\s+Declarado\s*\(exig[íi]vel\s*\+\s*suspenso\)[^\d]*(\d{1,3}(?:\.\d{3})*,\d{2})/i);
            if (debitoMatch && debitoMatch[1]) {
                result.total_das = this.parseBrMoney(debitoMatch[1]);
                result.tributos.total = result.total_das;
            }
        }

        // 14. Tabela de Tributos Detalhados (IRPJ CSLL COFINS PIS/Pasep INSS/CPP ICMS IPI ISS Total)
        const tribBlockMatch = text.match(/IRPJ\s*CSLL\s*COFINS\s*PIS\/Pasep\s*INSS\/CPP\s*ICMS\s*IPI\s*ISS\s*Total\s*[\r\n]+([\d.,\s]+)/i);
        if (tribBlockMatch && tribBlockMatch[1]) {
            const moneyMatches = tribBlockMatch[1].match(/\d{1,3}(?:\.\d{3})*,\d{2}/g);
            if (moneyMatches && moneyMatches.length >= 9) {
                result.tributos = {
                    irpj: this.parseBrMoney(moneyMatches[0]),
                    csll: this.parseBrMoney(moneyMatches[1]),
                    cofins: this.parseBrMoney(moneyMatches[2]),
                    pis: this.parseBrMoney(moneyMatches[3]),
                    cpp: this.parseBrMoney(moneyMatches[4]),
                    icms: this.parseBrMoney(moneyMatches[5]),
                    ipi: this.parseBrMoney(moneyMatches[6]),
                    iss: this.parseBrMoney(moneyMatches[7]),
                    total: this.parseBrMoney(moneyMatches[8])
                };
                if (result.tributos.total > 0) {
                    result.total_das = result.tributos.total;
                }
            }
        }

        // 15. Alíquota Efetiva (%)
        if (result.faturamento_mes > 0 && result.total_das > 0) {
            result.aliquota_efetiva = parseFloat(((result.total_das / result.faturamento_mes) * 100).toFixed(2));
        }

        // 16. Substituição Tributária
        const stMatch = text.match(/Substitui[cç][aã]o\s+tribut[aá]ria\s+de:\s*([^\r\n.]+)/i);
        if (stMatch && stMatch[1]) {
            result.substituicao_tributaria = stMatch[1].trim();
        }

        // 17. Valores Tributados vs Não Tributados
        // Se houver substituição tributária total/parcial
        if (result.faturamento_mes > 0) {
            result.valor_tributado = result.faturamento_mes;
            result.valor_nao_tributado = 0;
        }

        return result;
    }
}
