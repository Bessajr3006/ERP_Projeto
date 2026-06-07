import { Router } from 'express';
import { OrderController } from '../controllers/orderController';
import { protectRoute } from '../middlewares/authMiddleware';
import { requireTenantContext } from '../middlewares/tenantMiddleware';

const router = Router();

router.use(protectRoute, requireTenantContext);

/**
 * @openapi
 * /orders/purchases:
 *   post:
 *     tags: [Orders]
 *     summary: Criar compra
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201: { description: Compra criada }
 */
router.post('/purchases', (req, res, next) => OrderController.createPurchase(req, res).catch(next));
/**
 * @openapi
 * /orders/sales:
 *   post:
 *     tags: [Orders]
 *     summary: Criar pedido de venda
 *     description: |
 *       Cria um novo pedido de venda com itens, pagamentos e endereço de entrega.
 *       O campo `bank_account_public_id` deve corresponder a uma conta bancária ativa da empresa.
 *       O campo `category_public_id` é a categoria financeira associada ao lançamento.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bank_account_public_id
 *               - category_public_id
 *               - date
 *               - items
 *             properties:
 *               customer_public_id:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *                 description: UUID do cliente (opcional para venda sem cliente)
 *                 example: "550e8400-e29b-41d4-a716-446655440001"
 *               delivery_address:
 *                 type: string
 *                 nullable: true
 *                 description: Endereço de entrega (opcional)
 *                 example: "Rua das Flores, 123 - São Paulo/SP"
 *               bank_account_public_id:
 *                 type: string
 *                 format: uuid
 *                 description: UUID da conta bancária para recebimento
 *                 example: "550e8400-e29b-41d4-a716-446655440002"
 *               category_public_id:
 *                 type: string
 *                 format: uuid
 *                 description: UUID da categoria financeira
 *                 example: "550e8400-e29b-41d4-a716-446655440003"
 *               date:
 *                 type: string
 *                 format: date
 *                 description: Data do pedido (ISO 8601)
 *                 example: "2026-06-02"
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 description: Lista de itens do pedido
 *                 items:
 *                   type: object
 *                   required:
 *                     - product_public_id
 *                     - quantity
 *                     - unit_price
 *                   properties:
 *                     product_public_id:
 *                       type: string
 *                       format: uuid
 *                       description: UUID do produto
 *                       example: "550e8400-e29b-41d4-a716-446655440010"
 *                     quantity:
 *                       type: number
 *                       minimum: 0.001
 *                       description: Quantidade do produto
 *                       example: 2
 *                     unit_price:
 *                       type: number
 *                       minimum: 0
 *                       description: Preço unitário do produto
 *                       example: 49.90
 *               payments:
 *                 type: array
 *                 description: Formas de pagamento (opcional)
 *                 items:
 *                   type: object
 *                   required:
 *                     - method
 *                     - amount
 *                   properties:
 *                     method:
 *                       type: string
 *                       enum: [pix, credit, debit, cash, transfer, boleto]
 *                       description: Método de pagamento
 *                       example: "pix"
 *                     amount:
 *                       type: number
 *                       minimum: 0.01
 *                       description: Valor do pagamento
 *                       example: 99.80
 *           example:
 *             customer_public_id: "550e8400-e29b-41d4-a716-446655440001"
 *             delivery_address: "Rua das Flores, 123 - São Paulo/SP"
 *             bank_account_public_id: "550e8400-e29b-41d4-a716-446655440002"
 *             category_public_id: "550e8400-e29b-41d4-a716-446655440003"
 *             date: "2026-06-02"
 *             items:
 *               - product_public_id: "550e8400-e29b-41d4-a716-446655440010"
 *                 quantity: 2
 *                 unit_price: 49.90
 *             payments:
 *               - method: "pix"
 *                 amount: 99.80
 *     responses:
 *       201:
 *         description: Pedido criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   description: Dados do pedido criado
 *       400:
 *         description: Dados inválidos ou produto não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       401:
 *         description: Não autenticado
 *   get:
 *     tags: [Orders]
 *     summary: Listar pedidos de venda
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de vendas
 *       401:
 *         description: Não autenticado
 */
router.post('/sales', (req, res, next) => OrderController.createSale(req, res).catch(next));
router.post('/sales/import-xml', (req, res, next) => OrderController.importSaleFromXml(req, res).catch(next));
router.get('/sales', (req, res, next) => OrderController.listSales(req, res).catch(next));
router.patch('/:id/active', (req, res, next) => OrderController.setSaleActive(req, res).catch(next));
router.patch('/:saleId/items/:itemId/active', (req, res, next) => OrderController.setSaleItemActive(req, res).catch(next));
router.delete('/:id/permanent', (req, res, next) => OrderController.hardDeleteInactiveSale(req, res).catch(next));
router.delete('/:id', (req, res, next) => OrderController.softDeleteSale(req, res).catch(next));
router.delete('/:saleId/items/:itemId', (req, res, next) => OrderController.softDeleteSaleItem(req, res).catch(next));
/**
 * @openapi
 * /orders/{id}/status:
 *   patch:
 *     tags: [Orders]
 *     summary: Atualizar status da venda
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Status atualizado }
 */
router.patch('/:id/status', (req, res, next) => OrderController.updateSaleStatus(req, res).catch(next));
/**
 * @openapi
 * /orders/customers/{customerPublicId}/sales:
 *   get:
 *     tags: [Orders]
 *     summary: Listar vendas por cliente
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: customerPublicId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Lista de vendas do cliente }
 */
router.get('/customers/:customerPublicId/sales', (req, res, next) => OrderController.listSalesByCustomer(req, res).catch(next));
/**
 * @openapi
 * /orders/suppliers/{supplierPublicId}/purchases:
 *   get:
 *     tags: [Orders]
 *     summary: Listar compras por fornecedor
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: supplierPublicId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Lista de compras do fornecedor }
 */
router.get('/suppliers/:supplierPublicId/purchases', (req, res, next) => OrderController.listPurchasesBySupplier(req, res).catch(next));

export default router;
