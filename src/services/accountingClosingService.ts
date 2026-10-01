import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { randomUUID } from 'crypto';

export interface MonthOverview {
    month: number;
    monthName: string;
    competencia: string;
    // Contábil / Importação
    entriesCount: number;
    totalDebit: number;
    totalCredit: number;
    difference: number;
    isBalanced: boolean;
    lastImportDate: string | null;
    importStatus: 'imported' | 'divergent' | 'not_imported' | 'closed';
    accountingStatus: 'open' | 'in_progress' | 'closed' | 'audited';
    
    // Fiscal / Impostos
    faturamento: number;
    compras: number;
    pis: number;
    cofins: number;
    icms: number;
    fecp: number;
    iss: number;
    simplesDas: number;
    irpjMensal: number;
    csllMensal: number;
    totalImpostos: number;
    aliquotaEfetiva: number;
    taxStatus: 'open' | 'calculated' | 'closed' | 'paid';

    // Detalhamento de Fontes e Créditos de Impostos
    pisCredito: number;
    cofinsCredito: number;
    icmsCredito: number;
    pisSource: 'sped' | 'accounting' | 'estimated' | 'none';
    cofinsSource: 'sped' | 'accounting' | 'estimated' | 'none';
    icmsSource: 'sped' | 'accounting' | 'estimated' | 'none';
    
    // Despesas
    despesaFolha: number;
    despesaOperacional: number;
    despesaAdm: number;
    despesaCmv: number;
    
    closedAt: string | null;
    notes: string | null;
}

export interface QuarterOverview {
    quarter: number;
    quarterName: string;
    months: number[];
    faturamento: number;
    
    // IRPJ e CSLL Trimestrais
    baseIrpj: number;
    irpjNormal: number;
    irpjAdicional: number;
    totalIrpj: number;
    baseCsll: number;
    totalCsll: number;
    totalIrpjCsll: number;

    // Impostos Mensais Consolidados no Trimestre
    totalPis: number;
    totalCofins: number;
    totalIcms: number;
    totalFecp: number;
    
    // Carga Tributária Consolidada
    totalTaxes: number;
    aliquotaEfetiva: number;

    quotas: { number: number; value: number; dueDate: string }[];
    status: 'open' | 'calculated' | 'closed';
    notes: string | null;
}

export interface SemesterOverview {
    semester: number;
    semesterName: string;
    months: number[];
    faturamento: number;
    compras: number;
    despesasTotais: number;
    totalPis: number;
    totalCofins: number;
    totalIcms: number;
    totalFecp: number;
    totalIrpj: number;
    totalCsll: number;
    totalImpostos: number;
    resultadoBruto: number;
    resultadoOperacional: number;
    margemLiquida: number;
    status: 'open' | 'in_progress' | 'closed';
    notes: string | null;
}

export interface AnnualOverview {
    year: number;
    faturamentoTotal: number;
    comprasTotais: number;
    despesasTotais: number;
    totalImpostosGeral: number;
    aliquotaEfetivaAnual: number;
    totalLancamentos: number;
    totalDebitos: number;
    totalCreditos: number;
    diferencaContabil: number;
    isBalancedAnual: boolean;
    impostosPorTipo: {
        pis: number;
        cofins: number;
        icms: number;
        fecp: number;
        iss: number;
        simples: number;
        irpj: number;
        csll: number;
        pisCredito: number;
        cofinsCredito: number;
        icmsCredito: number;
    };
    obrigacoes: {
        code: string;
        name: string;
        prazo: string;
        status: 'pending' | 'delivered' | 'waived';
    }[];
    status: 'open' | 'closed' | 'audited';
    notes: string | null;
}

export interface ClosingSummaryResponse {
    year: number;
    companyId: number;
    summary: {
        importedMonthsCount: number;
        closedMonthsCount: number;
        totalYearRevenue: number;
        totalYearTaxes: number;
        totalYearPis: number;
        totalYearCofins: number;
        totalYearIcms: number;
        totalYearFecp: number;
        totalYearEntries: number;
        isFullyBalanced: boolean;
    };
    months: MonthOverview[];
    quarters: QuarterOverview[];
    semesters: SemesterOverview[];
    annual: AnnualOverview;
}

