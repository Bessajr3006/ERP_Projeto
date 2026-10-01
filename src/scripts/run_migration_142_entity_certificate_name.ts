import pool from '../config/db';

export async function runMigration142EntityCertificateName(): Promise<void> {
    console.log('│  Migration 142: Add certificate_name to entities tables     │');
    
    const tables = ['contacts', 'customers', 'suppliers'];
    for (const table of tables) {
        try {
            // Check if column exists
            const [columns] = await pool.query<any[]>(
                `SHOW COLUMNS FROM \`${table}\` LIKE 'certificate_name'`
            );
            if (columns.length === 0) {
                await pool.query(
                    `ALTER TABLE \`${table}\` ADD COLUMN \`certificate_name\` VARCHAR(255) DEFAULT NULL AFTER \`certificate_expiration\``
                );
                console.log(`[OK] Table ${table}: added certificate_name column`);
            } else {
                console.log(`[SKIP] Table ${table}: certificate_name column already exists`);
            }
        } catch (e: any) {
            console.error(`[ERROR] Table ${table} migration failed: ${e.message}`);
        }
    }
}
