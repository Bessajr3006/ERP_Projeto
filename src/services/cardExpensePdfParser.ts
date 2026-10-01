import pdfParse from 'pdf-parse';

export interface ParsedTransaction {
    date: string; // YYYY-MM-DD
    description: string;
    value: number;
    tempo?: string | null;
}

export interface ParseResult {
    period: string; // YYYY-MM
    transactions: ParsedTransaction[];
}

const MONTHS_MAP: { [key: string]: number } = {
    jan: 1, janeiro: 1,
    fev: 2, fevereiro: 2,
    mar: 3, marco: 3, março: 3,
    abr: 4, abril: 4,
    mai: 5, maio: 5,
    jun: 6, junho: 6,
    jul: 7, julho: 7,
    ago: 8, agosto: 8,
    set: 9, setembro: 9,
    out: 10, outubro: 10,
    nov: 11, novembro: 11,
    dez: 12, dezembro: 12
};

export class CardExpensePdfParser {
    static async parsePdf(base64Data: string): Promise<ParseResult> {
        try {
            const base64Str = base64Data.replace(/^data:application\/pdf;base64,/, '');
            const buffer = Buffer.from(base64Str, 'base64');
            const parsed = await pdfParse(buffer);
            return this.parseText(parsed.text);
        } catch (error) {
            console.error('Error parsing credit card statement PDF:', error);
            // Return empty result
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            return {
                period: `${year}-${month}`,
                transactions: []
            };
        }
    }

