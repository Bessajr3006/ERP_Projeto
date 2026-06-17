const pdfParse = require('pdf-parse');

export interface ExtractedValues {
    amount_due?: number | null;
    due_date?: string | null;
    gross_revenue?: number | null;
    accumulated_revenue?: number | null;
    document_period?: string | null;
    receipt_number?: string | null;
}

export class PdfExtractionService {
    /**
     * Extrai valores do texto do PDF usando Regex
     * Focado no PGDAS/DAS mas tenta ser flexível.
     */
    static async extractFromBase64(base64Data: string): Promise<ExtractedValues> {
        try {
            // Remove the data URI prefix if present (e.g. data:application/pdf;base64,...)
            const base64Str = base64Data.replace(/^data:application\/pdf;base64,/, '');
            const buffer = Buffer.from(base64Str, 'base64');

            const data = await pdfParse(buffer);
            const text = data.text;

            return this.parseText(text);
        } catch (error) {
            console.error('Failed to parse PDF:', error);
            return {
                amount_due: null,
                due_date: null,
                gross_revenue: null,
                accumulated_revenue: null,
                document_period: null,
                receipt_number: null
            };
        }
    }

    static parseText(text: string): ExtractedValues {
        const result: ExtractedValues = {
            amount_due: null,
            due_date: null,
            gross_revenue: null,
            accumulated_revenue: null,
            document_period: null,
            receipt_number: null
        };

        const isRecibo = text.includes('Declaratório') || text.includes('Declaração Original') || text.includes('Recibo de Entrega');
        const normalizedText = text.replace(/\s+/g, ' ');

        // Função auxiliar para converter string de moeda BR para número
        const parseBrMoney = (str: string) => parseFloat(str.replace(/\./g, '').replace(',', '.'));

        if (isRecibo) {
            // -- PGDAS-D RECIBO --

            // Período de Apuração (ex: 01/04/2026 a 30/04/2026 -> pega 04/2026)
            const periodMatch = text.match(/Per[ií]odo de Apura[cç][aã]o:\s*\d{2}\/(\d{2}\/\d{4})/i) 
                             || normalizedText.match(/Per[ií]odo de Apura[cç][aã]o.*?\d{2}\/(\d{2}\/\d{4})/i);
            if (periodMatch && periodMatch[1]) result.document_period = periodMatch[1];

            // Receita Bruta do PA (RPA)
            const grossMatch = normalizedText.match(/Receita Bruta do PA.*?(\d{1,3}(?:\.\d{3})*,\d{2})/i);
            if (grossMatch && grossMatch[1]) result.gross_revenue = parseBrMoney(grossMatch[1]);

            // Receita Bruta Acumulada (RBT12)
            const accumMatch = normalizedText.match(/\(RBT12\).*?(\d{1,3}(?:\.\d{3})*,\d{2})/i);
            if (accumMatch && accumMatch[1]) result.accumulated_revenue = parseBrMoney(accumMatch[1]);

            // Valor Total do Débito Declarado (Imposto a pagar)
            // No PDF, os valores podem estar colados: "27.800,00561,56"
            // Vamos procurar o padrão de Receita Bruta Auferida seguido de Débito
            const debitoMatch = normalizedText.match(/Receita Bruta Auferida.*?Valor Total do D[eé]bito Declarado[^\d]*(\d{1,3}(?:\.\d{3})*,\d{2})(\d{1,3}(?:\.\d{3})*,\d{2})/i);
            if (debitoMatch && debitoMatch[2]) {
                result.amount_due = parseBrMoney(debitoMatch[2]);
            } else {
                // Fallback para débito
                const fallbackDebito = normalizedText.match(/Total do D[eé]bito Declarado.*?(\d{1,3}(?:\.\d{3})*,\d{2})$/im);
                if (fallbackDebito && fallbackDebito[1]) result.amount_due = parseBrMoney(fallbackDebito[1]);
            }

            // Recibo
            const receiptMatch = normalizedText.match(/N[uú]mero do Recibo:\s*([0-9.\-]+)/i) || normalizedText.match(/Recibo:\s*([0-9.\-]+)/i);
            if (receiptMatch && receiptMatch[1]) result.receipt_number = receiptMatch[1];

        } else {
            // -- DAS BOLETO --

            // Vencimento / Pagar Até
            const dateMatch = normalizedText.match(/(?:vencimento|pagar at[eé]|data de vencimento|Pagar este documento at[eé])[^\d]*(\d{2}\/\d{2}\/\d{4})/i);
            if (dateMatch && dateMatch[1]) {
                const parts = dateMatch[1].split('/');
                result.due_date = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }

            // Período de Apuração
            const periodMatch = normalizedText.match(/Per[ií]odo de Apura[cç][aã]o[^\d]*(\d{2}\/\d{4})/i);
            if (periodMatch && periodMatch[1]) result.document_period = periodMatch[1];

            // Valor Total
            const amountMatch = normalizedText.match(/(?:Valor Total do Documento|Total a Pagar|Valor Principal|Valor a Recolher)[^\d]*(\d{1,3}(?:\.\d{3})*,\d{2})/i);
            if (amountMatch && amountMatch[1]) {
                result.amount_due = parseBrMoney(amountMatch[1]);
            }
        }

        return result;
    }
}
