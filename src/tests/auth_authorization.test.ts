import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import app from '../app';
import pool from '../config/db';
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_must_be_at_least_32_chars_long!';
const SALT_ROUNDS = 10;

describe('Testes de Autorização e Isolamento Multiempresa (C2, A1, C6)', () => {
    let companyAId: number;
    let companyAPublicId: string;
    let companyBId: number;
    let companyBPublicId: string;

    let superAdminPublicId: string;
    let superAdminToken: string;

    let adminAPublicId: string;
    let adminAToken: string;

    let userAPublicId: string;
    let userAToken: string;

    let adminBPublicId: string;
    let adminBToken: string;

    let userBPublicId: string;
    let userBToken: string;

    const createdUserPublicIds: string[] = [];
    const createdCompanyIds: number[] = [];

    before(async () => {
        // 1. Criar Empresa A
        companyAPublicId = randomUUID();
        const [compAResult] = await pool.query<ResultSetHeader>(
            `INSERT INTO companies (public_id, trade_name, company_name, is_active, is_system, is_general_admin)
             VALUES (?, 'Empresa Teste A', 'Empresa Teste A LTDA', 1, 0, 0)`,
            [companyAPublicId]
        );
        companyAId = compAResult.insertId;
        createdCompanyIds.push(companyAId);

        // 2. Criar Empresa B
        companyBPublicId = randomUUID();
        const [compBResult] = await pool.query<ResultSetHeader>(
            `INSERT INTO companies (public_id, trade_name, company_name, is_active, is_system, is_general_admin)
             VALUES (?, 'Empresa Teste B', 'Empresa Teste B LTDA', 1, 0, 0)`,
            [companyBPublicId]
        );
        companyBId = compBResult.insertId;
        createdCompanyIds.push(companyBId);

        const passwordHash = await bcrypt.hash('SenhaForte123!', SALT_ROUNDS);

        // 3. Criar Super Admin (empresa A ou sistema)
        superAdminPublicId = randomUUID();
        superAdminToken = jwt.sign(
            { id: superAdminPublicId, role: 'super_admin', company_id: companyAId },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        await pool.query(
            `INSERT INTO users (public_id, company_id, email, password_hash, full_name, role, is_active, current_session_token)
             VALUES (?, ?, ?, ?, 'Super Admin Test', 'super_admin', 1, ?)`,
            [superAdminPublicId, companyAId, `super_${superAdminPublicId.slice(0, 8)}@test.com`, passwordHash, superAdminToken]
        );
        createdUserPublicIds.push(superAdminPublicId);

        // 4. Criar Admin Empresa A
        adminAPublicId = randomUUID();
        adminAToken = jwt.sign(
            { id: adminAPublicId, role: 'admin', company_id: companyAId },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        await pool.query(
            `INSERT INTO users (public_id, company_id, email, password_hash, full_name, role, is_active, current_session_token)
             VALUES (?, ?, ?, ?, 'Admin A Test', 'admin', 1, ?)`,
            [adminAPublicId, companyAId, `admin_a_${adminAPublicId.slice(0, 8)}@test.com`, passwordHash, adminAToken]
        );
        createdUserPublicIds.push(adminAPublicId);

        // 5. Criar Usuário Comum Empresa A
        userAPublicId = randomUUID();
        userAToken = jwt.sign(
            { id: userAPublicId, role: 'user', company_id: companyAId },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        await pool.query(
            `INSERT INTO users (public_id, company_id, email, password_hash, full_name, role, is_active, current_session_token)
             VALUES (?, ?, ?, ?, 'User A Test', 'user', 1, ?)`,
            [userAPublicId, companyAId, `user_a_${userAPublicId.slice(0, 8)}@test.com`, passwordHash, userAToken]
        );
        createdUserPublicIds.push(userAPublicId);

        // 6. Criar Admin Empresa B
        adminBPublicId = randomUUID();
        adminBToken = jwt.sign(
            { id: adminBPublicId, role: 'admin', company_id: companyBId },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        await pool.query(
            `INSERT INTO users (public_id, company_id, email, password_hash, full_name, role, is_active, current_session_token)
             VALUES (?, ?, ?, ?, 'Admin B Test', 'admin', 1, ?)`,
            [adminBPublicId, companyBId, `admin_b_${adminBPublicId.slice(0, 8)}@test.com`, passwordHash, adminBToken]
        );
        createdUserPublicIds.push(adminBPublicId);

        // 7. Criar Usuário Comum Empresa B
        userBPublicId = randomUUID();
        userBToken = jwt.sign(
            { id: userBPublicId, role: 'user', company_id: companyBId },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        await pool.query(
            `INSERT INTO users (public_id, company_id, email, password_hash, full_name, role, is_active, current_session_token)
             VALUES (?, ?, ?, ?, 'User B Test', 'user', 1, ?)`,
            [userBPublicId, companyBId, `user_b_${userBPublicId.slice(0, 8)}@test.com`, passwordHash, userBToken]
        );
        createdUserPublicIds.push(userBPublicId);
    });

    after(async () => {
        // Limpeza dos dados criados durante os testes
        if (createdUserPublicIds.length > 0) {
            const placeholders = createdUserPublicIds.map(() => '?').join(',');
            await pool.query(`DELETE FROM users WHERE public_id IN (${placeholders})`, createdUserPublicIds);
        }
        if (createdCompanyIds.length > 0) {
            const placeholders = createdCompanyIds.map(() => '?').join(',');
            await pool.query(`DELETE FROM companies WHERE id IN (${placeholders})`, createdCompanyIds);
        }
    });

    // ──────────────────────────────────────────────────────────────────────────
    // 1. Criação de Empresa: POST /api/v1/companies
    // ──────────────────────────────────────────────────────────────────────────
    describe('1. Proteção na rota POST /api/v1/companies', () => {
        it('deve rejeitar com 401 quando requisição for anônima (sem token)', async () => {
            const res = await request(app)
                .post('/api/v1/companies')
                .send({
                    trade_name: 'Nova Empresa Anonima',
                });

            assert.strictEqual(res.status, 401);
            assert.ok(res.body.error || res.body.message);
        });

        it('deve rejeitar com 403 quando usuário comum tentar criar empresa', async () => {
            const res = await request(app)
                .post('/api/v1/companies')
                .set('Authorization', `Bearer ${userAToken}`)
                .send({
                    trade_name: 'Nova Empresa Usuario Comum',
                });

            assert.strictEqual(res.status, 403);
            assert.ok(res.body.error || res.body.message);
        });

        it('deve rejeitar com 403 quando admin de empresa tentar criar empresa (apenas super_admin pode)', async () => {
            const res = await request(app)
                .post('/api/v1/companies')
                .set('Authorization', `Bearer ${adminAToken}`)
                .send({
                    trade_name: 'Nova Empresa Admin Comum',
                });

            assert.strictEqual(res.status, 403);
            assert.ok(res.body.error || res.body.message);
        });

        it('deve permitir com 201 quando super_admin criar empresa', async () => {
            const uniqueTradeName = `Empresa SuperAdmin ${randomUUID().slice(0, 6)}`;
            const res = await request(app)
                .post('/api/v1/companies')
                .set('Authorization', `Bearer ${superAdminToken}`)
                .send({
                    trade_name: uniqueTradeName,
                    company_name: uniqueTradeName + ' LTDA',
                });

            assert.strictEqual(res.status, 201);
            assert.strictEqual(res.body.status, 'success');
            assert.ok(res.body.data.id);
            createdCompanyIds.push(res.body.data.id);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Proteção e Hierarquia de Papéis: Usuário comum não cria admin
    // ──────────────────────────────────────────────────────────────────────────
    describe('2. Hierarquia de papéis e restrição de criação de admin', () => {
        it('deve rejeitar com 401 quando anônimo tentar acessar /api/v1/auth/register', async () => {
            const res = await request(app)
                .post('/api/v1/auth/register')
                .send({
                    email: `anon_${randomUUID().slice(0, 6)}@test.com`,
                    passwordRaw: 'SenhaForte123!',
                    full_name: 'Anonimo Tentando Registro',
                    role: 'admin',
                });

            assert.strictEqual(res.status, 401);
        });

        it('deve rejeitar com 403 quando usuário comum tentar criar usuário via /api/v1/auth/register', async () => {
            const res = await request(app)
                .post('/api/v1/auth/register')
                .set('Authorization', `Bearer ${userAToken}`)
                .send({
                    email: `user_hack_${randomUUID().slice(0, 6)}@test.com`,
                    passwordRaw: 'SenhaForte123!',
                    full_name: 'Tentando Criar Admin',
                    role: 'admin',
                });

            assert.strictEqual(res.status, 403);
        });

        it('deve rejeitar com 403 quando usuário comum tentar criar usuário via POST /api/v1/users', async () => {
            const res = await request(app)
                .post('/api/v1/users')
                .set('Authorization', `Bearer ${userAToken}`)
                .send({
                    email: `user_hack_users_${randomUUID().slice(0, 6)}@test.com`,
                    passwordRaw: 'SenhaForte123!',
                    full_name: 'Tentando Criar Admin via /users',
                    role: 'admin',
                });

            assert.strictEqual(res.status, 403);
        });

        it('deve rejeitar com 403 quando admin de empresa tentar criar papel superior (super_admin) ou igual (admin)', async () => {
            // Tentando criar super_admin
            const resSuper = await request(app)
                .post('/api/v1/auth/register')
                .set('Authorization', `Bearer ${adminAToken}`)
                .send({
                    email: `fake_super_${randomUUID().slice(0, 6)}@test.com`,
                    passwordRaw: 'SenhaForte123!',
                    full_name: 'Tentando Criar Super Admin',
                    role: 'super_admin',
                });

            assert.strictEqual(resSuper.status, 403);

            // Tentando criar outro admin
            const resAdmin = await request(app)
                .post('/api/v1/auth/register')
                .set('Authorization', `Bearer ${adminAToken}`)
                .send({
                    email: `fake_admin_${randomUUID().slice(0, 6)}@test.com`,
                    passwordRaw: 'SenhaForte123!',
                    full_name: 'Tentando Criar Outro Admin',
                    role: 'admin',
                });

            assert.strictEqual(resAdmin.status, 403);
        });

        it('deve permitir com 201 quando admin criar usuário com papel estritamente inferior (ex: seller ou user)', async () => {
            const email = `novo_vendedor_${randomUUID().slice(0, 6)}@test.com`;
            const res = await request(app)
                .post('/api/v1/auth/register')
                .set('Authorization', `Bearer ${adminAToken}`)
                .send({
                    email,
                    passwordRaw: 'SenhaForte123!',
                    full_name: 'Novo Vendedor Autorizado',
                    role: 'seller',
                });

            assert.strictEqual(res.status, 201);
            assert.strictEqual(res.body.status, 'success');
            if (res.body.data?.user?.public_id) {
                createdUserPublicIds.push(res.body.data.user.public_id);
            }
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Isolamento Multiempresa: Admin da Empresa A não mexe em usuário da Empresa B
    // ──────────────────────────────────────────────────────────────────────────
    describe('3. Isolamento multiempresa entre inquilinos (Tenants)', () => {
        it('deve ignorar company_id enviado no corpo de /auth/register e forçar a company_id do token', async () => {
            const email = `injetando_comp_b_${randomUUID().slice(0, 6)}@test.com`;
            const res = await request(app)
                .post('/api/v1/auth/register')
                .set('Authorization', `Bearer ${adminAToken}`)
                .send({
                    email,
                    passwordRaw: 'SenhaForte123!',
                    full_name: 'Tentativa Injetar Empresa B',
                    company_id: companyBId, // Tentando criar na empresa B
                    role: 'user',
                });

            assert.strictEqual(res.status, 201);
            const createdPublicId = res.body.data.user.public_id;
            createdUserPublicIds.push(createdPublicId);

            // Verificar no banco que o usuário foi criado na empresa A (do token), e NUNCA na empresa B
            const [rows] = await pool.query<RowDataPacket[]>(
                'SELECT company_id FROM users WHERE public_id = ?',
                [createdPublicId]
            );
            assert.strictEqual(rows[0]!.company_id, companyAId);
            assert.notStrictEqual(rows[0]!.company_id, companyBId);
        });

        it('Admin da Empresa A não deve conseguir alterar status (desativar) de usuário da Empresa B (404/403)', async () => {
            const res = await request(app)
                .patch(`/api/v1/users/${userBPublicId}/status`)
                .set('Authorization', `Bearer ${adminAToken}`)
                .send({ is_active: false });

            // Deve retornar 404 (usuário não encontrado no escopo da Empresa A) ou 403
            assert.ok([403, 404].includes(res.status), `Esperado 403 ou 404, recebido: ${res.status}`);

            // Garante que o status no banco permaneceu ativo (1)
            const [rows] = await pool.query<RowDataPacket[]>(
                'SELECT is_active FROM users WHERE public_id = ?',
                [userBPublicId]
            );
            assert.strictEqual(Number(rows[0]!.is_active), 1);
        });

        it('Admin da Empresa A não deve conseguir atualizar dados de usuário da Empresa B (404/403)', async () => {
            const res = await request(app)
                .patch(`/api/v1/users/${userBPublicId}`)
                .set('Authorization', `Bearer ${adminAToken}`)
                .send({ full_name: 'Nome Modificado Ilicitamente' });

            assert.ok([403, 404].includes(res.status), `Esperado 403 ou 404, recebido: ${res.status}`);

            // Garante que o nome no banco permaneceu inalterado
            const [rows] = await pool.query<RowDataPacket[]>(
                'SELECT full_name FROM users WHERE public_id = ?',
                [userBPublicId]
            );
            assert.strictEqual(rows[0]!.full_name, 'User B Test');
        });

        it('Admin da Empresa A não deve conseguir excluir usuário da Empresa B (404/403)', async () => {
            const res = await request(app)
                .delete(`/api/v1/users/${userBPublicId}`)
                .set('Authorization', `Bearer ${adminAToken}`);

            assert.ok([403, 404].includes(res.status), `Esperado 403 ou 404, recebido: ${res.status}`);

            // Garante que o usuário ainda existe no banco
            const [rows] = await pool.query<RowDataPacket[]>(
                'SELECT id FROM users WHERE public_id = ?',
                [userBPublicId]
            );
            assert.strictEqual(rows.length, 1);
        });
    });
});
