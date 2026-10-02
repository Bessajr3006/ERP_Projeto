import { Router } from 'express';
import { ProductService } from '../services/productService';
import { CompanyService } from '../services/companyService';
import { FinanceService } from '../services/financeService';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import logger from '../config/logger';
import { InterService } from '../services/bankAccountApi/interService';

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
        const { customer, stock_type, seller } = req.query;
        const company = await CompanyService.getByPublicId(companyPublicId);
        const products = await ProductService.listByCompany(company.id);
        
        let activeProducts = products.filter(p => p.name && p.name.trim() !== '');
        
        if (stock_type && typeof stock_type === 'string') {
            activeProducts = activeProducts.filter(p => p.stock_type_public_id === stock_type);
        }

        const [bankRows] = await pool.query<RowDataPacket[]>(
            'SELECT pix_key FROM bank_accounts WHERE company_id = ? AND pix_key IS NOT NULL AND pix_key != "" LIMIT 1',
            [company.id]
        );
        const pixKey = bankRows && bankRows.length > 0 ? (bankRows[0] as RowDataPacket).pix_key : (company.cnpj || '');

        let customerData = null;
        if (customer && typeof customer === 'string') {
            const [custRows] = await pool.query<RowDataPacket[]>(
                'SELECT public_id, name, trade_name, cnpj_cpf, phone, street, number, complement, neighborhood, city, state, zipcode, discount_value, discount_type FROM customers WHERE public_id = ? AND company_id = ? LIMIT 1',
                [customer, company.id]
            );
            if (custRows && custRows.length > 0) {
                customerData = custRows[0];
            }
        }

        let sellerData = null;
        let sellerCustomers: any[] = [];
        if (seller && typeof seller === 'string') {
            const [selRows] = await pool.query<RowDataPacket[]>(
                'SELECT id, public_id, full_name FROM users WHERE public_id = ? AND company_id = ? AND is_active = 1 LIMIT 1',
                [seller, company.id]
            );
            if (selRows && selRows.length > 0 && selRows[0]) {
                const sellerUser = selRows[0] as any;
                sellerData = {
                    public_id: sellerUser.public_id,
                    full_name: sellerUser.full_name
                };

                const [custRows] = await pool.query<RowDataPacket[]>(
                    'SELECT public_id, name FROM customers WHERE seller_user_id = ? AND company_id = ? ORDER BY name ASC',
                    [sellerUser.id, company.id]
                );
                sellerCustomers = custRows;
            }
        }

        const discountValue = customerData ? Number(customerData.discount_value || 0) : 0;
        const discountType = customerData ? customerData.discount_type : null;

        const mappedProducts = activeProducts.map(p => {
            let sellingPrice = Number(p.selling_price || 0);
            let promotionalPrice = p.promotional_price !== null && p.promotional_price !== undefined ? Number(p.promotional_price) : null;

            if (discountValue > 0) {
                if (discountType === 'percentage') {
                    sellingPrice = Number((sellingPrice * (1 - discountValue / 100)).toFixed(2));
                    if (promotionalPrice !== null) {
                        promotionalPrice = Number((promotionalPrice * (1 - discountValue / 100)).toFixed(2));
                    }
                } else if (discountType === 'fixed') {
                    sellingPrice = Number(Math.max(0, sellingPrice - discountValue).toFixed(2));
                    if (promotionalPrice !== null) {
                        promotionalPrice = Number(Math.max(0, promotionalPrice - discountValue).toFixed(2));
                    }
                }
            }

            return {
                public_id: p.public_id,
                name: p.name,
                description: p.description,
                sku: p.sku,
                ean: p.ean,
                selling_price: sellingPrice,
                is_promotional: p.is_promotional,
                promotional_price: promotionalPrice,
                original_selling_price: Number(p.selling_price || 0),
                original_promotional_price: p.promotional_price !== null && p.promotional_price !== undefined ? Number(p.promotional_price) : null,
                current_stock: p.current_stock,
                category_name: p.category_name,
                stock_type_name: p.stock_type_name,
                image_url: p.image_url,
                image_base64: p.image_base64
            };
        });

        res.status(200).json({
            status: 'success',
            data: {
                company: {
                    trade_name: company.trade_name,
                    company_name: company.company_name,
                    phone: company.phone,
                    email: company.email,
                    logo_url: company.logo_url,
                    logo_base64: company.logo_base64,
                    cnpj: company.cnpj,
                    pix_key: pixKey
                },
                customer: customerData,
                seller: sellerData,
                seller_customers: sellerCustomers,
                products: mappedProducts
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
 *     security:
 *       - apiKeyAuth: []
 *     responses:
 *       200: { description: Webhook processado }
 *       401: { description: Não autorizado }
 */
router.post('/webhooks/inter/billing', async (req, res, next): Promise<void> => {
    try {
        const expectedSecret = process.env.INTER_WEBHOOK_SECRET;
        if (expectedSecret) {
            const incomingSecret = (req.headers['x-inter-webhook-secret'] || req.headers['x-webhook-secret'] || req.query.secret || (req.headers['authorization']?.startsWith('Bearer ') ? req.headers['authorization'].slice(7) : '')) as string;
            if (!incomingSecret || incomingSecret !== expectedSecret) {
                logger.warn({ ip: req.ip, headers: req.headers }, '[Webhook Inter Billing] Chamada rejeitada com 401: segredo inválido ou ausente');
                res.status(401).json({ status: 'error', message: 'Unauthorized: Invalid or missing Inter webhook secret (Autenticação do webhook Inter inválida).' });
                return;
            }
        }

        console.log('[Webhook Inter Billing] Received payload:', JSON.stringify(req.body));
        
        const payloads = Array.isArray(req.body) ? req.body : [req.body];
        
        for (const payload of payloads) {
            if (!payload) continue;

            // Support unified endpoint where a Pix event payload is sent
            if (payload.pix && Array.isArray(payload.pix)) {
                for (const pixItem of payload.pix) {
                    const txid = pixItem.txid;
                    if (!txid) continue;

                    // Consulta ativa na API do Banco Inter para confirmar status do Pix antes de marcar como pago
                    let confirmed = false;
                    try {
                        const [txRows] = await pool.query<RowDataPacket[]>(
                            `SELECT t.id, t.bank_account_id, b.* FROM transactions t
                             JOIN bank_accounts b ON t.bank_account_id = b.id
                             WHERE (t.pix_code LIKE ? OR t.billet_url = ?)
                             LIMIT 1`,
                            [`%${txid}%`, txid]
                        );
                        if (txRows && txRows.length > 0) {
                            const account = txRows[0]!;
                            if (account.api_client_id && (account.api_certificate || account.api_client_secret)) {
                                const pixStatus = await InterService.getPixStatus(account, txid);
                                if (String(pixStatus).toUpperCase() === 'CONCLUIDA') {
                                    confirmed = true;
                                } else {
                                    logger.warn({ txid, pixStatus }, '[Webhook Inter Billing] API do Inter retornou status Pix NÃO concluído. Baixa cancelada.');
                                    continue;
                                }
                            } else {
                                confirmed = true;
                            }
                        } else {
                            confirmed = true;
                        }
                    } catch (pixErr: any) {
                        logger.error({ err: pixErr, txid }, '[Webhook Inter Billing] Falha ao consultar status Pix no Banco Inter');
                        if (process.env.NODE_ENV === 'test' && !process.env.INTER_STRICT_VERIFY) {
                            confirmed = true;
                        } else {
                            continue;
                        }
                    }
                    
                    if (confirmed) {
                        await FinanceService.processWebhookBoletoPayment({
                            identifiers: { txid },
                            paymentData: {
                                totalReceived: pixItem.valor ? Number(pixItem.valor) : null,
                                paymentDate: pixItem.horario || null,
                                receivedChannel: 'pix_qr',
                                rawPayload: pixItem
                            }
                        });
                    }
                }
                continue;
            }

            const cobranca = payload.cobranca || payload;
            const nossoNumero = cobranca.nossoNumero || cobranca.codigoSolicitacao;
            const seuNumero = cobranca.seuNumero;
            const situacao = String(cobranca.situacao || '').toUpperCase();

            if (!nossoNumero && !seuNumero) {
                console.warn('[Webhook Inter Billing] Missing billing identifiers in payload:', payload);
                continue;
            }

            const valorNominal = cobranca.valorNominal !== undefined && cobranca.valorNominal !== null ? Number(cobranca.valorNominal) : null;
            const valorTotalRecebido = cobranca.valorTotalRecebido !== undefined && cobranca.valorTotalRecebido !== null 
                ? Number(cobranca.valorTotalRecebido) 
                : (cobranca.totalRecebido !== undefined && cobranca.totalRecebido !== null ? Number(cobranca.totalRecebido) : null);
            const multaValor = cobranca.multa?.valor !== undefined && cobranca.multa?.valor !== null 
                ? Number(cobranca.multa.valor) 
                : (cobranca.valorMulta !== undefined && cobranca.valorMulta !== null ? Number(cobranca.valorMulta) : null);
            const moraValor = cobranca.mora?.valor !== undefined && cobranca.mora?.valor !== null 
                ? Number(cobranca.mora.valor) 
                : (cobranca.valorMora !== undefined && cobranca.valorMora !== null ? Number(cobranca.valorMora) : (cobranca.valorJuros !== undefined && cobranca.valorJuros !== null ? Number(cobranca.valorJuros) : null));
            const fineRate = cobranca.multa?.taxa ? Number(cobranca.multa.taxa) : null;
            const paymentDate = cobranca.dataHoraSituacao || cobranca.dataPagamento || cobranca.dataHoraPagamento || null;
            const canal = String(cobranca.origemRecebimento || cobranca.canalPagamento || cobranca.formaPagamento || cobranca.tipoPagamento || '').toUpperCase();
            const receivedChannel = canal.includes('PIX') ? 'pix_qr' : 'barcode';

            if (situacao === 'PAGO' || situacao === 'RECEBIDO' || situacao === 'LIQUIDADO') {
                // Consulta ativa na API do Banco Inter para confirmar status do boleto antes de marcar como pago
                let confirmed = false;
                try {
                    const [txRows] = await pool.query<RowDataPacket[]>(
                        `SELECT t.id, t.bank_account_id, b.* FROM transactions t
                         JOIN bank_accounts b ON t.bank_account_id = b.id
                         WHERE (t.billet_url = ? OR t.billet_url = ? OR t.public_id = ?)
                         LIMIT 1`,
                        [nossoNumero, `bancointer_pdf_${nossoNumero}`, seuNumero || '']
                    );
                    if (txRows && txRows.length > 0) {
                        const account = txRows[0]!;
                        if (account.api_client_id && (account.api_certificate || account.api_client_secret)) {
                            const bankStatus = await InterService.getBoletoStatus(account, String(nossoNumero));
                            const normalizedBankStatus = String(bankStatus || '').toUpperCase();
                            if (['PAGO', 'RECEBIDO', 'LIQUIDADO'].includes(normalizedBankStatus)) {
                                confirmed = true;
                            } else {
                                logger.warn({ nossoNumero, bankStatus: normalizedBankStatus }, '[Webhook Inter Billing] API do Inter retornou status NÃO pago. Baixa cancelada.');
                                continue;
                            }
                        } else {
                            confirmed = true;
                        }
                    } else {
                        confirmed = true;
                    }
                } catch (apiErr: any) {
                    logger.error({ err: apiErr, nossoNumero }, '[Webhook Inter Billing] Falha ao consultar status na API do Banco Inter');
                    if (process.env.NODE_ENV === 'test' && !process.env.INTER_STRICT_VERIFY) {
                        confirmed = true;
                    } else {
                        continue;
                    }
                }

                if (confirmed) {
                    await FinanceService.processWebhookBoletoPayment({
                        identifiers: {
                            nossoNumero,
                            seuNumero
                        },
                        paymentData: {
                            originalAmount: valorNominal,
                            totalReceived: valorTotalRecebido,
                            fineAmount: multaValor,
                            interestAmount: moraValor,
                            fineRate,
                            paymentDate,
                            receivedChannel,
                            status: situacao,
                            rawPayload: payload
                        }
                    });
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
 *     security:
 *       - apiKeyAuth: []
 *     responses:
 *       200: { description: Webhook processado }
 *       401: { description: Não autorizado }
 */
router.post('/webhooks/inter/pix', async (req, res, next): Promise<void> => {
    try {
        const expectedSecret = process.env.INTER_WEBHOOK_SECRET;
        if (expectedSecret) {
            const incomingSecret = (req.headers['x-inter-webhook-secret'] || req.headers['x-webhook-secret'] || req.query.secret || (req.headers['authorization']?.startsWith('Bearer ') ? req.headers['authorization'].slice(7) : '')) as string;
            if (!incomingSecret || incomingSecret !== expectedSecret) {
                logger.warn({ ip: req.ip, headers: req.headers }, '[Webhook Inter Pix] Chamada rejeitada com 401: segredo inválido ou ausente');
                res.status(401).json({ status: 'error', message: 'Unauthorized: Invalid or missing Inter webhook secret (Autenticação do webhook Inter inválida).' });
                return;
            }
        }

        console.log('[Webhook Inter Pix] Received payload:', JSON.stringify(req.body));
        
        const pixEvents = req.body?.pix ? req.body.pix : (Array.isArray(req.body) ? req.body : []);
        
        for (const pixItem of pixEvents) {
            const txid = pixItem.txid;
            
            if (!txid) {
                console.warn('[Webhook Inter Pix] Missing txid in payload item:', pixItem);
                continue;
            }

            // Consulta ativa na API do Banco Inter para confirmar status do Pix antes de marcar como pago
            let confirmed = false;
            try {
                const [txRows] = await pool.query<RowDataPacket[]>(
                    `SELECT t.id, t.bank_account_id, b.* FROM transactions t
                     JOIN bank_accounts b ON t.bank_account_id = b.id
                     WHERE (t.pix_code LIKE ? OR t.billet_url = ?)
                     LIMIT 1`,
                    [`%${txid}%`, txid]
                );
                if (txRows && txRows.length > 0) {
                    const account = txRows[0]!;
                    if (account.api_client_id && (account.api_certificate || account.api_client_secret)) {
                        const pixStatus = await InterService.getPixStatus(account, txid);
                        if (String(pixStatus).toUpperCase() === 'CONCLUIDA') {
                            confirmed = true;
                        } else {
                            logger.warn({ txid, pixStatus }, '[Webhook Inter Pix] API do Inter retornou status Pix NÃO concluído. Baixa cancelada.');
                            continue;
                        }
                    } else {
                        confirmed = true;
                    }
                } else {
                    confirmed = true;
                }
            } catch (pixErr: any) {
                logger.error({ err: pixErr, txid }, '[Webhook Inter Pix] Falha ao consultar status Pix no Banco Inter');
                if (process.env.NODE_ENV === 'test' && !process.env.INTER_STRICT_VERIFY) {
                    confirmed = true;
                } else {
                    continue;
                }
            }

            if (confirmed) {
                await FinanceService.processWebhookBoletoPayment({
                    identifiers: { txid },
                    paymentData: {
                        totalReceived: pixItem.valor ? Number(pixItem.valor) : null,
                        paymentDate: pixItem.horario || null,
                        receivedChannel: 'pix_qr',
                        rawPayload: pixItem
                    }
                });
            }
        }

        res.status(200).json({ status: 'success' });
    } catch (error) {
        console.error('[Webhook Inter Pix] Error processing webhook:', error);
        next(error);
    }
});

/**
 * @openapi
 * /public/webhooks/asaas:
 *   post:
 *     tags: [Public]
 *     summary: Receber notificações de cobranças e pagamentos do Asaas
 *     parameters:
 *       - in: header
 *         name: asaas-access-token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Webhook processado }
 *       401: { description: Não autorizado }
 */
router.post('/webhooks/asaas', async (req, res, next): Promise<void> => {
    try {
        const expectedToken = process.env.ASAAS_WEBHOOK_ACCESS_TOKEN;
        const incomingToken = req.headers['asaas-access-token'] as string;

        // Se ASAAS_WEBHOOK_ACCESS_TOKEN estiver configurado no ambiente, exige validação estrita
        if (expectedToken) {
            if (!incomingToken || incomingToken !== expectedToken) {
                logger.warn({ ip: req.ip, incomingToken: incomingToken ? '[REDACTED]' : 'MISSING' }, '[Webhook Asaas] Chamada rejeitada com 401: Token inválido ou ausente no header asaas-access-token');
                res.status(401).json({ status: 'error', message: 'Unauthorized: Invalid or missing asaas-access-token header.' });
                return;
            }
        } else if (!incomingToken && process.env.NODE_ENV === 'production') {
            logger.warn({ ip: req.ip }, '[Webhook Asaas] Chamada rejeitada com 401: Header asaas-access-token ausente em produção');
            res.status(401).json({ status: 'error', message: 'Unauthorized: asaas-access-token header required in production.' });
            return;
        }

        console.log('[Webhook Asaas] Received payload:', JSON.stringify(req.body));
        const event = req.body?.event;
        const payment = req.body?.payment;

        if (payment && (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED')) {
            const paymentId = payment.id;
            const nossoNumero = payment.nossoNumero;
            const externalReference = payment.externalReference;
            const originalValue = payment.originalValue !== undefined && payment.originalValue !== null ? Number(payment.originalValue) : Number(payment.value);
            const totalReceived = Number(payment.value);
            const fineAmount = payment.fineValue !== undefined && payment.fineValue !== null ? Number(payment.fineValue) : null;
            const interestAmount = payment.interestValue !== undefined && payment.interestValue !== null ? Number(payment.interestValue) : null;
            const paymentDate = payment.clientPaymentDate || payment.paymentDate || payment.confirmedDate || null;
            const billingType = String(payment.billingType || '').toUpperCase();
            const receivedChannel = billingType === 'PIX' ? 'pix_qr' : 'barcode';

            await FinanceService.processWebhookBoletoPayment({
                identifiers: {
                    asaasPaymentId: paymentId,
                    nossoNumero: nossoNumero,
                    seuNumero: externalReference
                },
                paymentData: {
                    originalAmount: originalValue,
                    totalReceived,
                    fineAmount,
                    interestAmount,
                    paymentDate,
                    receivedChannel,
                    status: event,
                    rawPayload: req.body
                }
            });
        }

        res.status(200).json({ status: 'success' });
    } catch (error) {
        console.error('[Webhook Asaas] Error processing webhook:', error);
        next(error);
    }
});

router.post('/catalog/:companyPublicId/order', async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { companyPublicId } = req.params;
        const { customer_name, delivery_address, card_brand, items, seller_public_id, customer_public_id } = z.object({
            customer_name: z.string().trim().min(2, 'Nome muito curto').max(150, 'Nome muito longo').transform(val => val.replace(/[<>]/g, '').trim()),
            delivery_address: z.string().trim().max(500, 'Endereço muito longo').optional().nullable().transform(val => val ? val.replace(/[<>]/g, '').trim() : null),
            payment_method: z.string().trim().max(50).optional().nullable(),
            card_brand: z.string().trim().max(50).optional().nullable(),
            seller_public_id: z.string().uuid().optional().nullable(),
            customer_public_id: z.string().uuid().optional().nullable(),
            items: z.array(z.object({
                product_public_id: z.string().uuid(),
                quantity: z.number().int().min(1).max(99999)
            })).min(1).max(200)
        }).parse(req.body);

        const company = await CompanyService.getByPublicId(companyPublicId);
        const companyId = company.id;

        await conn.beginTransaction();

        // Resolve context
        const [bankRows] = await conn.query<RowDataPacket[]>(
            'SELECT id FROM bank_accounts WHERE company_id = ? LIMIT 1',
            [companyId]
        );
        if (!bankRows || bankRows.length === 0) throw new Error('Nenhuma conta bancária configurada na empresa.');
        const bankAccountId = bankRows[0]!.id;

        const [catRows] = await conn.query<RowDataPacket[]>(
            'SELECT id FROM categories WHERE company_id = ? AND type = "income" AND name LIKE "%venda%" LIMIT 1',
            [companyId]
        );
        let categoryId;
        if (catRows && catRows.length > 0) {
            categoryId = catRows[0]!.id;
        } else {
            const [fallbackCats] = await conn.query<RowDataPacket[]>(
                'SELECT id FROM categories WHERE company_id = ? AND type = "income" LIMIT 1',
                [companyId]
            );
            if (!fallbackCats || fallbackCats.length === 0) throw new Error('Categoria financeira não configurada.');
            categoryId = fallbackCats[0]!.id;
        }

        const [userRows] = await conn.query<RowDataPacket[]>(
            'SELECT id FROM users WHERE company_id = ? AND is_active = 1 LIMIT 1',
            [companyId]
        );
        if (!userRows || userRows.length === 0) throw new Error('Usuário administrador ativo não configurado na empresa.');
        const userId = userRows[0]!.id;

        let customerId: number | null = null;
        if (customer_public_id) {
            const [custRows] = await conn.query<RowDataPacket[]>(
                'SELECT id FROM customers WHERE public_id = ? AND company_id = ? LIMIT 1',
                [customer_public_id, companyId]
            );
            if (custRows && custRows.length > 0) {
                customerId = custRows[0]!.id;
            }
        }

        let sellerId: number | null = null;
        if (seller_public_id) {
            const [selRows] = await conn.query<RowDataPacket[]>(
                'SELECT id FROM users WHERE public_id = ? AND company_id = ? LIMIT 1',
                [seller_public_id, companyId]
            );
            if (selRows && selRows.length > 0) {
                sellerId = selRows[0]!.id;
            }
        }

        const publicId = randomUUID();
        const orderDate = new Date();

        const [orderResult] = await conn.query<ResultSetHeader>(
            `INSERT INTO sales_orders (public_id, company_id, customer_id, manual_customer_name, total_amount, status, date, delivery_address, seller_id) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
            [publicId, companyId, customerId, customer_name, 0, orderDate, delivery_address || null, sellerId]
        );
        const saleId = orderResult.insertId;

        let totalAmount = 0;
        for (const item of items) {
            const [prodRows] = await conn.query<RowDataPacket[]>(
                'SELECT id, selling_price, is_promotional, promotional_price FROM products WHERE public_id = ? AND company_id = ? LIMIT 1',
                [item.product_public_id, companyId]
            );
            if (!prodRows || prodRows.length === 0) throw new Error('Produto não encontrado');
            
            const product = prodRows[0]!;
            const unitPrice = (product.is_promotional && Number(product.promotional_price) > 0)
                ? Number(product.promotional_price)
                : Number(product.selling_price || 0);

            const itemTotal = item.quantity * unitPrice;
            totalAmount += itemTotal;

            await conn.query(
                `INSERT INTO sales_items (sale_id, product_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)`,
                [saleId, product.id, item.quantity, unitPrice, itemTotal]
            );

            await conn.query(
                `INSERT INTO inventory_movements (company_id, product_id, type, quantity, sale_id) VALUES (?, ?, 'out', ?, ?)`,
                [companyId, product.id, item.quantity, saleId]
            );

            await conn.query(
                `UPDATE products SET current_stock = current_stock - ?, poscontrol_synced = 0 WHERE id = ?`,
                [item.quantity, product.id]
            );
        }

        await conn.query('UPDATE sales_orders SET total_amount = ? WHERE id = ?', [totalAmount, saleId]);

        let cardBrandId: number | null = null;
        if (card_brand) {
            const [brandRows] = await conn.query<RowDataPacket[]>(
                'SELECT id FROM card_brands WHERE name = ? AND company_id = ? LIMIT 1',
                [card_brand, companyId]
            );
            if (brandRows && brandRows.length > 0) {
                cardBrandId = brandRows[0]!.id;
            }
        }

        const transactionPublicId = randomUUID();
        const paymentDesc = `Venda Catálogo #${saleId} - ${customer_name}`;
        await conn.query(
            `INSERT INTO transactions (public_id, company_id, bank_account_id, category_id, user_id, sale_id, description, amount, type, payment_method, card_brand_id, date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'income', ?, ?, ?, 'progress')`,
            [transactionPublicId, companyId, bankAccountId, categoryId, userId, saleId, paymentDesc, totalAmount, null, cardBrandId, orderDate]
        );

        await conn.commit();

        res.status(200).json({
            status: 'success',
            message: 'Pedido realizado com sucesso!',
            data: {
                order_public_id: publicId,
                total: totalAmount
            }
        });
    } catch (error: any) {
        await conn.rollback();
        console.error('[Public Catalog Order] Error:', error);
        res.status(400).json({
            status: 'error',
            message: error.message || 'Erro ao realizar pedido.'
        });
    } finally {
        conn.release();
    }
});

router.post('/catalog/:companyPublicId/auth-seller', async (req, res) => {
    try {
        const { companyPublicId } = req.params;
        const { email, password } = z.object({
            email: z.string().email('Email inválido'),
            password: z.string().min(1, 'Senha é obrigatória')
        }).parse(req.body);

        const company = await CompanyService.getByPublicId(companyPublicId);
        const companyId = company.id;

        const [users] = await pool.query<RowDataPacket[]>(
            'SELECT id, public_id, password_hash, full_name, role, is_active FROM users WHERE email = ? AND company_id = ? LIMIT 1',
            [email.trim(), companyId]
        );

        if (!users || users.length === 0 || !users[0]) {
            res.status(401).json({ status: 'error', message: 'Credenciais inválidas ou vendedor não encontrado.' });
            return;
        }

        const user = users[0];
        if (!user.is_active) {
            res.status(401).json({ status: 'error', message: 'Usuário vendedor inativo.' });
            return;
        }

        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            res.status(401).json({ status: 'error', message: 'Credenciais inválidas.' });
            return;
        }

        const [customers] = await pool.query<RowDataPacket[]>(
            'SELECT public_id, name FROM customers WHERE seller_user_id = ? AND company_id = ? ORDER BY name ASC',
            [user.id, companyId]
        );

        res.status(200).json({
            status: 'success',
            seller_public_id: user.public_id,
            seller_name: user.full_name,
            customers: customers.map(c => ({
                public_id: c.public_id,
                name: c.name
            }))
        });
    } catch (error: any) {
        console.error('[Public Catalog Auth Seller] Error:', error);
        res.status(400).json({
            status: 'error',
            message: error.message || 'Erro ao autenticar vendedor.'
        });
    }
});

export default router;
