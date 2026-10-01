import pool from '../config/db';

export async function runMigration134ContactsCnpjDocumentUrlText(): Promise<void> {
    console.log('│  Migration 134: Alter contacts.cnpj_document_url to TEXT    │');
    
    try {
        await pool.query(`ALTER TABLE \`contacts\` MODIFY COLUMN \`cnpj_document_url\` TEXT DEFAULT NULL`);
        console.log(`[OK] Table contacts: cnpj_document_url changed to TEXT`);
    } catch (e: any) {
        console.error(`[ERROR] Table contacts migration failed: ${e.message}`);
    }
}
