import pool from '../config/db';

export async function runMigration38(): Promise<void> {
    console.log('[INFO] Running migration 38: add NFe/NFCe fiscal columns to companies table...');

    const columnsToAdd = [
        { name: 'ie', type: 'VARCHAR(20) DEFAULT NULL', comment: 'Inscrição Estadual' },
        { name: 'im', type: 'VARCHAR(20) DEFAULT NULL', comment: 'Inscrição Municipal' },
        { name: 'cnae_principal', type: 'VARCHAR(20) DEFAULT NULL', comment: 'CNAE Principal' },
        { name: 'crt', type: 'INT DEFAULT 1', comment: '1=Simples Nacional, 2=Simples Nacional Excesso Rec. Bruta, 3=Regime Normal' },
        { name: 'nfe_environment', type: 'INT DEFAULT 2', comment: '1=Produção, 2=Homologação' },
        { name: 'nfe_series', type: 'INT DEFAULT 1', comment: 'Série da NFe' },
        { name: 'nfe_number', type: 'INT DEFAULT 0', comment: 'Número da NFe' },
        { name: 'nfce_series', type: 'INT DEFAULT 1', comment: 'Série da NFCe' },
        { name: 'nfce_number', type: 'INT DEFAULT 0', comment: 'Número da NFCe' },
        { name: 'csc_id', type: 'VARCHAR(20) DEFAULT NULL', comment: 'ID do CSC (NFCe)' },
        { name: 'csc_token', type: 'VARCHAR(100) DEFAULT NULL', comment: 'Token CSC (NFCe)' }
    ];

    try {
        const [existingColumns] = await pool.query<any>(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'companies'
        `);
        const existingColumnNames = existingColumns.map((c: any) => c.COLUMN_NAME);

        const conn = await pool.getConnection();
        try {
            await conn.query('SET SESSION innodb_strict_mode = OFF');
            await conn.query(`ALTER TABLE companies ROW_FORMAT=DYNAMIC`);
            
            for (const col of columnsToAdd) {
                if (!existingColumnNames.includes(col.name)) {
                    await conn.query(`ALTER TABLE companies ADD COLUMN ${col.name} ${col.type} COMMENT '${col.comment}'`);
                    console.log(`[OK] Added column ${col.name} to companies table.`);
                } else {
                    console.log(`[SKIP] Column ${col.name} already exists in companies table.`);
                }
            }
        } finally {
            conn.release();
        }

        console.log('[OK] Migration 38 completed successfully.');
    } catch (error) {
        console.error('[FAIL] Migration 38 failed:', error);
        throw error;
    }
}

if (require.main === module) {
    runMigration38()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
