import { Router } from 'express';
import { DentalController } from '../controllers/dentalController';
import { protectRoute } from '../middlewares/authMiddleware';
import { requireTenantContext } from '../middlewares/tenantMiddleware';

const router = Router();

router.use(protectRoute, requireTenantContext);

/**
 * @openapi
 * /dental/charts:
 *   get:
 *     tags: [Dental]
 *     summary: Obter ou criar odontograma do paciente
 *     description: Retorna o odontograma existente do paciente ou cria um novo com dentição permanente caso não exista.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: customer_public_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID do paciente (cliente)
 *     responses:
 *       200:
 *         description: Odontograma retornado com sucesso
 *       404:
 *         description: Paciente não encontrado
 *   post:
 *     tags: [Dental]
 *     summary: Obter ou criar odontograma do paciente via POST
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customer_public_id
 *             properties:
 *               customer_public_id:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Odontograma retornado com sucesso
 */
router.get('/charts', (req, res, next) => DentalController.getOrCreateChart(req, res).catch(next));
router.post('/charts', (req, res, next) => DentalController.getOrCreateChart(req, res).catch(next));

/**
 * @openapi
 * /dental/charts/{id}:
 *   get:
 *     tags: [Dental]
 *     summary: Obter odontograma por ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID do odontograma
 *     responses:
 *       200:
 *         description: Odontograma detalhado com dentes e procedimentos
 *       404:
 *         description: Odontograma não encontrado
 *   put:
 *     tags: [Dental]
 *     summary: Atualizar tipo de dentição e observações do odontograma
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               dentition:
 *                 type: string
 *                 enum: [permanent, deciduous, mixed]
 *               notes:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Odontograma atualizado com sucesso
 */
router.get('/charts/:id', (req, res, next) => DentalController.getChart(req, res).catch(next));
router.put('/charts/:id', (req, res, next) => DentalController.updateChart(req, res).catch(next));

/**
 * @openapi
 * /dental/charts/{id}/teeth/{tooth_code}:
 *   put:
 *     tags: [Dental]
 *     summary: Atualizar condição de um dente (código FDI)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: tooth_code
 *         required: true
 *         schema:
 *           type: integer
 *         description: Código FDI do dente (ex. 11 a 48 ou 51 a 85)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - condition
 *             properties:
 *               condition:
 *                 type: string
 *                 enum: [present, absent, extracted, implant, unerupted, retained]
 *               notes:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Condição do dente atualizada com sucesso
 */
router.put('/charts/:id/teeth/:tooth_code', (req, res, next) => DentalController.updateToothCondition(req, res).catch(next));
router.put('/charts/:id/teeth', (req, res, next) => DentalController.updateToothCondition(req, res).catch(next));

/**
 * @openapi
 * /dental/charts/{id}/procedures:
 *   get:
 *     tags: [Dental]
 *     summary: Listar procedimentos do odontograma
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Lista de procedimentos
 *   post:
 *     tags: [Dental]
 *     summary: Adicionar procedimento odontológico ao plano
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tooth_code:
 *                 type: integer
 *                 nullable: true
 *                 description: Código FDI do dente
 *               region:
 *                 type: string
 *                 enum: [tooth, upper_arch, lower_arch, quadrant, mouth]
 *                 default: tooth
 *               faces:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [M, D, O, I, V, L, P]
 *               service_public_id:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *                 description: Obrigatório quando status é planned
 *               unit_price:
 *                 type: number
 *                 minimum: 0
 *               status:
 *                 type: string
 *                 enum: [existing, planned, quoted, approved, done, cancelled]
 *                 default: planned
 *               professional_user_public_id:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *               notes:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Procedimento criado com sucesso
 */
router.get('/charts/:id/procedures', (req, res, next) => DentalController.listProcedures(req, res).catch(next));
router.post('/charts/:id/procedures', (req, res, next) => DentalController.createProcedure(req, res).catch(next));

/**
 * @openapi
 * /dental/procedures/{id}:
 *   put:
 *     tags: [Dental]
 *     summary: Atualizar procedimento odontológico
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tooth_code:
 *                 type: integer
 *                 nullable: true
 *               region:
 *                 type: string
 *                 enum: [tooth, upper_arch, lower_arch, quadrant, mouth]
 *               faces:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [M, D, O, I, V, L, P]
 *               service_public_id:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *               unit_price:
 *                 type: number
 *                 minimum: 0
 *               status:
 *                 type: string
 *                 enum: [existing, planned, quoted, approved, done, cancelled]
 *               professional_user_public_id:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *               notes:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Procedimento atualizado com sucesso
 *   delete:
 *     tags: [Dental]
 *     summary: Remover procedimento odontológico
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Procedimento removido com sucesso
 */
router.put('/procedures/:id', (req, res, next) => DentalController.updateProcedure(req, res).catch(next));
router.delete('/procedures/:id', (req, res, next) => DentalController.deleteProcedure(req, res).catch(next));

/**
 * @openapi
 * /dental/charts/{id}/quote:
 *   post:
 *     tags: [Dental]
 *     summary: Gerar orçamento a partir de procedimentos planejados selecionados
 *     description: |
 *       Cria em uma única transação um orçamento com status 'quote', contendo os itens
 *       dos procedimentos selecionados com descrições automáticas, vincula o pedido e itens
 *       aos procedimentos e atualiza os procedimentos para status 'quoted'.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - procedure_public_ids
 *             properties:
 *               procedure_public_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *               observation:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Orçamento gerado com sucesso
 */
router.post('/charts/:id/quote', (req, res, next) => DentalController.createQuote(req, res).catch(next));

/**
 * @openapi
 * /dental/procedures/{id}/perform:
 *   patch:
 *     tags: [Dental]
 *     summary: Marcar procedimento como realizado (status done)
 *     description: |
 *       Marca o procedimento como realizado. Se o procedimento estiver cotado (quoted),
 *       exige que o orçamento associado já esteja aprovado.
 *       Quando todos os procedimentos de uma mesma venda estiverem concluídos, a venda muda para 'completed'.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               professional_user_public_id:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *               performed_at:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Procedimento realizado com sucesso
 */
router.patch('/procedures/:id/perform', (req, res, next) => DentalController.performProcedure(req, res).catch(next));

export default router;
