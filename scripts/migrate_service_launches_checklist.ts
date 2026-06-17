import * as dotenv from "dotenv";
dotenv.config();

import pool from '../src/config/db';

async function migrate() {
    try {
        console.log('Adding checklist column to service_launches...');
        await pool.query('ALTER TABLE service_launches ADD COLUMN checklist JSON DEFAULT NULL;');
        console.log('Migration successful!');
    } catch (e: any) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log('Column already exists, ignoring.');
        } else {
            console.error('Migration failed:', e);
        }
    } finally {
        process.exit(0);
    }
}

migrate();
