import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import app from '../app';
import pool from '../config/db';
import { ResultSetHeader } from 'mysql2/promise';
import { StorageService } from '../utils/storageService';

const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_must_be_at_least_32_chars_long!';
const SALT_ROUNDS = 10;

describe('Testes de Uploads Públicos, Webhooks e Proteções (C4, A4, A5)', () => {
    let companyAId: number;
    let companyAPublicId: string;
    let companyBId: number;
    let companyBPublicId: string;

    let userAToken: string;
    let userAPublicId: string;

    let userBToken: string;
    let userBPublicId: string;

    let superAdminToken: string;
    let superAdminPublicId: string;

    const createdCompanyIds: number[] = [];
    const createdUserPublicIds: string[] = [];
    const createdDocIds: number[] = [];
    const createdDocPublicIds: string[] = [];

    const testFilesDir = path.resolve(process.cwd(), 'public', 'uploads', 'documents', 'test_c4');
    const testPdfPath = path.join(testFilesDir, 'sample_doc.pdf');
    const testPfxPath = path.join(testFilesDir, 'cert_test.pfx');

    before(async () => {
        // Set webhook secrets for testing
        process.env.ASAAS_WEBHOOK_ACCESS_TOKEN = 'test_asaas_token_secret_123';
        process.env.INTER_WEBHOOK_SECRET = 'test_inter_token_secret_456';

        // Ensure test directory and files exist
        if (!fs.existsSync(testFilesDir)) {
            fs.mkdirSync(testFilesDir, { recursive: true });
        }
        fs.writeFileSync(testPdfPath, 'PDF dummy content for unit test');
        fs.writeFileSync(testPfxPath, 'PFX dummy certificate content');

        const passwordHash = await bcrypt.hash('Senha123!', SALT_ROUNDS);

        // 1. Criar Empresa A
        companyAPublicId = randomUUID();
        const [compAResult] = await pool.query<ResultSetHeader>(
            `INSERT INTO companies (public_id, trade_name, company_name, is_active, is_system, is_general_admin)
             VALUES (?, 'Empresa Teste A', 'Empresa Teste A LTDA', 1, 0, 0)`,
            [companyAPublicId]
        );
        companyAId = compAResult.insertId;
        createdCompanyIds.push(companyAId);

        // 2. Criar Empresa B (outra empresa para teste cross-tenant)
        companyBPublicId = randomUUID();
        const [compBResult] = await pool.query<ResultSetHeader>(
            `INSERT INTO companies (public_id, trade_name, company_name, is_active, is_system, is_general_admin)
             VALUES (?, 'Empresa Teste B', 'Empresa Teste B LTDA', 1, 0, 0)`,
            [companyBPublicId]
        );
        companyBId = compBResult.insertId;
        createdCompanyIds.push(companyBId);

        // 3. Criar Usuário A (Empresa A)
        userAPublicId = randomUUID();
        userAToken = jwt.sign(
            { id: userAPublicId, role: 'user', company_id: companyAId },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        await pool.query(
            `INSERT INTO users (public_id, company_id, email, password_hash, full_name, role, is_active, current_session_token)
             VALUES (?, ?, ?, ?, 'Usuario A Teste', 'user', 1, ?)`,
            [userAPublicId, companyAId, `userA_${userAPublicId.slice(0, 8)}@test.com`, passwordHash, userAToken]
        );
        createdUserPublicIds.push(userAPublicId);

        // 4. Criar Usuário B (Empresa B)
        userBPublicId = randomUUID();
        userBToken = jwt.sign(
            { id: userBPublicId, role: 'user', company_id: companyBId },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        await pool.query(
            `INSERT INTO users (public_id, company_id, email, password_hash, full_name, role, is_active, current_session_token)
             VALUES (?, ?, ?, ?, 'Usuario B Teste', 'user', 1, ?)`,
            [userBPublicId, companyBId, `userB_${userBPublicId.slice(0, 8)}@test.com`, passwordHash, userBToken]
        );
        createdUserPublicIds.push(userBPublicId);

        // 5. Criar Super Admin
        superAdminPublicId = randomUUID();
        superAdminToken = jwt.sign(
            { id: superAdminPublicId, role: 'super_admin', company_id: companyAId },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        await pool.query(
            `INSERT INTO users (public_id, company_id, email, password_hash, full_name, role, is_active, current_session_token)
             VALUES (?, ?, ?, ?, 'Super Admin Teste', 'super_admin', 1, ?)`,
            [superAdminPublicId, companyAId, `super_${superAdminPublicId.slice(0, 8)}@test.com`, passwordHash, superAdminToken]
        );
        createdUserPublicIds.push(superAdminPublicId);
    });

    after(async () => {
        // Cleanup test files
        try {
            if (fs.existsSync(testPdfPath)) fs.unlinkSync(testPdfPath);
            if (fs.existsSync(testPfxPath)) fs.unlinkSync(testPfxPath);
            if (fs.existsSync(testFilesDir)) fs.rmdirSync(testFilesDir);
        } catch (e) {}

        // Cleanup DB records
        if (createdDocPublicIds.length > 0) {
            await pool.query(`DELETE FROM documents WHERE public_id IN (?)`, [createdDocPublicIds]);
        }
        if (createdDocIds.length > 0) {
            await pool.query(`DELETE FROM documents WHERE id IN (?)`, [createdDocIds]);
        }
        if (createdUserPublicIds.length > 0) {
            await pool.query(`DELETE FROM users WHERE public_id IN (?)`, [createdUserPublicIds]);
        }
        if (createdCompanyIds.length > 0) {
            await pool.query(`DELETE FROM companies WHERE id IN (?)`, [createdCompanyIds]);
        }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 1. UPLOADS (C4)
    // ─────────────────────────────────────────────────────────────────────────
    describe('1. Segurança de Uploads e Documentos (C4)', () => {
        it('deve retornar 404 ao tentar acessar /uploads/documents diretamente via rota estática', async () => {
            const res = await request(app).get('/uploads/documents/test_c4/sample_doc.pdf');
            assert.strictEqual(res.status, 404);
        });

        it('deve rejeitar com 401 GET /api/v1/documents/:id sem autenticação', async () => {
            const res = await request(app).get('/api/v1/documents/some-id');
            assert.strictEqual(res.status, 401);
        });

        it('deve bloquear com 403 o download de arquivos .pfx (certificados digitais nunca baixáveis)', async () => {
            const docPfxPublicId = randomUUID();
            createdDocPublicIds.push(docPfxPublicId);
            const [docRes] = await pool.query<ResultSetHeader>(
                `INSERT INTO documents (public_id, company_id, title, file_path, file_size)
                 VALUES (?, ?, 'Certificado Digital A1', 'documents/test_c4/cert_test.pfx', 1024)`,
                [docPfxPublicId, companyAId]
            );
            createdDocIds.push(docRes.insertId);

            const res = await request(app)
                .get(`/api/v1/documents/${docPfxPublicId}`)
                .set('Authorization', `Bearer ${userAToken}`);

            assert.strictEqual(res.status, 403);
            assert.match(res.body.message, /Certificados .pfx não podem ser baixados/i);
        });

        it('deve bloquear com 403 o acesso cross-tenant a documentos de outra empresa', async () => {
            const docPdfPublicId = randomUUID();
            createdDocPublicIds.push(docPdfPublicId);
            const [docRes] = await pool.query<ResultSetHeader>(
                `INSERT INTO documents (public_id, company_id, title, file_path, file_size)
                 VALUES (?, ?, 'Nota Fiscal Empresa A', 'documents/test_c4/sample_doc.pdf', 2048)`,
                [docPdfPublicId, companyAId]
            );
            createdDocIds.push(docRes.insertId);

            // Usuário B da Empresa B tentando acessar documento da Empresa A
            const res = await request(app)
                .get(`/api/v1/documents/${docPdfPublicId}`)
                .set('Authorization', `Bearer ${userBToken}`);

            assert.strictEqual(res.status, 403);
            assert.match(res.body.message, /Acesso não autorizado/i);
        });

        it('deve permitir com 200 o download de documento pertencente à company_id do usuário', async () => {
            const docPdfPublicId = randomUUID();
            createdDocPublicIds.push(docPdfPublicId);
            const [docRes] = await pool.query<ResultSetHeader>(
                `INSERT INTO documents (public_id, company_id, title, file_path, file_size)
                 VALUES (?, ?, 'Documento Válido Empresa A', 'documents/test_c4/sample_doc.pdf', 2048)`,
                [docPdfPublicId, companyAId]
            );
            createdDocIds.push(docRes.insertId);

            // Usuário A da Empresa A acessando documento da Empresa A
            const res = await request(app)
                .get(`/api/v1/documents/${docPdfPublicId}`)
                .set('Authorization', `Bearer ${userAToken}`);

            assert.strictEqual(res.status, 200);
            const content = res.text || (Buffer.isBuffer(res.body) ? res.body.toString('utf-8') : '');
            assert.strictEqual(content, 'PDF dummy content for unit test');
        });

        it('deve permitir com 200 o acesso de super_admin a documentos de qualquer empresa', async () => {
            const docPdfPublicId = randomUUID();
            createdDocPublicIds.push(docPdfPublicId);
            const [docRes] = await pool.query<ResultSetHeader>(
                `INSERT INTO documents (public_id, company_id, title, file_path, file_size)
                 VALUES (?, ?, 'Documento Empresa A para SuperAdmin', 'documents/test_c4/sample_doc.pdf', 2048)`,
                [docPdfPublicId, companyAId]
            );
            createdDocIds.push(docRes.insertId);

            const res = await request(app)
                .get(`/api/v1/documents/${docPdfPublicId}`)
                .set('Authorization', `Bearer ${superAdminToken}`);

            assert.strictEqual(res.status, 200);
        });

        it('StorageService.delete: deve conter e impedir tentativa de path traversal na exclusão', async () => {
            // Tentativa de exclusão com path traversal fora de public/uploads
            const deleteResult1 = await StorageService.delete('../../../package.json');
            assert.strictEqual(deleteResult1, false);

            const deleteResult2 = await StorageService.delete('/etc/passwd');
            assert.strictEqual(deleteResult2, false);

            // Exclusão legítima dentro do diretório de uploads
            const tempUploadPath = path.resolve(process.cwd(), 'public', 'uploads', 'products', 'test_delete_temp.txt');
            fs.writeFileSync(tempUploadPath, 'temporary file to test delete');
            assert.strictEqual(fs.existsSync(tempUploadPath), true);

            const legitimateDelete = await StorageService.delete('products/test_delete_temp.txt');
            assert.strictEqual(legitimateDelete, true);
            assert.strictEqual(fs.existsSync(tempUploadPath), false);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 2. WEBHOOKS ASAAS E INTER (A4)
    // ─────────────────────────────────────────────────────────────────────────
    describe('2. Autenticação e Validação de Webhooks (A4)', () => {
        it('Asaas Webhook: deve rejeitar com 401 chamadas sem o header asaas-access-token', async () => {
            const res = await request(app)
                .post('/public/webhooks/asaas')
                .send({ event: 'PAYMENT_RECEIVED', payment: { id: 'pay_123' } });

            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.status, 'error');
            assert.match(res.body.message, /asaas-access-token/i);
        });

        it('Asaas Webhook: deve rejeitar com 401 chamadas com asaas-access-token incorreto', async () => {
            const res = await request(app)
                .post('/public/webhooks/asaas')
                .set('asaas-access-token', 'token_invalido_hacker')
                .send({ event: 'PAYMENT_RECEIVED', payment: { id: 'pay_123' } });

            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.status, 'error');
        });

        it('Asaas Webhook: deve aceitar com 200 quando header asaas-access-token for válido', async () => {
            const res = await request(app)
                .post('/public/webhooks/asaas')
                .set('asaas-access-token', 'test_asaas_token_secret_123')
                .send({ event: 'PAYMENT_RECEIVED', payment: { id: 'pay_nonexistent_test' } });

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.status, 'success');
        });

        it('Inter Webhook (billing): deve rejeitar com 401 chamadas sem autenticação / secret válido', async () => {
            const res = await request(app)
                .post('/public/webhooks/inter/billing')
                .send({ nossoNumero: '12345678', codigoStatus: 'PAGO' });

            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.status, 'error');
            assert.match(res.body.message, /Autenticação do webhook Inter inválida/i);
        });

        it('Inter Webhook (pix): deve rejeitar com 401 chamadas sem autenticação / secret válido', async () => {
            const res = await request(app)
                .post('/public/webhooks/inter/pix')
                .send({ pix: [{ txid: 'tx_123', valor: '10.00' }] });

            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.body.status, 'error');
        });

        it('Inter Webhook (billing): deve aceitar token válido no header x-inter-webhook-secret', async () => {
            const res = await request(app)
                .post('/public/webhooks/inter/billing')
                .set('x-inter-webhook-secret', 'test_inter_token_secret_456')
                .send({ nossoNumero: '99999999', codigoStatus: 'EXPIRADO' });

            // Since it's not a payment confirmation and secret is valid, it returns 200
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.status, 'success');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 3. XSS E SANITIZAÇÃO DE DADOS PÚBLICOS (A5)
    // ─────────────────────────────────────────────────────────────────────────
    describe('3. Sanitização e Validação em Rotas Públicas (A5)', () => {
        it('Catálogo Order: deve rejeitar com 400 pedido com customer_name acima do limite permitido', async () => {
            const overlyLongName = 'A'.repeat(260);
            const res = await request(app)
                .post(`/public/catalog/${companyAPublicId}/order`)
                .send({
                    items: [{ product_public_id: randomUUID(), quantity: 1 }],
                    customer_name: overlyLongName,
                    delivery_address: 'Rua Valida, 123'
                });

            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.status, 'error');
        });

        it('Catálogo Order: deve rejeitar com 400 pedido com delivery_address acima de 500 caracteres', async () => {
            const overlyLongAddress = 'B'.repeat(510);
            const res = await request(app)
                .post(`/public/catalog/${companyAPublicId}/order`)
                .send({
                    items: [{ product_public_id: randomUUID(), quantity: 1 }],
                    customer_name: 'Cliente Teste',
                    delivery_address: overlyLongAddress
                });

            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.status, 'error');
        });
    });
});
