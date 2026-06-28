import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { User, UserRegistrationData, UserLoginData, AuthResult } from '../types/User';
import { DatabaseUserSchema } from '../schemas/authSchemas';
import { UserRepository } from '../repositories/userRepository';
import pool from '../config/db';
import { RowDataPacket } from 'mysql2/promise';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_me_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS || '10', 10);

export class AuthService {
    /**
     * Registers a new user in the system.
     * Extracted from Express context, handles only business logic and data persistence.
     */
    static async register(data: UserRegistrationData): Promise<AuthResult> {
        const { email, passwordRaw, full_name, company_id } = data;

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
     * Extracted from Express context, handles only business logic and validation.
     */
    static async login(data: UserLoginData): Promise<AuthResult> {
        const { email, passwordRaw } = data;

        // Retrieve user by email
        const users = await UserRepository.getFullByEmail(email);

        if (!users || users.length === 0) {
            throw new Error('Invalid credentials');
        }

        // Validate with Zod instead of blind type casting
        const user = DatabaseUserSchema.parse(users[0]) as User;

        if (!user.is_active) {
            throw new Error('User account is deactivated');
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(passwordRaw, user.password_hash);

        if (!isValidPassword) {
            throw new Error('Invalid credentials');
        }

        // Generate JWT token
        const payload = {
            id: user.public_id,
            role: user.role,
            company_id: user.company_id
        };

        // The "expiresIn" can't accept undefined when exactOptionalPropertyTypes is true. 
        // We force it to StringValue since we defined JWT_EXPIRES_IN as a string.
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] & string });

        return {
            token,
            user: {
                public_id: user.public_id,
                email: user.email,
                full_name: user.full_name,
                role: user.role,
                company_id: user.company_id,
                default_page: (user as any).default_page || null,
            },
        };
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
}
