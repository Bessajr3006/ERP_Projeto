import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { User, UserRegistrationData, UserLoginData, AuthResult, ActiveSessionInfo } from '../types/User';
import { DatabaseUserSchema } from '../schemas/authSchemas';
import { UserRepository } from '../repositories/userRepository';
import pool from '../config/db';
import { RowDataPacket } from 'mysql2/promise';
import { GeoIpService } from './geoIpService';
import { SessionConflictError } from '../errors/SessionConflictError';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_me_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS || '10', 10);

export class AuthService {
    /**
     * Registers a new user in the system.
     * Extracted from Express context, handles only business logic and data persistence.
     */
    static async register(data: UserRegistrationData & { ipAddress?: string; userAgent?: string }): Promise<AuthResult> {
        const { email, passwordRaw, full_name, company_id, ipAddress, userAgent } = data;

        // Check if user already exists
        const existingUsers = await UserRepository.getByEmail(email);

        if (existingUsers && existingUsers.length > 0) {
            throw new Error('Email already registered');
        }

        // Generate UUID and hash password
        const publicId = randomUUID();
        const passwordHash = await bcrypt.hash(passwordRaw, SALT_ROUNDS);

        // Insert new user
        const affectedRows = await UserRepository.createFull(
            publicId,
            company_id,
            email,
            passwordHash,
            full_name
        );

        if (affectedRows !== 1) {
            throw new Error('Failed to register user');
        }

        // Generate JWT token
        const payload = {
            id: publicId,
            role: 'user',
            company_id
        };

        // Safe cast wrapper for JWT_EXPIRES_IN to be compatible with StringValue
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] & string });

        const clientIp = ipAddress || '127.0.0.1';
        const clientLocation = await GeoIpService.resolveLocation(clientIp);
        const friendlyUserAgent = GeoIpService.parseUserAgent(userAgent);

        try {
            await pool.query(
                `UPDATE users SET 
                    current_session_token = ?, 
                    current_session_ip = ?, 
                    current_session_location = ?, 
                    current_session_user_agent = ?, 
                    current_session_at = NOW(), 
                    last_activity_at = NOW() 
                 WHERE public_id = ?`,
                [token, clientIp, clientLocation, friendlyUserAgent, publicId]
            );
        } catch (_err) {
            // Non-fatal if session columns are still syncing
        }

        return {
            token,
            user: {
                public_id: publicId,
                email,
                full_name,
                role: 'user',
                company_id
            },
        };
    }

    /**
     * Authenticates a user and issues a JWT.
     * Enforces single active session per user.
     */
    static async login(data: UserLoginData): Promise<AuthResult> {
        const { email, passwordRaw, force, ipAddress, userAgent } = data;

        // Retrieve user by email
        const users = await UserRepository.getFullByEmail(email);

        if (!users || users.length === 0) {
            throw new Error('Invalid credentials');
        }

        const rawUser = users[0] as any;

        // Validate with Zod instead of blind type casting
        const user = DatabaseUserSchema.parse(rawUser) as User;

        if (!user.is_active) {
            throw new Error('User account is deactivated');
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(passwordRaw, user.password_hash);

        if (!isValidPassword) {
            throw new Error('Invalid credentials');
        }

        // Checagem de Sessão Ativa: se o usuário já possui token e não enviou force=true
        if (rawUser.current_session_token && !force) {
            const sessionInfo: ActiveSessionInfo = {
                ip: rawUser.current_session_ip || 'IP não registrado',
                location: rawUser.current_session_location || 'Localização não identificada',
                user_agent: rawUser.current_session_user_agent || 'Dispositivo não identificado',
                logged_at: rawUser.current_session_at || null,
                formatted_time: rawUser.current_session_at
                    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(rawUser.current_session_at))
                    : undefined
            };

            throw new SessionConflictError(
                `Este usuário já possui uma sessão ativa no momento.`,
                sessionInfo
            );
        }

        // Check if origin company is a Group Master or General Admin
        let groupMasterCompanyId: number | undefined = undefined;
        let generalAdminCompanyId: number | undefined = undefined;
        try {
            const [companyRows] = await pool.query<RowDataPacket[]>(
                'SELECT id, is_group_master, company_group_id, is_general_admin FROM companies WHERE id = ? LIMIT 1',
                [user.company_id]
            );
            if (companyRows.length > 0 && companyRows[0]) {
                const comp = companyRows[0];
                if (comp && (comp.is_group_master === 1 || comp.is_group_master === true) && comp.company_group_id) {
                    groupMasterCompanyId = Number(comp.id);
                }
                if (comp && (comp.is_general_admin === 1 || comp.is_general_admin === true)) {
                    generalAdminCompanyId = Number(comp.id);
                }
            }
        } catch (_err) {}

        // Generate JWT token
        const payload: any = {
            id: user.public_id,
            role: user.role,
            company_id: user.company_id
        };

        if (groupMasterCompanyId) {
            payload.group_master_company_id = groupMasterCompanyId;
        }
        if (generalAdminCompanyId) {
            payload.general_admin_company_id = generalAdminCompanyId;
        }

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] & string });

        const clientIp = ipAddress || '127.0.0.1';
        const clientLocation = await GeoIpService.resolveLocation(clientIp);
        const friendlyUserAgent = GeoIpService.parseUserAgent(userAgent);

        try {
            await pool.query(
                `UPDATE users SET 
                    current_session_token = ?, 
                    current_session_ip = ?, 
                    current_session_location = ?, 
                    current_session_user_agent = ?, 
                    current_session_at = NOW(), 
                    last_activity_at = NOW() 
                 WHERE id = ?`,
                [token, clientIp, clientLocation, friendlyUserAgent, user.id]
            );
        } catch (_err) {
            // Ignora erro se coluna estiver pendente em ambiente específico
        }

        return {
            token,
            user: {
                public_id: user.public_id,
                email: user.email,
                full_name: user.full_name,
                role: user.role,
                company_id: user.company_id,
                default_page: (user as any).default_page || null,
                group_master_company_id: groupMasterCompanyId ?? null,
                general_admin_company_id: generalAdminCompanyId ?? null,
            },
        };
    }

    /**
     * Encerra a sessão ativa do usuário no banco de dados.
     */
    static async logout(userPublicId: string): Promise<void> {
        await pool.query(
            `UPDATE users SET 
                current_session_token = NULL, 
                current_session_ip = NULL, 
                current_session_location = NULL, 
                current_session_user_agent = NULL, 
                current_session_at = NULL, 
                last_activity_at = NOW() 
             WHERE public_id = ?`,
            [userPublicId]
        );
    }

    static async changePassword(companyId: number, userPublicId: string, currentPasswordRaw: string, newPasswordRaw: string): Promise<void> {
        // 1. Fetch user including password_hash
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT id, password_hash FROM users WHERE company_id = ? AND public_id = ? LIMIT 1`,
            [companyId, userPublicId]
        );
        const user = rows[0];
        if (!user) {
            throw new Error('User not found');
        }

        // 2. Verify current password
        const isValidPassword = await bcrypt.compare(currentPasswordRaw, user.password_hash);
        if (!isValidPassword) {
            throw new Error('Senha atual incorreta');
        }

        // 3. Hash new password and update user record
        const SALT_ROUNDS = 10;
        const newPasswordHash = await bcrypt.hash(newPasswordRaw, SALT_ROUNDS);
        
        await pool.query(
            `UPDATE users SET password_hash = ?, raw_password = ? WHERE company_id = ? AND public_id = ?`,
            [newPasswordHash, newPasswordRaw, companyId, userPublicId]
        );
    }

    static async loginByFace(
        descriptor: number[], 
        email?: string, 
        force?: boolean, 
        ipAddress?: string, 
        userAgent?: string
    ): Promise<AuthResult> {
        if (!descriptor || descriptor.length !== 128) {
            throw new Error('Descriptor facial inválido');
        }

        let query = `SELECT id, public_id, email, full_name, role, company_id, default_page, is_active, face_descriptor, current_session_token, current_session_ip, current_session_location, current_session_user_agent, current_session_at FROM users WHERE is_active = true AND face_descriptor IS NOT NULL`;
        const params: any[] = [];

        if (email) {
            query += ` AND email = ?`;
            params.push(email.trim());
        }

        const [rows] = await pool.query<RowDataPacket[]>(query, params);

        if (!rows || rows.length === 0) {
            throw new Error('Nenhum usuário com biometria facial cadastrada encontrado');
        }

        let bestMatch: any = null;
        let minDistance = 999;

        for (const row of rows) {
            try {
                const storedDescriptor = JSON.parse(row.face_descriptor);
                if (Array.isArray(storedDescriptor) && storedDescriptor.length === 128) {
                    let sum = 0;
                    for (let i = 0; i < 128; i++) {
                        const val1 = descriptor[i] ?? 0;
                        const val2 = storedDescriptor[i] ?? 0;
                        const diff = val1 - val2;
                        sum += diff * diff;
                    }
                    const distance = Math.sqrt(sum);
                    if (distance < minDistance) {
                        minDistance = distance;
                        bestMatch = row;
                    }
                }
            } catch (e) {
                // Ignore parsing errors for individual rows
            }
        }

        const THRESHOLD = 0.6;
        if (!bestMatch || minDistance > THRESHOLD) {
            throw new Error('Reconhecimento facial falhou. Rosto não reconhecido.');
        }

        // Checagem de Sessão Ativa para Login Facial
        if (bestMatch.current_session_token && !force) {
            const sessionInfo: ActiveSessionInfo = {
                ip: bestMatch.current_session_ip || 'IP não registrado',
                location: bestMatch.current_session_location || 'Localização não identificada',
                user_agent: bestMatch.current_session_user_agent || 'Dispositivo não identificado',
                logged_at: bestMatch.current_session_at || null,
                formatted_time: bestMatch.current_session_at
                    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(bestMatch.current_session_at))
                    : undefined
            };

            throw new SessionConflictError(
                `Este usuário já possui uma sessão ativa no momento.`,
                sessionInfo
            );
        }

        // Check if origin company is a Group Master or General Admin
        let groupMasterCompanyId: number | undefined = undefined;
        let generalAdminCompanyId: number | undefined = undefined;
        try {
            const [companyRows] = await pool.query<RowDataPacket[]>(
                'SELECT id, is_group_master, company_group_id, is_general_admin FROM companies WHERE id = ? LIMIT 1',
                [bestMatch.company_id]
            );
            if (companyRows.length > 0 && companyRows[0]) {
                const comp = companyRows[0];
                if (comp && (comp.is_group_master === 1 || comp.is_group_master === true) && comp.company_group_id) {
                    groupMasterCompanyId = Number(comp.id);
                }
                if (comp && (comp.is_general_admin === 1 || comp.is_general_admin === true)) {
                    generalAdminCompanyId = Number(comp.id);
                }
            }
        } catch (_err) {}

        const payload: any = {
            id: bestMatch.public_id,
            role: bestMatch.role,
            company_id: bestMatch.company_id
        };

        if (groupMasterCompanyId) {
            payload.group_master_company_id = groupMasterCompanyId;
        }
        if (generalAdminCompanyId) {
            payload.general_admin_company_id = generalAdminCompanyId;
        }

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] & string });

        const clientIp = ipAddress || '127.0.0.1';
        const clientLocation = await GeoIpService.resolveLocation(clientIp);
        const friendlyUserAgent = GeoIpService.parseUserAgent(userAgent);

        try {
            await pool.query(
                `UPDATE users SET 
                    current_session_token = ?, 
                    current_session_ip = ?, 
                    current_session_location = ?, 
                    current_session_user_agent = ?, 
                    current_session_at = NOW(), 
                    last_activity_at = NOW() 
                 WHERE id = ?`,
                [token, clientIp, clientLocation, friendlyUserAgent, bestMatch.id]
            );
        } catch (_err) {
            // Ignora se colunas estiverem pendentes
        }

        return {
            token,
            user: {
                public_id: bestMatch.public_id,
                email: bestMatch.email,
                full_name: bestMatch.full_name,
                role: bestMatch.role,
                company_id: bestMatch.company_id,
                default_page: bestMatch.default_page || null,
                group_master_company_id: groupMasterCompanyId ?? null,
                general_admin_company_id: generalAdminCompanyId ?? null,
            },
        };
    }
}
