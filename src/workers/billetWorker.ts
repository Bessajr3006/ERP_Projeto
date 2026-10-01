import pool from '../config/db';
import logger from '../config/logger';
import { FinanceService } from '../services/financeService';
import { RowDataPacket } from 'mysql2';

let isPolling = false;

async function processAutoGenerateBillets(): Promise<void> {
    try {
        // Get current time formatted as HH:MM in America/Sao_Paulo timezone
        const now = new Date();
        const currentTime = now.toLocaleTimeString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Find all pending/progress income boleto transactions due today or in the future
        // where the company has auto generation active at the current hour
        const query = `
            SELECT t.public_id, t.company_id, t.description
            FROM transactions t
            JOIN companies c ON t.company_id = c.id
            LEFT JOIN customers cust ON t.customer_id = cust.id
            WHERE c.auto_generate_billets = 1
              AND c.auto_generate_billets_time = ?
              AND t.type = 'income'
              AND t.payment_method = 'boleto'
              AND t.status IN ('pending', 'progress')
              AND t.billet_url IS NULL
              AND t.barcode IS NULL
              AND t.date >= CURDATE()
              AND (cust.only_pix IS NULL OR cust.only_pix = 0)
        `;

        const [rows] = await pool.query<RowDataPacket[]>(query, [currentTime]);

        if (rows && rows.length > 0) {
            logger.info({ count: rows.length, time: currentTime }, '[BilletWorker] Iniciando geração automática de boletos');
            
            for (const row of rows) {
                try {
                    logger.info({ txPublicId: row.public_id, companyId: row.company_id }, `[BilletWorker] Gerando boleto para: ${row.description}`);
                    await FinanceService.generateBillet(row.company_id, row.public_id);
                } catch (err: any) {
                    logger.error({ err, txPublicId: row.public_id, companyId: row.company_id }, `[BilletWorker] Falha ao gerar boleto para: ${row.description}`);
                }
            }
        }
    } catch (err) {
        logger.error({ err }, '[BilletWorker] Erro durante o processo de geração automática de boletos');
    }
}

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

export function startBilletWorker() {
    if (isPolling) return;
    isPolling = true;
    logger.info('[BilletWorker] Worker de geração automática de boletos iniciado!');

    setImmediate(async () => {
        // Wait for database connection and run once every 60 seconds
        while (isPolling) {
            await processAutoGenerateBillets();
            await sleep(60000); // Poll every minute
        }
    });
}
