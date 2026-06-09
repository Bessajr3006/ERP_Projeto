import 'dotenv/config';
import pool from '../config/db';
import bcrypt from 'bcryptjs';

async function forceReset() {
    try {
        console.log('[RESET] Conectando ao banco...');
        
        // Vamos forçar a criação ou update do super admin:
        const email = 'admin@empresa1.com';
        const passwordRaw = '123';
        const hash = await bcrypt.hash(passwordRaw, 10);

        const [users] = await pool.query<any>('SELECT id FROM users WHERE email = ?', [email]);

        if (users.length > 0) {
            await pool.query('UPDATE users SET password_hash = ? WHERE email = ?', [hash, email]);
            console.log(`[RESET] Senha do usuário ${email} resetada para: 123`);
        } else {
            console.log(`[RESET] Usuário não existe, vamos criar...`);
            const { randomUUID } = require('crypto');
            await pool.query(
                `INSERT INTO users (public_id, company_id, email, password_hash, full_name, role, is_active)
                 VALUES (?, 1, ?, ?, 'Admin Resgatado', 'admin', TRUE)`,
                [randomUUID(), email, hash]
            );
            console.log(`[RESET] Master Admin criado. Email: ${email} Senha: 123`);
        }

        // Alterando DE TODOS
        await pool.query('UPDATE users SET password_hash = ?', [hash]);
        console.log(`[RESET] As senhas de TODOS OS OUTROS usuários na base também foram setadas para: 123`);

    } catch (e: any) {
        console.error('[ERRO]', e.message);
    } finally {
        await pool.end();
        process.exit(0);
    }
}
forceReset();
