import 'dotenv/config';
import pool from '../config/db';
import { AuthService } from '../services/authService';
import bcrypt from 'bcryptjs';

async function main() {
    console.log('--- PERFORMANCE MEASUREMENT FOR LOGIN & BCRYPT ---');
    
    // 1. Measure raw bcrypt hashing and compare speed
    const password = '123';
    console.log('Measuring bcryptjs hash performance (10 rounds):');
    const startHash = performance.now();
    const hash = await bcrypt.hash(password, 10);
    const endHash = performance.now();
    console.log(`Bcrypt hash took: ${(endHash - startHash).toFixed(2)} ms`);
    
    console.log('Measuring bcryptjs compare performance (5 runs):');
    for (let i = 1; i <= 5; i++) {
        const startCompare = performance.now();
        const match = await bcrypt.compare(password, hash);
        const endCompare = performance.now();
        console.log(`Run ${i}: compare took ${(endCompare - startCompare).toFixed(2)} ms (match: ${match})`);
    }
    
    // 2. Measure full login service execution (including database lookup, bcrypt compare, JWT signing)
    const email = 'administrador+empresa-2@keystone.local';
    console.log('\nMeasuring AuthService.login performance (5 runs):');
    for (let i = 1; i <= 5; i++) {
        const startLogin = performance.now();
        const result = await AuthService.login({ email, passwordRaw: password });
        const endLogin = performance.now();
        console.log(`Run ${i}: AuthService.login took ${(endLogin - startLogin).toFixed(2)} ms`);
    }
    
    await pool.end();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
