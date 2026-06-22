import { Router } from 'express';
import { ProductService } from '../services/productService';
import { CompanyService } from '../services/companyService';
import { FinanceTransactionRepository } from '../repositories/financeTransactionRepository';
import pool from '../config/db';
import { RowDataPacket } from 'mysql2/promise';

const router = Router();

/**
 * @openapi
 * /public/catalog/{companyPublicId}:
 *   get:
 *     tags: [Public]
 *     summary: Obter dados do catálogo público de produtos de uma empresa
 *     parameters:
 *       - in: path
 *         name: companyPublicId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Dados do catálogo e empresa }
 *       404: { description: Empresa não encontrada }
 */
router.get('/catalog/:companyPublicId', async (req, res, next) => {
    try {
        const { companyPublicId } = req.params;
        const company = await CompanyService.getByPublicId(companyPublicId);
        const products = await ProductService.listByCompany(company.id);
        const activeProducts = products.filter(p => p.name && p.name.trim() !== '');

        res.status(200).json({
            status: 'success',
            data: {
                company: {
                    trade_name: company.trade_name,
                    company_name: company.company_name,
                    phone: company.phone,
                    email: company.email,
                    logo_url: company.logo_url,
                    logo_base64: company.logo_base64
                },
                products: activeProducts.map(p => ({
                    public_id: p.public_id,
                    name: p.name,
                    description: p.description,
                    sku: p.sku,
                    ean: p.ean,
                    selling_price: p.selling_price,
                    is_promotional: p.is_promotional,
                    promotional_price: p.promotional_price,
                    current_stock: p.current_stock,
                    category_name: p.category_name,
                    stock_type_name: p.stock_type_name,
                    image_url: p.image_url,
                    image_base64: p.image_base64
                }))
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @openapi
 * /public/webhooks/inter/billing:
 *   post:
 *     tags: [Public]
 *     summary: Receber notificações de pagamento de boletos do Banco Inter
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *     responses:
 *       200: { description: Webhook processado }
 */
router.post('/webhooks/inter/billing', async (req, res, next) => {
    try {
        console.log('[Webhook Inter Billing] Received payload:', JSON.stringify(req.body));
        
        // Inter's webhook payload can be a single object or an array of objects
        const payloads = Array.isArray(req.body) ? req.body : [req.body];
        
        for (const payload of payloads) {
            // Support unified endpoint where a Pix event payload is sent
            if (payload.pix && Array.isArray(payload.pix)) {
                for (const pixItem of payload.pix) {
                    const txid = pixItem.txid;
                    if (!txid) continue;
                    
                    const [txRows] = await pool.query<RowDataPacket[]>(
                        `SELECT t.*, b.company_id, b.id as bank_account_id
                         FROM transactions t
                         JOIN bank_accounts b ON t.bank_account_id = b.id
                         WHERE t.public_id = ? OR t.pix_code = ? LIMIT 1`,
                        [txid, txid]
                    );

                    if (txRows.length > 0) {
                        const tx = txRows[0] as any;
                        if (tx.status !== 'paid') {
                            await FinanceTransactionRepository.withTransaction(async (conn) => {
                                await conn.query(
                                    `UPDATE transactions SET status = 'paid', received_at = NOW(), updated_at = NOW() WHERE id = ?`,
                                    [tx.id]
                                );
                                await conn.query(
                                    `UPDATE bank_accounts SET current_balance = current_balance + ? WHERE id = ?`,
                                    [tx.amount, tx.bank_account_id]
                                );
                            });
                            console.log(`[Webhook Inter Billing-Pix] Transaction ${tx.public_id} marked as paid successfully via Pix.`);
                        }
                    }
                }
                continue;
            }

            const cobranca = payload.cobranca || payload;
            const nossoNumero = cobranca.nossoNumero || cobranca.codigoSolicitacao;
            const seuNumero = cobranca.seuNumero;
            const situacao = cobranca.situacao;

            if (!nossoNumero && !seuNumero) {
                console.warn('[Webhook Inter Billing] Missing billing identifiers in payload:', payload);
                continue;
            }

            // We only process paid status
            if (situacao === 'PAGO' || situacao === 'RECEBIDO') {
                const [txRows] = await pool.query<RowDataPacket[]>(
                    `SELECT t.*, b.company_id, b.id as bank_account_id
                     FROM transactions t
                     JOIN bank_accounts b ON t.bank_account_id = b.id
                     WHERE t.billet_url = ? 
                        OR t.public_id = ? 
                        OR (LENGTH(?) >= 14 AND t.public_id LIKE CONCAT(?, '%')) 
                     LIMIT 1`,
                    [nossoNumero || null, seuNumero || null, seuNumero || null, seuNumero || null]
                );

                if (txRows.length > 0) {
                    const tx = txRows[0] as any;
                    if (tx.status !== 'paid') {
                        await FinanceTransactionRepository.withTransaction(async (conn) => {
                            await conn.query(
                                `UPDATE transactions SET status = 'paid', received_at = NOW(), updated_at = NOW() WHERE id = ?`,
                                [tx.id]
                            );
                            await conn.query(
                                `UPDATE bank_accounts SET current_balance = current_balance + ? WHERE id = ?`,
                                [tx.amount, tx.bank_account_id]
                            );
                        });
                        console.log(`[Webhook Inter Billing] Transaction ${tx.public_id} marked as paid successfully.`);
                    } else {
                        console.log(`[Webhook Inter Billing] Transaction ${tx.public_id} is already paid.`);
                    }
                } else {
                    console.warn(`[Webhook Inter Billing] Transaction not found for nossoNumero: ${nossoNumero}, seuNumero: ${seuNumero}`);
                }
            } else {
                console.log(`[Webhook Inter Billing] Event status is not paid (${situacao}), skipping.`);
            }
        }

        res.status(200).json({ status: 'success' });
    } catch (error) {
        console.error('[Webhook Inter Billing] Error processing webhook:', error);
        next(error);
    }
});

/**
 * @openapi
 * /public/webhooks/inter/pix:
 *   post:
 *     tags: [Public]
 *     summary: Receber notificações de pagamento Pix do Banco Inter
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200: { description: Webhook processado }
 */
router.post('/webhooks/inter/pix', async (req, res, next) => {
    try {
        console.log('[Webhook Inter Pix] Received payload:', JSON.stringify(req.body));
        
        const pixEvents = req.body?.pix ? req.body.pix : (Array.isArray(req.body) ? req.body : []);
        
        for (const pixItem of pixEvents) {
            const txid = pixItem.txid;
            
            if (!txid) {
                console.warn('[Webhook Inter Pix] Missing txid in payload item:', pixItem);
                continue;
            }

            const [txRows] = await pool.query<RowDataPacket[]>(
                `SELECT t.*, b.company_id, b.id as bank_account_id
                 FROM transactions t
                 JOIN bank_accounts b ON t.bank_account_id = b.id
                 WHERE t.public_id = ? OR t.pix_code = ? LIMIT 1`,
                [txid, txid]
            );

            if (txRows.length > 0) {
                const tx = txRows[0] as any;
                if (tx.status !== 'paid') {
                    await FinanceTransactionRepository.withTransaction(async (conn) => {
                        await conn.query(
                            `UPDATE transactions SET status = 'paid', received_at = NOW(), updated_at = NOW() WHERE id = ?`,
                            [tx.id]
                        );
                        await conn.query(
                            `UPDATE bank_accounts SET current_balance = current_balance + ? WHERE id = ?`,
                            [tx.amount, tx.bank_account_id]
                        );
                    });
                    console.log(`[Webhook Inter Pix] Transaction ${tx.public_id} marked as paid successfully.`);
                } else {
                    console.log(`[Webhook Inter Pix] Transaction ${tx.public_id} is already paid.`);
                }
            } else {
                console.warn(`[Webhook Inter Pix] Transaction not found for txid: ${txid}`);
            }
        }

        res.status(200).json({ status: 'success' });
    } catch (error) {
        console.error('[Webhook Inter Pix] Error processing webhook:', error);
        next(error);
    }
});

export default router;
