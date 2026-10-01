import pool from '../config/db';

export async function runMigration143PurchaseNfeFields(): Promise<void> {
    console.log('│  Migration 143: Add NFe XML fields to purchase_orders       │');
    
    const fields = [
        { name: 'nfe_key', type: 'VARCHAR(44) DEFAULT NULL AFTER date' },
        { name: 'nfe_issue_date', type: 'DATE DEFAULT NULL AFTER nfe_key' },
        { name: 'nfe_header_json', type: 'LONGTEXT DEFAULT NULL AFTER nfe_issue_date' },
        { name: 'nfe_xml', type: 'LONGTEXT DEFAULT NULL AFTER nfe_header_json' }
    ];

    for (const field of fields) {
        try {
            const [columns] = await pool.query<any[]>(
                `SHOW COLUMNS FROM \`purchase_orders\` LIKE '${field.name}'`
            );
            if (columns.length === 0) {
                await pool.query(
                    `ALTER TABLE \`purchase_orders\` ADD COLUMN \`${field.name}\` ${field.type}`
                );
                console.log(`[OK] Table purchase_orders: added ${field.name} column`);
            } else {
                console.log(`[SKIP] Table purchase_orders: ${field.name} column already exists`);
            }
        } catch (e: any) {
            console.error(`[ERROR] Table purchase_orders: migration failed for ${field.name}: ${e.message}`);
        }
    }
}
