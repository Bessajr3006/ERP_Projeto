import { Router } from 'express';
import { DentalController } from '../controllers/dentalController';
import { protectRoute } from '../middlewares/authMiddleware';
import { requireTenantContext } from '../middlewares/tenantMiddleware';

const router = Router();

router.use(protectRoute, requireTenantContext);

/**
 * @openapi
 * tags:
 *   - name: Odontograma
 *     description: Odontograma (numeração FDI), condições dentárias, procedimentos e integração com orçamentos.
 */

/**
 * @openapi
 * /dental/charts/customer/{customerId}:
 *   get:
 *     tags: [Odontograma]
 *     summary: Obter odontograma do paciente
 *     description: Retorna o odontograma (com dentes e procedimentos) do paciente (cliente). `data` é `null` se ainda não existir.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         description: public_id do cliente/paciente
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Odontograma do paciente ou null }
 *       404: { description: Paciente não encontrado }
 */
router.get('/charts/customer/:customerId', (req, res, next) => DentalController.getChartByCustomer(req, res).catch(next));

/**
 * @openapi
 * /dental/charts:
 *   post:
 *     tags: [Odontograma]
 *     summary: Criar odontograma do paciente
 *     description: Cria o odontograma do paciente. Idempotente; se já existir, retorna o existente (200).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customer_public_id]
 *             properties:
 *               customer_public_id: { type: string, format: uuid }
 *               dentition: { type: string, enum: [permanent, deciduous, mixed] }
 *               notes: { type: string, nullable: true }
 *     responses:
 *       201: { description: Odontograma criado }
 *       200: { description: Odontograma já existente }
 */
router.post('/charts', (req, res, next) => DentalController.createChart(req, res).catch(next));

/**
 * @openapi
 * /dental/charts/{id}:
 *   get:
 *     tags: [Odontograma]
 *     summary: Obter odontograma
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Odontograma com dentes e procedimentos }
 *       404: { description: Odontograma não encontrado }
 *   patch:
 *     tags: [Odontograma]
 *     summary: Atualizar dentição/observações do odontograma
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               dentition: { type: string, enum: [permanent, deciduous, mixed] }
 *               notes: { type: string, nullable: true }
 *     responses:
 *       200: { description: Odontograma atualizado }
 */
router.get('/charts/:id', (req, res, next) => DentalController.getChart(req, res).catch(next));
router.patch('/charts/:id', (req, res, next) => DentalController.updateChart(req, res).catch(next));

/**
 * @openapi
 * /dental/charts/{id}/teeth:
 *   put:
 *     tags: [Odontograma]
 *     summary: Definir condição de dentes (upsert)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [teeth]
 *             properties:
 *               teeth:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [tooth_code, condition]
 *                   properties:
 *                     tooth_code: { type: integer, example: 16, description: 'FDI 11-18, 21-28, 31-38, 41-48, 51-55, 61-65, 71-75, 81-85' }
 *                     condition: { type: string, enum: [present, absent, extracted, implant, unerupted, retained] }
 *                     notes: { type: string, nullable: true }
 *     responses:
 *       200: { description: Lista atualizada de dentes }
 */
router.put('/charts/:id/teeth', (req, res, next) => DentalController.upsertTeeth(req, res).catch(next));

/**
 * @openapi
 * /dental/charts/{id}/procedures:
 *   get:
 *     tags: [Odontograma]
 *     summary: Listar procedimentos do odontograma
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Lista de procedimentos }
 *   post:
 *     tags: [Odontograma]
 *     summary: Adicionar procedimento
 *     description: Se `unit_price` não for informado, usa o preço do serviço.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tooth_code: { type: integer, nullable: true, example: 16 }
 *               region: { type: string, enum: [tooth, upper_arch, lower_arch, quadrant, mouth], default: tooth }
 *               faces: { type: array, items: { type: string, enum: [M, D, O, I, V, L, P] } }
 *               service_public_id: { type: string, format: uuid }
 *               unit_price: { type: number }
 *               status: { type: string, enum: [existing, planned, cancelled], default: planned }
 *               professional_user_id: { type: string, format: uuid, description: public_id do usuário profissional }
 *               planned_at: { type: string, format: date }
 *               notes: { type: string }
 *     responses:
 *       201: { description: Procedimento criado }
 */
router.get('/charts/:id/procedures', (req, res, next) => DentalController.listProcedures(req, res).catch(next));
router.post('/charts/:id/procedures', (req, res, next) => DentalController.createProcedure(req, res).catch(next));

/**
 * @openapi
 * /dental/charts/{id}/quote:
 *   post:
 *     tags: [Odontograma]
 *     summary: Gerar orçamento a partir de procedimentos planejados
 *     description: |
 *       Cria, em uma única transação, um orçamento (sales_orders status `quote`) com um item por procedimento
 *       selecionado (descrição tipo "Dente 16 – faces M/O"), vincula `sales_order_id`/`sales_item_id`
 *       e altera o status dos procedimentos para `quoted`.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [procedure_public_ids]
 *             properties:
 *               procedure_public_ids: { type: array, items: { type: string, format: uuid } }
 *               seller_public_id: { type: string, format: uuid, nullable: true }
 *               validity_date: { type: string, format: date, nullable: true }
 *               observation: { type: string, nullable: true }
 *               payment_terms: { type: string, nullable: true }
 *     responses:
 *       201: { description: Orçamento criado }
 *       409: { description: Procedimento não está planejado }
 */
router.post('/charts/:id/quote', (req, res, next) => DentalController.generateQuote(req, res).catch(next));

/**
 * @openapi
 * /dental/procedures/{id}:
 *   put:
 *     tags: [Odontograma]
 *     summary: Atualizar procedimento
 *     description: Procedimentos orçados/aprovados/realizados só permitem alterar observações, profissional e data planejada.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Procedimento atualizado }
 *       409: { description: Procedimento vinculado a orçamento }
 *   delete:
 *     tags: [Odontograma]
 *     summary: Excluir procedimento (exclusão lógica)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: Procedimento excluído }
 *       409: { description: Procedimento vinculado a orçamento }
 */
router.put('/procedures/:id', (req, res, next) => DentalController.updateProcedure(req, res).catch(next));
router.delete('/procedures/:id', (req, res, next) => DentalController.deleteProcedure(req, res).catch(next));

/**
 * @openapi
 * /dental/procedures/{id}/perform:
 *   patch:
 *     tags: [Odontograma]
 *     summary: Marcar procedimento como realizado
 *     description: |
 *       Altera o status para `done`. Quando todos os procedimentos do pedido vinculado estiverem realizados
 *       (ou cancelados), o pedido passa para `completed`.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               professional_user_id: { type: string, format: uuid, description: public_id do usuário profissional }
 *               performed_at: { type: string, format: date-time }
 *               notes: { type: string }
 *     responses:
 *       200: { description: Procedimento realizado }
 *       409: { description: Status não permite realização }
 */
router.patch('/procedures/:id/perform', (req, res, next) => DentalController.performProcedure(req, res).catch(next));

export default router;
