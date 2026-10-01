export interface Fechamento {
    id: number;
    public_id: string;
    company_id: number;
    customer_id: number;
    competencia: string;
    
    compra_valor: number;
    compra_bs_icms: number;
    compra_isento: number;
    compra_outros: number;
    compra_pis: number;
    compra_cofins: number;
    
    venda_valor: number;
    venda_bs_icms: number;
    venda_isento: number;
    venda_outros: number;
    venda_pis: number;
    venda_cofins: number;
    
    apuracao_icms: number;
    apuracao_fecp: number;
    apuracao_pis: number;
    apuracao_cofins: number;
    apuracao_aj_icms: number;
    apuracao_aj_fecp: number;
    apuracao_aj_pis: number;
    apuracao_aj_cofins: number;
    
    despesa_adm: number;
    despesa_operacional: number;
    despesa_folha: number;
    despesa_cmv: number;
    despesa_ir_aluguel: number;
    
    imposto_irpj: number;
    imposto_csll: number;
    simples_faturamento: number;
    simples_aliquota: number;
    simples_das: number;
    simples_cpp: number;
    simples_icms: number;
    simples_ipi: number;
    simples_iss: number;
    simples_pis: number;
    simples_cofins: number;
    simples_irpj: number;
    simples_csll: number;
    simples_faturamento_acumulado_12m: number;
    simples_faturamento_acumulado_ano_anterior: number;
    simples_valor_tributado: number;
    simples_valor_nao_tributado: number;
    observacao: string | null;
    
    created_at?: Date;
    updated_at?: Date;
    
    // Optional joined field
    customer_name?: string;
    customer_trade_name?: string | null;
    customer_cnpj_cpf?: string | null;
    origem?: 'Arquivo' | 'Manual' | string;
}

export interface CreateFechamentoData {
    customerId: string | number | undefined;
    competencia: string | undefined;
    compra?: {
        valor?: number | undefined;
        bs_icms?: number | undefined;
        isento?: number | undefined;
        outros?: number | undefined;
        pis?: number | undefined;
        cofins?: number | undefined;
    } | undefined;
    venda?: {
        valor?: number | undefined;
        bs_icms?: number | undefined;
        isento?: number | undefined;
        outros?: number | undefined;
        pis?: number | undefined;
        cofins?: number | undefined;
    } | undefined;
    apuracao?: {
        icms?: number | undefined;
        fecp?: number | undefined;
        pis?: number | undefined;
        cofins?: number | undefined;
        aj_icms?: number | undefined;
        aj_fecp?: number | undefined;
        aj_pis?: number | undefined;
        aj_cofins?: number | undefined;
    } | undefined;
    despesa?: {
        adm?: number | undefined;
        operacional?: number | undefined;
        folha?: number | undefined;
        cmv?: number | undefined;
        ir_aluguel?: number | undefined;
    } | undefined;
    imposto_federal?: {
        irpj?: number | undefined;
        csll?: number | undefined;
    } | undefined;
    simples?: {
        faturamento?: number | undefined;
        aliquota?: number | undefined;
        das?: number | undefined;
        cpp?: number | undefined;
        icms?: number | undefined;
        ipi?: number | undefined;
        iss?: number | undefined;
        pis?: number | undefined;
        cofins?: number | undefined;
        irpj?: number | undefined;
        csll?: number | undefined;
        faturamento_acumulado_12m?: number | undefined;
        faturamento_acumulado_ano_anterior?: number | undefined;
        valor_tributado?: number | undefined;
        valor_nao_tributado?: number | undefined;
    } | undefined;
    observacao?: string | null | undefined;
}

export type UpdateFechamentoData = Partial<CreateFechamentoData>;