const MONTH_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export class AccountingClosingService {

    static async getClosingOverview(companyId: number, year: number, customerId?: number): Promise<ClosingSummaryResponse> {
        // 1. Query accounting entries aggregation for the year with tax accounts and revenue
        const [entryRows] = await pool.query<RowDataPacket[]>(`
            SELECT 
                MONTH(ae.entry_date) as entry_month,
                COUNT(*) as entries_count,
                SUM(ae.amount) as total_amount,
                MAX(ae.created_at) as last_import_date,
                SUM(CASE 
                    WHEN ca.code LIKE '3-1%' OR ca.name LIKE '%Receita%' 
                    THEN ae.amount ELSE 0 END) as accounting_revenue,
                SUM(CASE 
                    WHEN (da.code LIKE '3-2-01-01-04%' OR da.code LIKE '3-2-02-01-04%' OR ca.code = '2-1-05-01-08' OR da.name = 'PIS' OR ca.name = 'Pis a Recolher')
                    THEN ae.amount ELSE 0 END) as accounting_pis,
                SUM(CASE 
                    WHEN (da.code LIKE '3-2-01-01-05%' OR da.code LIKE '3-2-02-01-05%' OR ca.code = '2-1-05-01-07' OR da.name = 'COFINS' OR ca.name = 'Cofins a Recolher')
                    THEN ae.amount ELSE 0 END) as accounting_cofins,
                SUM(CASE 
                    WHEN (da.code LIKE '3-2-01-01-03%' OR ca.code = '2-1-05-01-09' OR da.name = 'ICMS' OR ca.name = 'ICMS a Recolher')
                    THEN ae.amount ELSE 0 END) as accounting_icms,
                SUM(CASE 
                    WHEN da.code = '1-1-07-01-06' OR da.name LIKE '%PIS a Recuperar%' 
                    THEN ae.amount ELSE 0 END) as accounting_pis_credito,
                SUM(CASE 
                    WHEN da.code = '1-1-07-01-08' OR da.name LIKE '%Cofins a Recuperar%' 
                    THEN ae.amount ELSE 0 END) as accounting_cofins_credito,
                SUM(CASE 
                    WHEN da.code = '1-1-07-01-10' OR da.name LIKE '%ICMS a Recuperar%' 
                    THEN ae.amount ELSE 0 END) as accounting_icms_credito
            FROM accounting_entries ae
            JOIN chart_of_accounts da ON ae.debit_account_id = da.id
            JOIN chart_of_accounts ca ON ae.credit_account_id = ca.id
            WHERE ae.company_id = ? 
              AND YEAR(ae.entry_date) = ?
              AND ae.status = 'active'
            GROUP BY MONTH(ae.entry_date)
        `, [companyId, year]);

        const entriesByMonth = new Map<number, { 
            count: number; 
            totalAmount: number; 
            lastImport: string;
            accountingRevenue: number;
            accountingPis: number;
            accountingCofins: number;
            accountingIcms: number;
            accountingPisCredito: number;
            accountingCofinsCredito: number;
            accountingIcmsCredito: number;
        }>();

        entryRows.forEach((r: any) => {
            const m = Number(r.entry_month);
            entriesByMonth.set(m, {
                count: Number(r.entries_count) || 0,
                totalAmount: Number(r.total_amount) || 0,
                lastImport: r.last_import_date ? new Date(r.last_import_date).toISOString() : '',
                accountingRevenue: Number(r.accounting_revenue) || 0,
                accountingPis: Number(r.accounting_pis) || 0,
                accountingCofins: Number(r.accounting_cofins) || 0,
                accountingIcms: Number(r.accounting_icms) || 0,
                accountingPisCredito: Number(r.accounting_pis_credito) || 0,
                accountingCofinsCredito: Number(r.accounting_cofins_credito) || 0,
                accountingIcmsCredito: Number(r.accounting_icms_credito) || 0
            });
        });

        // 2. Query fechamentos (tax data from SPED and fiscal closings)
        let fechamentoQuery = `
            SELECT *
            FROM fechamentos
            WHERE company_id = ?
              AND (
                  competencia LIKE ? 
                  OR competencia LIKE ?
              )
        `;
        const fechamentoParams: any[] = [companyId, `${year}-%`, `%/${year}`];
        if (customerId) {
            fechamentoQuery += ` AND customer_id = ?`;
            fechamentoParams.push(customerId);
        }

        const [fechamentoRows] = await pool.query<RowDataPacket[]>(fechamentoQuery, fechamentoParams);
        const fechamentoByMonth = new Map<number, any>();
        
        fechamentoRows.forEach((f: any) => {
            let m = 0;
            const comp = String(f.competencia || '');
            if (comp.includes('-')) {
                // YYYY-MM
                const parts = comp.split('-');
                if (Number(parts[0]) === year) {
                    m = Number(parts[1]);
                }
            } else if (comp.includes('/')) {
                // MM/YYYY
                const parts = comp.split('/');
                if (Number(parts[1]) === year) {
                    m = Number(parts[0]);
                }
            }
            if (m >= 1 && m <= 12) {
                // Aggregate in case multiple customers/filiais exist
                const prev = fechamentoByMonth.get(m) || {
                    venda_valor: 0,
                    compra_valor: 0,
                    apuracao_pis: 0,
                    apuracao_cofins: 0,
                    apuracao_icms: 0,
                    apuracao_fecp: 0,
                    despesa_adm: 0,
                    despesa_operacional: 0,
                    despesa_folha: 0,
                    despesa_cmv: 0,
                    imposto_irpj: 0,
                    imposto_csll: 0,
                    simples_faturamento: 0,
                    simples_das: 0,
                    simples_pis: 0,
                    simples_cofins: 0,
                    simples_icms: 0,
                    simples_iss: 0,
                    simples_irpj: 0,
                    simples_csll: 0,
                    simples_cpp: 0
                };

                fechamentoByMonth.set(m, {
                    venda_valor: prev.venda_valor + (Number(f.venda_valor) || 0),
                    compra_valor: prev.compra_valor + (Number(f.compra_valor) || 0),
                    apuracao_pis: prev.apuracao_pis + (Number(f.apuracao_pis) || Number(f.apuracao_aj_pis) || 0),
                    apuracao_cofins: prev.apuracao_cofins + (Number(f.apuracao_cofins) || Number(f.apuracao_aj_cofins) || 0),
                    apuracao_icms: prev.apuracao_icms + (Number(f.apuracao_icms) || Number(f.apuracao_aj_icms) || 0),
                    apuracao_fecp: prev.apuracao_fecp + (Number(f.apuracao_fecp) || Number(f.apuracao_aj_fecp) || 0),
                    despesa_adm: prev.despesa_adm + (Number(f.despesa_adm) || 0),
                    despesa_operacional: prev.despesa_operacional + (Number(f.despesa_operacional) || 0),
                    despesa_folha: prev.despesa_folha + (Number(f.despesa_folha) || 0),
                    despesa_cmv: prev.despesa_cmv + (Number(f.despesa_cmv) || 0),
                    imposto_irpj: prev.imposto_irpj + (Number(f.imposto_irpj) || 0),
                    imposto_csll: prev.imposto_csll + (Number(f.imposto_csll) || 0),
                    simples_faturamento: prev.simples_faturamento + (Number(f.simples_faturamento) || 0),
                    simples_das: prev.simples_das + (Number(f.simples_das) || 0),
                    simples_pis: prev.simples_pis + (Number(f.simples_pis) || 0),
                    simples_cofins: prev.simples_cofins + (Number(f.simples_cofins) || 0),
                    simples_icms: prev.simples_icms + (Number(f.simples_icms) || 0),
                    simples_iss: prev.simples_iss + (Number(f.simples_iss) || 0),
                    simples_irpj: prev.simples_irpj + (Number(f.simples_irpj) || 0),
                    simples_csll: prev.simples_csll + (Number(f.simples_csll) || 0),
                    simples_cpp: prev.simples_cpp + (Number(f.simples_cpp) || 0)
                });
            }
        });

        // 3. Query accounting_period_closings
        const [closingRows] = await pool.query<RowDataPacket[]>(`
            SELECT *
            FROM accounting_period_closings
            WHERE company_id = ? AND year = ?
        `, [companyId, year]);

        const closingsMap = new Map<string, any>();
        closingRows.forEach((c: any) => {
            const key = `${c.period_type}_${c.period_number}`;
            closingsMap.set(key, c);
        });

        // 4. Build 12 Months
        const months: MonthOverview[] = [];
        let importedMonthsCount = 0;
        let closedMonthsCount = 0;
        let totalYearRevenue = 0;
        let totalYearTaxes = 0;
        let totalYearPis = 0;
        let totalYearCofins = 0;
        let totalYearIcms = 0;
        let totalYearFecp = 0;
        let totalYearEntries = 0;
        let isFullyBalanced = true;

        for (let m = 1; m <= 12; m++) {
            const ent = entriesByMonth.get(m) || { 
                count: 0, 
                totalAmount: 0, 
                lastImport: null,
                accountingRevenue: 0,
                accountingPis: 0,
                accountingCofins: 0,
                accountingIcms: 0,
                accountingPisCredito: 0,
                accountingCofinsCredito: 0,
                accountingIcmsCredito: 0
            };
            const fch = fechamentoByMonth.get(m) || {
                venda_valor: 0, compra_valor: 0, apuracao_pis: 0, apuracao_cofins: 0,
                apuracao_icms: 0, apuracao_fecp: 0, despesa_adm: 0, despesa_operacional: 0,
                despesa_folha: 0, despesa_cmv: 0, imposto_irpj: 0, imposto_csll: 0,
                simples_faturamento: 0, simples_das: 0, simples_pis: 0, simples_cofins: 0,
                simples_icms: 0, simples_iss: 0, simples_irpj: 0, simples_csll: 0, simples_cpp: 0
            };
            const closeRec = closingsMap.get(`monthly_${m}`);

            const entriesCount = ent.count;
            // Each entry in Keystone has 1 Debit and 1 Credit of equal amount
            const totalDebit = ent.totalAmount;
            const totalCredit = ent.totalAmount;
            const difference = 0;
            const isBalanced = entriesCount > 0;

            // Revenue Resolution: SPED > Simples > Accounting Revenue
            const faturamento = (fch.venda_valor > 0 ? fch.venda_valor : (fch.simples_faturamento > 0 ? fch.simples_faturamento : ent.accountingRevenue)) || 0;
            const compras = fch.compra_valor || 0;

            // PIS Resolution: SPED > Contábil > Estimativa (0.65% Lucro Presumido)
            let pis = 0;
            let pisSource: 'sped' | 'accounting' | 'estimated' | 'none' = 'none';
            if (fch.apuracao_pis > 0 || fch.simples_pis > 0) {
                pis = fch.apuracao_pis || fch.simples_pis;
                pisSource = 'sped';
            } else if (ent.accountingPis > 0) {
                pis = ent.accountingPis;
                pisSource = 'accounting';
            } else if (faturamento > 0) {
                pis = Math.round(faturamento * 0.0065 * 100) / 100;
                pisSource = 'estimated';
            }

            // COFINS Resolution: SPED > Contábil > Estimativa (3.00% Lucro Presumido)
            let cofins = 0;
            let cofinsSource: 'sped' | 'accounting' | 'estimated' | 'none' = 'none';
            if (fch.apuracao_cofins > 0 || fch.simples_cofins > 0) {
                cofins = fch.apuracao_cofins || fch.simples_cofins;
                cofinsSource = 'sped';
            } else if (ent.accountingCofins > 0) {
                cofins = ent.accountingCofins;
                cofinsSource = 'accounting';
            } else if (faturamento > 0) {
                cofins = Math.round(faturamento * 0.0300 * 100) / 100;
                cofinsSource = 'estimated';
            }

            // ICMS Resolution: SPED > Contábil
            let icms = 0;
            let icmsSource: 'sped' | 'accounting' | 'estimated' | 'none' = 'none';
            if (fch.apuracao_icms > 0 || fch.simples_icms > 0) {
                icms = fch.apuracao_icms || fch.simples_icms;
                icmsSource = 'sped';
            } else if (ent.accountingIcms > 0) {
                icms = ent.accountingIcms;
                icmsSource = 'accounting';
            }

            const fecp = (fch.apuracao_fecp || 0);
            const iss = (fch.simples_iss || 0);
            const simplesDas = (fch.simples_das || 0);
            const irpjM = (fch.imposto_irpj || fch.simples_irpj || 0);
            const csllM = (fch.imposto_csll || fch.simples_csll || 0);

            // Credits
            const pisCredito = ent.accountingPisCredito || 0;
            const cofinsCredito = ent.accountingCofinsCredito || 0;
            const icmsCredito = ent.accountingIcmsCredito || 0;

            // Total taxes for the month
            let totalImpostos = 0;
            if (simplesDas > 0) {
                totalImpostos = simplesDas;
            } else {
                totalImpostos = pis + cofins + icms + fecp + iss + irpjM + csllM;
            }

            const aliquotaEfetiva = faturamento > 0 ? (totalImpostos / faturamento) * 100 : 0;

            let accountingStatus: 'open' | 'in_progress' | 'closed' | 'audited' = 'open';
            let taxStatus: 'open' | 'calculated' | 'closed' | 'paid' = 'open';
            let closedAt: string | null = null;
            let notes: string | null = null;

            if (closeRec) {
                accountingStatus = closeRec.accounting_status || 'open';
                taxStatus = closeRec.tax_status || 'open';
                closedAt = closeRec.closed_at ? new Date(closeRec.closed_at).toISOString() : null;
                notes = closeRec.notes || null;
            } else {
                if (entriesCount > 0) accountingStatus = 'in_progress';
                if (totalImpostos > 0 || faturamento > 0) taxStatus = 'calculated';
            }

            let importStatus: 'imported' | 'divergent' | 'not_imported' | 'closed' = 'not_imported';
            if (accountingStatus === 'closed' || accountingStatus === 'audited') {
                importStatus = 'closed';
            } else if (entriesCount > 0) {
                importStatus = 'imported';
            }

            if (entriesCount > 0) importedMonthsCount++;
            if (accountingStatus === 'closed' || taxStatus === 'closed') closedMonthsCount++;

            totalYearRevenue += faturamento;
            totalYearTaxes += totalImpostos;
            totalYearPis += pis;
            totalYearCofins += cofins;
            totalYearIcms += icms;
            totalYearFecp += fecp;
            totalYearEntries += entriesCount;

            const competencia = `${year}-${String(m).padStart(2, '0')}`;

            months.push({
                month: m,
                monthName: MONTH_NAMES[m - 1] ?? `Mês ${m}`,
                competencia,
                entriesCount,
                totalDebit,
                totalCredit,
                difference,
                isBalanced,
                lastImportDate: ent.lastImport,
                importStatus,
                accountingStatus,
                faturamento,
                compras,
                pis,
                cofins,
                icms,
                fecp,
                iss,
                simplesDas,
                irpjMensal: irpjM,
                csllMensal: csllM,
                totalImpostos,
                aliquotaEfetiva,
                taxStatus,
                pisCredito,
                cofinsCredito,
                icmsCredito,
                pisSource,
                cofinsSource,
                icmsSource,
                despesaFolha: fch.despesa_folha || 0,
                despesaOperacional: fch.despesa_operacional || 0,
                despesaAdm: fch.despesa_adm || 0,
                despesaCmv: fch.despesa_cmv || 0,
                closedAt,
                notes
            });
        }

        // 5. Build 4 Quarters
        const quarters: QuarterOverview[] = [];
        const quarterConfigs = [
            { q: 1, name: '1º Trimestre (Jan - Mar)', months: [1, 2, 3] },
            { q: 2, name: '2º Trimestre (Abr - Jun)', months: [4, 5, 6] },
            { q: 3, name: '3º Trimestre (Jul - Set)', months: [7, 8, 9] },
            { q: 4, name: '4º Trimestre (Out - Dez)', months: [10, 11, 12] }
        ];

        for (const qc of quarterConfigs) {
            const qMonths = months.filter(m => qc.months.includes(m.month));
            const faturamentoQ = qMonths.reduce((acc, curr) => acc + curr.faturamento, 0);
            const totalPisQ = qMonths.reduce((acc, curr) => acc + curr.pis, 0);
            const totalCofinsQ = qMonths.reduce((acc, curr) => acc + curr.cofins, 0);
            const totalIcmsQ = qMonths.reduce((acc, curr) => acc + curr.icms, 0);
            const totalFecpQ = qMonths.reduce((acc, curr) => acc + curr.fecp, 0);
            
            // Lucro Presumido standard rates (8% base comércio / 32% serviços; default 8%)
            const baseIrpj = faturamentoQ * 0.08;
            const irpjNormal = baseIrpj * 0.15;
            // Adicional 10% on base exceeding R$ 60.000,00 in the quarter
            const irpjAdicional = baseIrpj > 60000 ? (baseIrpj - 60000) * 0.10 : 0;
            const totalIrpj = irpjNormal + irpjAdicional;

            // CSLL Presumida 12% base * 9%
            const baseCsll = faturamentoQ * 0.12;
            const totalCsll = baseCsll * 0.09;

            const totalIrpjCsll = totalIrpj + totalCsll;
            // Carga Tributária Total Trimestral (IRPJ + CSLL + PIS + COFINS + ICMS + FECP)
            const totalTaxes = totalIrpjCsll + totalPisQ + totalCofinsQ + totalIcmsQ + totalFecpQ;
            const aliquotaEfetiva = faturamentoQ > 0 ? (totalTaxes / faturamentoQ) * 100 : 0;

            // 3 Quotas simulation for IRPJ/CSLL
            const quotaVal = totalIrpjCsll / 3;
            const lastM = qc.months[qc.months.length - 1] ?? (qc.q * 3);
            const dueMonths = [lastM + 1, lastM + 2, lastM + 3];
            const quotas = [
                { number: 1, value: quotaVal, dueDate: `30/${String(dueMonths[0]).padStart(2, '0')}/${year}` },
                { number: 2, value: quotaVal, dueDate: `31/${String(dueMonths[1]).padStart(2, '0')}/${year}` },
                { number: 3, value: quotaVal, dueDate: `30/${String(dueMonths[2]).padStart(2, '0')}/${year}` }
            ];

            const closeRec = closingsMap.get(`quarterly_${qc.q}`);
            const status: 'open' | 'calculated' | 'closed' = closeRec?.tax_status || (totalTaxes > 0 ? 'calculated' : 'open');
            const notes = closeRec?.notes || null;

            quarters.push({
                quarter: qc.q,
                quarterName: qc.name,
                months: qc.months,
                faturamento: faturamentoQ,
                baseIrpj,
                irpjNormal,
                irpjAdicional,
                totalIrpj,
                baseCsll,
                totalCsll,
                totalIrpjCsll,
                totalPis: totalPisQ,
                totalCofins: totalCofinsQ,
                totalIcms: totalIcmsQ,
                totalFecp: totalFecpQ,
                totalTaxes,
                aliquotaEfetiva,
                quotas,
                status,
                notes
            });
        }

        // 6. Build 2 Semesters
        const semesters: SemesterOverview[] = [];
        const semesterConfigs = [
            { s: 1, name: '1º Semestre (Jan - Jun)', months: [1, 2, 3, 4, 5, 6] },
            { s: 2, name: '2º Semestre (Jul - Dez)', months: [7, 8, 9, 10, 11, 12] }
        ];

        for (const sc of semesterConfigs) {
            const sMonths = months.filter(m => sc.months.includes(m.month));
            const sQuarters = quarters.filter(q => (sc.s === 1 ? [1, 2].includes(q.quarter) : [3, 4].includes(q.quarter)));
            
            const faturamentoS = sMonths.reduce((acc, curr) => acc + curr.faturamento, 0);
            const comprasS = sMonths.reduce((acc, curr) => acc + curr.compras, 0);
            const despesasTotaisS = sMonths.reduce((acc, curr) => acc + curr.despesaFolha + curr.despesaOperacional + curr.despesaAdm + curr.despesaCmv, 0);
            
            const totalPisS = sMonths.reduce((acc, curr) => acc + curr.pis, 0);
            const totalCofinsS = sMonths.reduce((acc, curr) => acc + curr.cofins, 0);
            const totalIcmsS = sMonths.reduce((acc, curr) => acc + curr.icms, 0);
            const totalFecpS = sMonths.reduce((acc, curr) => acc + curr.fecp, 0);
            const totalIrpjS = sQuarters.reduce((acc, curr) => acc + curr.totalIrpj, 0);
            const totalCsllS = sQuarters.reduce((acc, curr) => acc + curr.totalCsll, 0);
            const totalImpostosS = totalPisS + totalCofinsS + totalIcmsS + totalFecpS + totalIrpjS + totalCsllS;
            
            const resultadoBruto = faturamentoS - comprasS;
            const resultadoOperacional = resultadoBruto - despesasTotaisS - totalImpostosS;
            const margemLiquida = faturamentoS > 0 ? (resultadoOperacional / faturamentoS) * 100 : 0;

            const closeRec = closingsMap.get(`semiannual_${sc.s}`);
            const status: 'open' | 'in_progress' | 'closed' = closeRec?.accounting_status || (faturamentoS > 0 ? 'in_progress' : 'open');
            const notes = closeRec?.notes || null;

            semesters.push({
                semester: sc.s,
                semesterName: sc.name,
                months: sc.months,
                faturamento: faturamentoS,
                compras: comprasS,
                despesasTotais: despesasTotaisS,
                totalPis: totalPisS,
                totalCofins: totalCofinsS,
                totalIcms: totalIcmsS,
                totalFecp: totalFecpS,
                totalIrpj: totalIrpjS,
                totalCsll: totalCsllS,
                totalImpostos: totalImpostosS,
                resultadoBruto,
                resultadoOperacional,
                margemLiquida,
                status,
                notes
            });
        }

        // 7. Build Annual Overview
        const totalDebitosAnual = months.reduce((acc, curr) => acc + curr.totalDebit, 0);
        const totalCreditosAnual = months.reduce((acc, curr) => acc + curr.totalCredit, 0);
        const diferencaContabil = totalDebitosAnual - totalCreditosAnual;
        const isBalancedAnual = Math.abs(diferencaContabil) < 0.01 && totalYearEntries > 0;

        const annualTaxBreakdown = {
            pis: months.reduce((acc, curr) => acc + curr.pis, 0),
            cofins: months.reduce((acc, curr) => acc + curr.cofins, 0),
            icms: months.reduce((acc, curr) => acc + curr.icms, 0),
            fecp: months.reduce((acc, curr) => acc + curr.fecp, 0),
            iss: months.reduce((acc, curr) => acc + curr.iss, 0),
            simples: months.reduce((acc, curr) => acc + curr.simplesDas, 0),
            irpj: quarters.reduce((acc, curr) => acc + curr.totalIrpj, 0),
            csll: quarters.reduce((acc, curr) => acc + curr.totalCsll, 0),
            pisCredito: months.reduce((acc, curr) => acc + curr.pisCredito, 0),
            cofinsCredito: months.reduce((acc, curr) => acc + curr.cofinsCredito, 0),
            icmsCredito: months.reduce((acc, curr) => acc + curr.icmsCredito, 0)
        };

        const comprasTotaisAnual = months.reduce((acc, curr) => acc + curr.compras, 0);
        const despesasTotaisAnual = months.reduce((acc, curr) => acc + curr.despesaFolha + curr.despesaOperacional + curr.despesaAdm + curr.despesaCmv, 0);
        const totalImpostosGeral = annualTaxBreakdown.pis + annualTaxBreakdown.cofins + annualTaxBreakdown.icms + 
                                   annualTaxBreakdown.fecp + annualTaxBreakdown.iss + annualTaxBreakdown.simples + 
                                   annualTaxBreakdown.irpj + annualTaxBreakdown.csll;
        const aliquotaEfetivaAnual = totalYearRevenue > 0 ? (totalImpostosGeral / totalYearRevenue) * 100 : 0;

        const annualCloseRec = closingsMap.get('annual_1');
        const annualStatus: 'open' | 'closed' | 'audited' = annualCloseRec?.accounting_status || 'open';
        const annualNotes = annualCloseRec?.notes || null;

        const annual: AnnualOverview = {
            year,
            faturamentoTotal: totalYearRevenue,
            comprasTotais: comprasTotaisAnual,
            despesasTotais: despesasTotaisAnual,
            totalImpostosGeral,
            aliquotaEfetivaAnual,
            totalLancamentos: totalYearEntries,
            totalDebitos: totalDebitosAnual,
            totalCreditos: totalCreditosAnual,
            diferencaContabil,
            isBalancedAnual,
            impostosPorTipo: annualTaxBreakdown,
            obrigacoes: [
                { code: 'ECD', name: 'SPED Contábil (ECD)', prazo: `31/05/${year + 1}`, status: annualStatus === 'closed' ? 'delivered' : 'pending' },
                { code: 'ECF', name: 'SPED ECF (Escrituração Contábil Fiscal)', prazo: `31/07/${year + 1}`, status: annualStatus === 'closed' ? 'delivered' : 'pending' },
                { code: 'EFD_ICMS', name: 'EFD ICMS/IPI (SPED Fiscal)', prazo: `15/mês subsequente`, status: annualTaxBreakdown.icms > 0 ? 'delivered' : 'pending' },
                { code: 'EFD_CONTRIB', name: 'EFD Contribuições (PIS & COFINS)', prazo: `10º dia útil/2º mês`, status: (annualTaxBreakdown.pis > 0 || annualTaxBreakdown.cofins > 0) ? 'delivered' : 'pending' },
                { code: 'DEFIS', name: 'DEFIS (Declaração Simples Nacional)', prazo: `31/03/${year + 1}`, status: annualStatus === 'closed' ? 'delivered' : 'pending' },
                { code: 'DRE_BALANCO', name: 'DRE & Balanço Patrimonial do Exercício', prazo: `31/12/${year}`, status: isBalancedAnual ? 'delivered' : 'pending' }
            ],
            status: annualStatus,
            notes: annualNotes
        };

        return {
            year,
            companyId,
            summary: {
                importedMonthsCount,
                closedMonthsCount,
                totalYearRevenue,
                totalYearTaxes: totalImpostosGeral,
                totalYearPis,
                totalYearCofins,
                totalYearIcms,
                totalYearFecp,
                totalYearEntries,
                isFullyBalanced
            },
            months,
            quarters,
            semesters,
            annual
        };
    }

    static async togglePeriodStatus(
        companyId: number,
        data: {
            periodType: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
            year: number;
            periodNumber: number;
            accountingStatus?: 'open' | 'in_progress' | 'closed' | 'audited' | undefined;
            taxStatus?: 'open' | 'calculated' | 'closed' | 'paid' | undefined;
            notes?: string | undefined;
        },
        userId?: number | undefined
    ): Promise<any> {
        const publicId = randomUUID();
        const now = new Date();

        const [existing] = await pool.query<RowDataPacket[]>(`
            SELECT id FROM accounting_period_closings
            WHERE company_id = ? AND period_type = ? AND year = ? AND period_number = ?
        `, [companyId, data.periodType, data.year, data.periodNumber]);

        if (existing.length > 0) {
            const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
            const params: any[] = [];

            if (data.accountingStatus) {
                updates.push('accounting_status = ?');
                params.push(data.accountingStatus);
                if (data.accountingStatus === 'closed') {
                    updates.push('closed_at = ?');
                    params.push(now);
                    if (userId) {
                        updates.push('closed_by_user_id = ?');
                        params.push(userId);
                    }
                } else if (data.accountingStatus === 'open') {
                    updates.push('closed_at = NULL');
                    updates.push('closed_by_user_id = NULL');
                }
            }

            if (data.taxStatus) {
                updates.push('tax_status = ?');
                params.push(data.taxStatus);
            }

            if (data.notes !== undefined) {
                updates.push('notes = ?');
                params.push(data.notes);
            }

            params.push(companyId, data.periodType, data.year, data.periodNumber);

            await pool.query<ResultSetHeader>(`
                UPDATE accounting_period_closings
                SET ${updates.join(', ')}
                WHERE company_id = ? AND period_type = ? AND year = ? AND period_number = ?
            `, params);

            return { success: true, action: 'updated' };
        } else {
            const accStatus = data.accountingStatus || 'closed';
            const taxStatus = data.taxStatus || 'closed';
            const closedAt = accStatus === 'closed' || taxStatus === 'closed' ? now : null;

            await pool.query<ResultSetHeader>(`
                INSERT INTO accounting_period_closings (
                    public_id, company_id, period_type, year, period_number,
                    accounting_status, tax_status, closed_at, closed_by_user_id, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                publicId, companyId, data.periodType, data.year, data.periodNumber,
                accStatus, taxStatus, closedAt, userId || null, data.notes || null
            ]);

            return { success: true, action: 'created' };
        }
    }
}
