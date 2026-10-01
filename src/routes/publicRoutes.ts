import { Router } from 'express';
import { ProductService } from '../services/productService';
import { CompanyService } from '../services/companyService';
import { FinanceService } from '../services/financeService';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *     responses:
 *       200: { description: Webhook processado router.post('/webhooks/inter/billing', async (req, res, next) => {
    try {
        console.log('[Webhook Inter Billing] Received payload:', JSON.stringify(req.body));
        
        const payloads = Array.isArray(req.body) ? req.body : [req.body];
        
        for (const payload of payloads) {
            if (!payload) continue;

            // Support unified endpoint where a Pix event payload is sent
            if (payload.pix && Array.isArray(payload.pix)) {
                for (const pixItem of payload.pix) {
                    const txid = pixItem.txid;
                    if (!txid) continue;
                    
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200: { description: Webhook processado }
 */
router.post('/webhooks/asaas', async (req, res, next) => {
    try {
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
            customer_name: z.string().min(2, 'Nome muito curto'),
            delivery_address: z.string().optional().nullable(),
            payment_method: z.string().optional().nullable(),
            card_brand: z.string().optional().nullable(),
            seller_public_id: z.string().uuid().optional().nullable(),
            customer_public_id: z.string().uuid().optional().nullable(),
            items: z.array(z.object({
                product_public_id: z.string().uuid(),
                quantity: z.number().min(1)
            })).min(1)
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
