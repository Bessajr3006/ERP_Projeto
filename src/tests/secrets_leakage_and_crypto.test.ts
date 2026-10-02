import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import app from '../app';
import pool from '../config/db';
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { decrypt } from '../utils/crypto';
import { hashSwaggerToken } from '../utils/swaggerToken';
import { CompanyService } from '../services/companyService';
import { PosControlConfigService } from '../services/posControlConfigService';
import { SolidconConfigService } from '../services/solidconConfigService';
import { DorsalConfigService } from '../services/dorsalConfigService';
import { AlterdataConfigService } from '../services/alterdataConfigService';
import { runMigration246CompanyDorsalConfigs } from '../scripts/run_migration_246_company_dorsal_configs';
import { runMigration249CompanyAlterdataConfigs } from '../scripts/run_migration_249_company_alterdata_configs';
import { runMigration254EncryptCredentialsAndDropRawPassword } from '../scripts/run_migration_254_encrypt_credentials_and_drop_raw_password';

const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_must_be_at_least_32_chars_long!';
const SALT_ROUNDS = 10;

describe('Testes de Vazamento de Segredos e Criptografia AES-256-GCM (A2, A3, M1)', () => {
    let companyId: number;
    let companyPublicId: string;

    let superAdminPublicId: string;
    let superAdminToken: string;

    let adminPublicId: string;
    let adminToken: string;

    let userPublicId: string;
    let userToken: string;

    const createdCompanyIds: number[] = [];
    const createdUserPublicIds: string[] = [];

    before(async () => {
        // Run migrations to ensure clean test environment
        await runMigration246CompanyDorsalConfigs();
        await runMigration249CompanyAlterdataConfigs();
        await runMigration254EncryptCredentialsAndDropRawPassword();

        // 1. Criar Empresa de Teste
        companyPublicId = randomUUID();
        const [compResult] = await pool.query<ResultSetHeader>(
            `INSERT INTO companies (public_id, trade_name, company_name, is_active, is_system, is_general_admin)
             VALUES (?, 'Empresa Segura Teste', 'Empresa Segura Teste LTDA', 1, 0, 0)`,
            [companyPublicId]
        );
        companyId = compResult.insertId;
        createdCompanyIds.push(companyId);

        const passwordHash = await bcrypt.hash('SenhaForte123!', SALT_ROUNDS);

        // 2. Criar Super Admin
        superAdminPublicId = randomUUID();
        superAdminToken = jwt.sign(
            { id: superAdminPublicId, role: 'super_admin', company_id: companyId },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        await pool.query(
            `INSERT INTO users (public_id, company_id, email, password_hash, full_name, role, is_active, current_session_token)
             VALUES (?, ?, ?, ?, 'Super Admin SecTest', 'super_admin', 1, ?)`,
            [superAdminPublicId, companyId, `super_${superAdminPublicId.slice(0, 8)}@sectest.com`, passwordHash, superAdminToken]
        );
        createdUserPublicIds.push(superAdminPublicId);

        // 3. Criar Admin da Empresa
        adminPublicId = randomUUID();
        adminToken = jwt.sign(
            { id: adminPublicId, role: 'admin', company_id: companyId },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        await pool.query(
            `INSERT INTO users (public_id, company_id, email, password_hash, full_name, role, is_active, current_session_token)
             VALUES (?, ?, ?, ?, 'Admin SecTest', 'admin', 1, ?)`,
            [adminPublicId, companyId, `admin_${adminPublicId.slice(0, 8)}@sectest.com`, passwordHash, adminToken]
        );
        createdUserPublicIds.push(adminPublicId);

        // 4. Criar Usuário Comum
        userPublicId = randomUUID();
        userToken = jwt.sign(
            { id: userPublicId, role: 'user', company_id: companyId },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        await pool.query(
            `INSERT INTO users (public_id, company_id, email, password_hash, full_name, role, is_active, current_session_token)
             VALUES (?, ?, ?, ?, 'User SecTest', 'user', 1, ?)`,
            [userPublicId, companyId, `user_${userPublicId.slice(0, 8)}@sectest.com`, passwordHash, userToken]
        );
        createdUserPublicIds.push(userPublicId);
    });

    after(async () => {
        if (createdUserPublicIds.length > 0) {
            const placeholders = createdUserPublicIds.map(() => '?').join(',');
            await pool.query(`DELETE FROM users WHERE public_id IN (${placeholders})`, createdUserPublicIds);
        }
        if (createdCompanyIds.length > 0) {
            const placeholders = createdCompanyIds.map(() => '?').join(',');
            await pool.query(`DELETE FROM company_poscontrol_configs WHERE company_id IN (${placeholders})`, createdCompanyIds);
            await pool.query(`DELETE FROM company_solidcon_configs WHERE company_id IN (${placeholders})`, createdCompanyIds);
            await pool.query(`DELETE FROM company_dorsal_configs WHERE company_id IN (${placeholders})`, createdCompanyIds);
            await pool.query(`DELETE FROM company_alterdata_configs WHERE company_id IN (${placeholders})`, createdCompanyIds);
            await pool.query(`DELETE FROM companies WHERE id IN (${placeholders})`, createdCompanyIds);
        }
    });

    describe('1. Remoção da coluna users.raw_password e ausência no Banco de Dados', () => {
        it('A coluna raw_password não deve existir na tabela users', async () => {
            const [columns] = await pool.query<RowDataPacket[]>(
                `SELECT COLUMN_NAME 
                 FROM INFORMATION_SCHEMA.COLUMNS 
                 WHERE TABLE_SCHEMA = DATABASE() 
                   AND TABLE_NAME = 'users' 
                   AND COLUMN_NAME = 'raw_password'`
            );
            assert.strictEqual(columns.length, 0, 'A coluna raw_password ainda existe na tabela users!');
        });
    });

    describe('2. Sanitização e Não Vazamento de Dados Sensíveis pela API (A2, A3)', () => {
        const forbiddenUserFields = [
            'password',
            'password_hash',
            'passwordHash',
            'raw_password',
            'passwordRaw',
            'current_session_token',
            'currentSessionToken',
            'face_descriptor',
            'faceDescriptor'
        ];

        const forbiddenCompanyFields = [
            'swagger_api_token',
            'certificate_password',
            'senha_solidcon',
            'senha_dorsal',
            'senha_alterdata',
            'inter_client_id',
            'inter_client_secret',
            'csc_token'
        ];

        it('GET /auth/me não deve vazar credenciais ou dados biométricos do usuário e empresa', async () => {
            const res = await request(app)
                .get('/api/v1/auth/me')
                .set('Authorization', `Bearer ${adminToken}`);

            assert.strictEqual(res.status, 200);
            const user = res.body.data.user;
            const company = res.body.data.company;

            for (const field of forbiddenUserFields) {
                assert.strictEqual(user[field], undefined, `Campo proibido '${field}' retornado no usuário em /auth/me!`);
            }

            if (company) {
                for (const field of forbiddenCompanyFields) {
                    assert.strictEqual(company[field], undefined, `Campo sensível '${field}' retornado na empresa em /auth/me!`);
                }
            }
        });

        it('GET /users não deve vazar credenciais ou dados biométricos na listagem de usuários', async () => {
            const res = await request(app)
                .get('/api/v1/users')
                .set('Authorization', `Bearer ${adminToken}`);

            assert.strictEqual(res.status, 200);
            const users = Array.isArray(res.body.data) ? res.body.data : res.body.data?.users;
            assert.ok(Array.isArray(users), 'Deveria retornar uma lista de usuários');

            for (const user of users) {
                for (const field of forbiddenUserFields) {
                    assert.strictEqual(user[field], undefined, `Campo proibido '${field}' retornado em GET /users!`);
                }
            }
        });

        it('GET /users/:id não deve vazar credenciais ou dados biométricos no detalhe do usuário', async () => {
            const res = await request(app)
                .get(`/api/v1/users/${userPublicId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            assert.strictEqual(res.status, 200);
            const user = res.body.data;

            for (const field of forbiddenUserFields) {
                assert.strictEqual(user[field], undefined, `Campo proibido '${field}' retornado em GET /users/:id!`);
            }
        });

        it('GET /companies/:id não deve vazar credenciais de integrações ou senhas de certificados', async () => {
            // Populate some sensitive company fields
            await CompanyService.update(companyPublicId, {
                certificate_password: 'CertSecretPassword123!',
                senha_solidcon: 'SolidconPass123!',
                senha_dorsal: 'DorsalPass123!',
                senha_alterdata: 'AlterdataPass123!'
            });

            const res = await request(app)
                .get(`/api/v1/companies/${companyPublicId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            assert.strictEqual(res.status, 200);
            const company = res.body.data;

            for (const field of forbiddenCompanyFields) {
                assert.strictEqual(company[field], undefined, `Campo sensível '${field}' retornado em GET /companies/:id!`);
            }
        });

        it('GET /companies/:id/poscontrol-configs não deve vazar senhas ou tokens POSControl', async () => {
            await PosControlConfigService.create(companyId, {
                poscontrol_username: 'pos_user',
                poscontrol_password: 'PosSecretPassword123!',
                subscription_key: 'pos_sub_key_123',
                ocp_apim_subscription_key: 'pos_ocp_key_123'
            });

            const res = await request(app)
                .get(`/api/v1/companies/${companyPublicId}/poscontrol-configs`)
                .set('Authorization', `Bearer ${adminToken}`);

            assert.strictEqual(res.status, 200);
            const configs = res.body.data;
            assert.ok(Array.isArray(configs));

            for (const cfg of configs) {
                assert.strictEqual(cfg.poscontrol_password, undefined, 'poscontrol_password vazou pela API!');
                assert.strictEqual(cfg.subscription_key, undefined, 'subscription_key vazou pela API!');
                assert.strictEqual(cfg.ocp_apim_subscription_key, undefined, 'ocp_apim_subscription_key vazou pela API!');
            }
        });

        it('GET /companies/:id/solidcon-configs não deve vazar senhas de banco ou tokens', async () => {
            await SolidconConfigService.create(companyId, {
                name: 'Solidcon Config 1',
                serv_solidcon: 'localhost',
                bd_solidcon: 'solid_db',
                login_solidcon: 'solid_usr',
                senha_solidcon: 'SolidconSecretPassword123!'
            });

            const res = await request(app)
                .get(`/api/v1/companies/${companyPublicId}/solidcon-configs`)
                .set('Authorization', `Bearer ${adminToken}`);

            assert.strictEqual(res.status, 200);
            const configs = res.body.data;
            assert.ok(Array.isArray(configs));

            for (const cfg of configs) {
                assert.strictEqual(cfg.senha_solidcon, undefined, 'senha_solidcon vazou pela API Solidcon!');
            }
        });

        it('GET /companies/:id/dorsal-configs não deve vazar senhas de banco ou tokens', async () => {
            await DorsalConfigService.create(companyId, {
                name: 'Dorsal Config 1',
                serv_dorsal: 'localhost',
                bd_dorsal: 'dorsal_db',
                login_dorsal: 'dorsal_usr',
                senha_dorsal: 'DorsalSecretPassword123!'
            });

            const res = await request(app)
                .get(`/api/v1/companies/${companyPublicId}/dorsal-configs`)
                .set('Authorization', `Bearer ${adminToken}`);

            assert.strictEqual(res.status, 200);
            const configs = res.body.data;
            assert.ok(Array.isArray(configs));

            for (const cfg of configs) {
                assert.strictEqual(cfg.senha_dorsal, undefined, 'senha_dorsal vazou pela API Dorsal!');
            }
        });

        it('GET /companies/:id/alterdata-configs não deve vazar senhas de banco ou tokens', async () => {
            await AlterdataConfigService.create(companyId, {
                name: 'Alterdata Config 1',
                serv_alterdata: 'localhost',
                bd_alterdata: 'alterdata_db',
                login_alterdata: 'alter_usr',
                senha_alterdata: 'AlterdataSecretPassword123!'
            });

            const res = await request(app)
                .get(`/api/v1/companies/${companyPublicId}/alterdata-configs`)
                .set('Authorization', `Bearer ${adminToken}`);

            assert.strictEqual(res.status, 200);
            const configs = res.body.data;
            assert.ok(Array.isArray(configs));

            for (const cfg of configs) {
                assert.strictEqual(cfg.senha_alterdata, undefined, 'senha_alterdata vazou pela API Alterdata!');
            }
        });
    });

    describe('3. Criptografia AES-256-GCM em Repouso no Banco de Dados (A3)', () => {
        const encryptedPattern = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/;

        it('Deve criptografar com AES-256-GCM as senhas de certificados e bancos ao atualizar a empresa', async () => {
            const rawCertPass = 'MinhaSenhaCertSecreta!123';
            const rawSolidPass = 'SolidconPassSecreta!456';
            const rawDorsalPass = 'DorsalPassSecreta!789';
            const rawAlterdataPass = 'AlterdataPassSecreta!012';

            await CompanyService.update(companyPublicId, {
                certificate_password: rawCertPass,
                senha_solidcon: rawSolidPass,
                senha_dorsal: rawDorsalPass,
                senha_alterdata: rawAlterdataPass
            });

            const [rows] = await pool.query<RowDataPacket[]>(
                'SELECT certificate_password, senha_solidcon, senha_dorsal, senha_alterdata FROM companies WHERE id = ?',
                [companyId]
            );

            const row = rows[0]!;

            // 1. Verificar que não está em texto puro
            assert.notStrictEqual(row.certificate_password, rawCertPass);
            assert.notStrictEqual(row.senha_solidcon, rawSolidPass);
            assert.notStrictEqual(row.senha_dorsal, rawDorsalPass);
            assert.notStrictEqual(row.senha_alterdata, rawAlterdataPass);

            // 2. Verificar formato AES-256-GCM (iv:authTag:ciphertext)
            assert.match(row.certificate_password, encryptedPattern, 'certificate_password não está no formato AES-256-GCM');
            assert.match(row.senha_solidcon, encryptedPattern, 'senha_solidcon não está no formato AES-256-GCM');
            assert.match(row.senha_dorsal, encryptedPattern, 'senha_dorsal não está no formato AES-256-GCM');
            assert.match(row.senha_alterdata, encryptedPattern, 'senha_alterdata não está no formato AES-256-GCM');

            // 3. Verificar que descriptografa corretamente com a chave da aplicação
            assert.strictEqual(decrypt(row.certificate_password), rawCertPass);
            assert.strictEqual(decrypt(row.senha_solidcon), rawSolidPass);
            assert.strictEqual(decrypt(row.senha_dorsal), rawDorsalPass);
            assert.strictEqual(decrypt(row.senha_alterdata), rawAlterdataPass);
        });

        it('Deve criptografar credenciais nas tabelas de configurações específicas (POSControl, Solidcon, etc.)', async () => {
            const rawPosPass = 'PosSecretRawPass!999';
            const rawPosSubKey = 'PosSubKeyRawSecret!888';

            const created = await PosControlConfigService.create(companyId, {
                poscontrol_username: 'pos_crypto_user',
                poscontrol_password: rawPosPass,
                subscription_key: rawPosSubKey,
                ocp_apim_subscription_key: rawPosSubKey
            });

            const [rows] = await pool.query<RowDataPacket[]>(
                'SELECT poscontrol_password, subscription_key FROM company_poscontrol_configs WHERE id = ?',
                [created.id]
            );

            const row = rows[0]!;
            assert.notStrictEqual(row.poscontrol_password, rawPosPass);
            assert.notStrictEqual(row.subscription_key, rawPosSubKey);
            assert.match(row.poscontrol_password, encryptedPattern);
            assert.match(row.subscription_key, encryptedPattern);

            // O serviço interno descriptografa para uso do backend
            const fromService = await PosControlConfigService.getById(companyId, created.id);
            assert.strictEqual(fromService?.poscontrol_password, rawPosPass);
            assert.strictEqual(fromService?.subscription_key, rawPosSubKey);
        });
    });

    describe('4. Tokens Swagger com Armazenamento em Hash SHA-256 e Gerenciamento Super Admin (M1)', () => {
        let generatedRawToken: string;

        it('Super admin deve conseguir regenerar token Swagger, recebendo o token puro apenas uma vez', async () => {
            const res = await request(app)
                .post(`/api/v1/companies/${companyPublicId}/swagger-token/regenerate`)
                .set('Authorization', `Bearer ${superAdminToken}`);

            assert.strictEqual(res.status, 200);
            assert.ok(res.body.data?.token, 'Deveria retornar o token no payload');
            generatedRawToken = res.body.data.token;
            assert.ok(generatedRawToken.startsWith('swg_'), 'Token Swagger deve iniciar com swg_');

            // Verificar no banco que APENAS o hash SHA-256 está salvo
            const [rows] = await pool.query<RowDataPacket[]>(
                'SELECT swagger_api_token FROM companies WHERE id = ?',
                [companyId]
            );

            const storedHash = rows[0]?.swagger_api_token;
            assert.notStrictEqual(storedHash, generatedRawToken, 'O token em texto puro NUNCA deve ser salvo no banco!');
            assert.strictEqual(storedHash, hashSwaggerToken(generatedRawToken), 'O valor salvo no banco deve ser o hash SHA-256');
            assert.strictEqual(storedHash.length, 64, 'Hash SHA-256 deve conter 64 caracteres hexadecimais');
        });

        it('Requisição autenticada com o token Swagger puro deve funcionar perfeitamente via hash lookup', async () => {
            assert.ok(generatedRawToken, 'Token precisa ter sido gerado no teste anterior');

            const res = await request(app)
                .get('/api/v1/companies/states')
                .set('Authorization', `Bearer ${generatedRawToken}`);

            assert.strictEqual(res.status, 200, `Falha na autenticação via Swagger token: ${JSON.stringify(res.body)}`);
            assert.ok(Array.isArray(res.body.data) || Array.isArray(res.body));
        });

        it('Super admin deve conseguir revogar o token Swagger', async () => {
            const res = await request(app)
                .post(`/api/v1/companies/${companyPublicId}/swagger-token/revoke`)
                .set('Authorization', `Bearer ${superAdminToken}`);

            assert.strictEqual(res.status, 200);

            // Verificar no banco que swagger_api_token agora é null
            const [rows] = await pool.query<RowDataPacket[]>(
                'SELECT swagger_api_token FROM companies WHERE id = ?',
                [companyId]
            );
            assert.strictEqual(rows[0]?.swagger_api_token, null);

            // Requisição com o token antigo agora deve falhar
            const testReq = await request(app)
                .get('/api/v1/companies/states')
                .set('Authorization', `Bearer ${generatedRawToken}`);

            assert.strictEqual(testReq.status, 401, 'Token revogado não deve mais autenticar!');
        });

        it('Usuário não super admin (ex: admin comum ou user) deve ser bloqueado ao tentar regenerar ou revogar token Swagger (403)', async () => {
            const regenRes = await request(app)
                .post(`/api/v1/companies/${companyPublicId}/swagger-token/regenerate`)
                .set('Authorization', `Bearer ${adminToken}`);

            assert.strictEqual(regenRes.status, 403);

            const revokeRes = await request(app)
                .post(`/api/v1/companies/${companyPublicId}/swagger-token/revoke`)
                .set('Authorization', `Bearer ${userToken}`);

            assert.strictEqual(revokeRes.status, 403);
        });
    });
});
