import pool from '../config/db';

export async function runMigration107(): Promise<void> {
    console.log('│  Migration 107: Alter cnpj_document_url to TEXT             │');
    
    const tables = ['customers', 'suppliers'];
    
    for (const table of tables) {
        try {
            await pool.query(`ALTER TABLE \`${table}\` MODIFY COLUMN \`cnpj_document_url\` TEXT DEFAULT NULL`);
            console.log(`[OK] Table ${table}: cnpj_document_url changed to TEXT`);
        } catch (e: any) {
            console.error(`[ERROR] Table ${table} migration failed: ${e.message}`);
        }
    }
}