    static parseText(text: string): ParseResult {
        const rawLines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        
        // Combine multiline transactions (e.g. description wraps and value is on next line)
        const lines: string[] = [];
        let pendingLine = '';

        for (const rawLine of rawLines) {
            const line = rawLine.trim();
            if (line.length === 0) continue;

            const startsWithDate = this.lineStartsWithDate(line);

            if (startsWithDate) {
                if (pendingLine) {
                    lines.push(pendingLine);
                }
                pendingLine = line;
            } else {
                if (pendingLine) {
                    const hasValue = this.lineEndsWithValue(pendingLine);
                    if (hasValue) {
                        lines.push(pendingLine);
                        pendingLine = line;
                    } else {
                        pendingLine = pendingLine + ' ' + line;
                    }
                } else {
                    pendingLine = line;
                }
            }
        }
        if (pendingLine) {
            lines.push(pendingLine);
        }

        // 1. Detect Period
        let refYear = new Date().getFullYear();
        let refMonth = new Date().getMonth() + 1; // 1-indexed

        const normalizedText = text.replace(/\s+/g, ' ');
        // Look for typical due dates or statements periods, e.g. "Vencimento: 10/07/2026"
        const fullDateMatch = normalizedText.match(/(?:vencimento|pagar at[eé]|fatura de|periodo|per[ií]odo)[^\d]*(\d{2})[/\-](\d{2})[/\-](\d{4})/i);
        if (fullDateMatch && fullDateMatch[2] && fullDateMatch[3]) {
            refYear = parseInt(fullDateMatch[3], 10);
            refMonth = parseInt(fullDateMatch[2], 10);
        } else {
            // Check for format: month name + year (e.g. "Julho/2026" or "Julho de 2026" or "Jul 2026")
            const monthYearMatch = normalizedText.match(/\b(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b[^\d]*(\d{4})/i);
            if (monthYearMatch && monthYearMatch[1] && monthYearMatch[2]) {
                const monthStr = monthYearMatch[1].toLowerCase();
                refYear = parseInt(monthYearMatch[2], 10);
                if (MONTHS_MAP[monthStr]) {
                    refMonth = MONTHS_MAP[monthStr];
                }
            } else {
                // Fallback: look for any DD/MM/YYYY date in the text to get reference year/month
                const anyDateMatch = normalizedText.match(/\b(\d{2})[/\-](\d{2})[/\-](\d{4})\b/);
                if (anyDateMatch && anyDateMatch[2] && anyDateMatch[3]) {
                    refYear = parseInt(anyDateMatch[3], 10);
                    refMonth = parseInt(anyDateMatch[2], 10);
                }
            }
        }

        const period = `${refYear}-${String(refMonth).padStart(2, '0')}`;
        const transactions: ParsedTransaction[] = [];

        // Words that indicate non-expense lines (payments, credits, interest, etc.)
        const EXCLUDED_WORDS = [
            'pagamento', 'pagto', 'recebido', 'sua fatura', 'obrigado',
            'saldo anterior', 'total da fatura', 'limite', 'credito', 'crédito',
            'estorno', 'fatura anterior', 'encargos', 'juros', 'multa'
        ];

        // 2. Parse Lines for Transactions
        for (const line of lines) {
            // Check for exclusions early
            const lowerLine = line.toLowerCase();
            if (EXCLUDED_WORDS.some(w => lowerLine.includes(w))) {
                continue;
            }

            // Regex patterns for line parsing:
            // Match date at start of line:
            // 1. DD/MM/YYYY or DD-MM-YYYY
            // 2. DD/MM or DD-MM
            // 3. DD MMM (e.g. 10 JUL or 10 Jul or 10 de Jul)
            let dateMatch = line.match(/^(\d{2})[/\-](\d{2})[/\-](\d{4})\b/);
            let day = 0;
            let month = 0;
            let year = refYear;
            let restOfLine = '';

            if (dateMatch && dateMatch[1] && dateMatch[2] && dateMatch[3]) {
                day = parseInt(dateMatch[1], 10);
                month = parseInt(dateMatch[2], 10);
                year = parseInt(dateMatch[3], 10);
                restOfLine = line.substring(dateMatch[0].length).trim();
            } else {
                dateMatch = line.match(/^(\d{2})[/\-](\d{2})\b/);
                if (dateMatch && dateMatch[1] && dateMatch[2]) {
                    day = parseInt(dateMatch[1], 10);
                    month = parseInt(dateMatch[2], 10);
                    restOfLine = line.substring(dateMatch[0].length).trim();
                    year = this.resolveYear(day, month, refYear, refMonth);
                } else {
                    // Try DD MMM pattern
                    dateMatch = line.match(/^(\d{2})\s+(de\s+)?(jan|feb|fev|mar|apr|abr|may|mai|jun|jul|aug|ago|sep|set|oct|out|nov|dec|dez)[a-z]*\b/i);
                    if (dateMatch && dateMatch[1] && dateMatch[3]) {
                        day = parseInt(dateMatch[1], 10);
                        const monthStr = dateMatch[3].toLowerCase();
                        month = MONTHS_MAP[monthStr] || refMonth;
                        restOfLine = line.substring(dateMatch[0].length).trim();
                        year = this.resolveYear(day, month, refYear, refMonth);
                    }
                }
            }

            if (day === 0 || month === 0) {
                continue; // Line doesn't start with a date
            }

            // Now parse description and value from the restOfLine
            // Value is typically at the end of the line, e.g. "1.234,56" or "12,34" or "12.34"
            // Support optional minus signs or CR credits at the end, but normally card statements list expenses
            // We search for a numeric pattern at the end:
            const valueMatch = restOfLine.match(/([\-+]?\s*\d+(?:\.\d{3})*,\d{2}|[\-+]?\s*\d+\.\d{2})\s*(?:c|cr|d)?$/i);
            if (valueMatch && valueMatch[1]) {
                const valueStr = valueMatch[1].replace(/\s+/g, '');
                // Convert to number
                let value = 0;
                if (valueStr.includes(',')) {
                    value = parseFloat(valueStr.replace(/\./g, '').replace(',', '.'));
                } else {
                    value = parseFloat(valueStr);
                }

                // If value is NaN or <= 0 (e.g. credit/payment), skip or proceed
                if (isNaN(value) || value <= 0) {
                    continue; 
                }

                // Description is everything between the date and the value
                let description = restOfLine.substring(0, restOfLine.lastIndexOf(valueMatch[0])).trim();
                
                // Extract tempo (installment number like XX/YY, e.g. 09/12)
                let tempo: string | null = null;
                const tempoMatch = description.match(/(\d{2}\/\d{2})/);
                if (tempoMatch && tempoMatch[1]) {
                    tempo = tempoMatch[1];
                    description = description.replace(tempoMatch[0], '');
                }

                // Clean up description (remove leading/trailing hyphens, dots, spaces, etc.)
                description = description.replace(/\s+/g, ' ').replace(/^[\s\-\.]+|[\s\-\.]+$/g, '').trim();

                if (description.length > 0) {
                    const formattedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    transactions.push({
                        date: formattedDate,
                        description: description,
                        value: value,
                        tempo: tempo
                    });
                }
            }
        }

        return {
            period,
            transactions
        };
    }

    private static resolveYear(_day: number, month: number, refYear: number, refMonth: number): number {
        let year = refYear;
        if (month === 12 && refMonth === 1) {
            year = refYear - 1;
        } else if (month === 1 && refMonth === 12) {
            year = refYear + 1;
        } else if (month > refMonth) {
            if (month - refMonth > 6) {
                year = refYear - 1;
            }
        } else if (refMonth > month) {
            if (refMonth - month > 6) {
                year = refYear + 1;
            }
        }
        return year;
    }

    private static lineStartsWithDate(line: string): boolean {
        const dateMatch = line.match(/^(\d{2})[/\-](\d{2})[/\-](\d{4})\b/) 
                       || line.match(/^(\d{2})[/\-](\d{2})\b/)
                       || line.match(/^(\d{2})\s+(de\s+)?(jan|feb|fev|mar|apr|abr|may|mai|jun|jul|aug|ago|sep|set|oct|out|nov|dec|dez)[a-z]*\b/i);
        return !!dateMatch;
    }

    private static lineEndsWithValue(line: string): boolean {
        const valueMatch = line.match(/([\-+]?\s*\d+(?:\.\d{3})*,\d{2}|[\-+]?\s*\d+\.\d{2})\s*(?:c|cr|d|\-)?$/i);
        return !!valueMatch;
    }
}
