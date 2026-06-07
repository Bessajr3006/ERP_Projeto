import 'dotenv/config';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?
         LIMIT 1`,
        [tableName, columnName]
    );

    return rows.length > 0;
}

async function constraintExists(tableName: string, constraintName: string): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT CONSTRAINT_NAME
         FROM information_schema.TABLE_CONSTRAINTS
         WHERE CONSTRAINT_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND CONSTRAINT_NAME = ?
         LIMIT 1`,
        [tableName, constraintName]
    );

    return rows.length > 0;
}

async function getColumnMeta(tableName: string, columnName: string): Promise<RowDataPacket | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT COLUMN_TYPE, IS_NULLABLE
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?
         LIMIT 1`,
        [tableName, columnName]
    );

    return rows[0] || null;
}

async function runSql(label: string, sql: string): Promise<void> {
    console.log(`[RUN] ${label}`);
    await pool.query<ResultSetHeader>(sql);
}

async function ensureMeasureTable(): Promise<void> {
    await runSql(
        'ensure measures table',
        `CREATE TABLE IF NOT EXISTS measures (
            id INT AUTO_INCREMENT PRIMARY KEY,
            public_id VARCHAR(36) NOT NULL UNIQUE,
            company_id INT NOT NULL,
            name VARCHAR(100) NOT NULL,
            abbreviation VARCHAR(10) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
            INDEX idx_company_id (company_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
}

async function ensureColumn(tableName: string, columnName: string, sql: string): Promise<void> {
    if (await columnExists(tableName, columnName)) {
        console.log(`[SKIP] ${tableName}.${columnName} already exists`);
        return;
    }

    await runSql(`add ${tableName}.${columnName}`, sql);
}

async function ensureConstraint(tableName: string, constraintName: string, sql: string): Promise<void> {
    if (await constraintExists(tableName, constraintName)) {
        console.log(`[SKIP] constraint ${constraintName} already exists`);
        return;
    }

    await runSql(`add constraint ${constraintName}`, sql);
}

function parseEnumValues(columnType: string): string[] {
    const values: string[] = [];
    const regex = /'((?:[^'\\]|\\.)*)'/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(columnType)) !== null) {
        const enumValue = (match[1] ?? '').replace(/\\'/g, "'");
        values.push(enumValue);
    }

    return values;
}

async function sanitizeLegacySalesOrderStatus(statusMeta: RowDataPacket | null): Promise<void> {
    if (!statusMeta) {
        return;
    }

    const targetAllowed = ['pending', 'completed', 'cancelled', 'separated', 'invoiced'];
    const currentColumnType = String(statusMeta.COLUMN_TYPE || '').toLowerCase();
    const currentEnumValues = parseEnumValues(currentColumnType);
    const fallbackStatus = currentEnumValues.includes('pending')
        ? 'pending'
        : (currentEnumValues[0] || 'pending');

    const [result] = await pool.query<ResultSetHeader>(
        `UPDATE sales_orders
         SET status = ?
         WHERE status IS NULL
            OR TRIM(CAST(status AS CHAR)) = ''
            OR LOWER(TRIM(CAST(status AS CHAR))) NOT IN (?, ?, ?, ?, ?)`,
        [
            fallbackStatus,
            targetAllowed[0],
            targetAllowed[1],
            targetAllowed[2],
            targetAllowed[3],
            targetAllowed[4],
        ]
    );

    if (result.affectedRows > 0) {
        console.log(`[RUN] sanitize sales_orders.status legacy values (${result.affectedRows} row(s))`);
    } else {
        console.log('[SKIP] sales_orders.status legacy values already sane');
    }
}

async function ensureSalesOrderContract(): Promise<void> {
    const customerMeta = await getColumnMeta('sales_orders', 'customer_id');
    if (customerMeta && customerMeta.IS_NULLABLE !== 'YES') {
        await runSql(
            'allow sales_orders.customer_id to be null',
            `ALTER TABLE sales_orders
             MODIFY COLUMN customer_id INT NULL`
        );
    } else {
        console.log('[SKIP] sales_orders.customer_id already allows null');
    }

    const statusMeta = await getColumnMeta('sales_orders', 'status');
    const requiredEnum = "enum('pending','completed','cancelled','separated','invoiced')";
    if (!statusMeta || String(statusMeta.COLUMN_TYPE).toLowerCase() !== requiredEnum) {
        await sanitizeLegacySalesOrderStatus(statusMeta);
        await runSql(
            'expand sales_orders.status enum',
            `ALTER TABLE sales_orders
             MODIFY COLUMN status ENUM('pending', 'completed', 'cancelled', 'separated', 'invoiced') NOT NULL DEFAULT 'pending'`
        );
    } else {
        console.log('[SKIP] sales_orders.status already aligned');
    }

    await ensureColumn(
        'sales_orders',
        'delivery_address',
        `ALTER TABLE sales_orders
         ADD COLUMN delivery_address TEXT NULL AFTER date`
    );
}

export async function runMigration18(): Promise<void> {
    console.log('');
    console.log('┌──────────────────────────────────────────────────────────────┐');
    console.log('│  Migration 18: schema contract alignment                    │');
    console.log('└──────────────────────────────────────────────────────────────┘');
    console.log('');

    await ensureColumn(
        'bank_accounts',
        'institution',
        `ALTER TABLE bank_accounts
         ADD COLUMN institution VARCHAR(255) DEFAULT NULL AFTER name`
    );

    await ensureMeasureTable();

    await ensureColumn(
        'products',
        'external_code',
        `ALTER TABLE products
         ADD COLUMN external_code VARCHAR(100) DEFAULT NULL AFTER ean`
    );
    await ensureColumn(
        'products',
        'ncm',
        `ALTER TABLE products
         ADD COLUMN ncm VARCHAR(8) DEFAULT NULL AFTER external_code`
    );
    await ensureColumn(
        'products',
        'cest',
        `ALTER TABLE products
         ADD COLUMN cest VARCHAR(7) DEFAULT NULL AFTER ncm`
    );
    await ensureColumn(
        'products',
        'min_stock',
        `ALTER TABLE products
         ADD COLUMN min_stock INT DEFAULT 0 AFTER current_stock`
    );
    await ensureColumn(
        'products',
        'max_stock',
        `ALTER TABLE products
         ADD COLUMN max_stock INT DEFAULT 0 AFTER min_stock`
    );
    await ensureColumn(
        'products',
        'category_id',
        `ALTER TABLE products
         ADD COLUMN category_id INT NULL AFTER max_stock`
    );
    await ensureColumn(
        'products',
        'manufacturer_id',
        `ALTER TABLE products
         ADD COLUMN manufacturer_id INT NULL AFTER category_id`
    );
    await ensureColumn(
        'products',
        'tax_rule_id',
        `ALTER TABLE products
         ADD COLUMN tax_rule_id INT NULL AFTER manufacturer_id`
    );
    await ensureColumn(
        'products',
        'measure_id',
        `ALTER TABLE products
         ADD COLUMN measure_id INT NULL AFTER tax_rule_id`
    );
    await ensureColumn(
        'products',
        'image_url',
        `ALTER TABLE products
         ADD COLUMN image_url VARCHAR(512) NULL DEFAULT NULL AFTER image_base64`
    );

    await ensureConstraint(
        'products',
        'fk_product_category',
        `ALTER TABLE products
         ADD CONSTRAINT fk_product_category FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE SET NULL`
    );
    await ensureConstraint(
        'products',
        'fk_product_manufacturer',
        `ALTER TABLE products
         ADD CONSTRAINT fk_product_manufacturer FOREIGN KEY (manufacturer_id) REFERENCES manufacturers(id) ON DELETE SET NULL`
    );
    await ensureConstraint(
        'products',
        'fk_product_tax_rule',
        `ALTER TABLE products
         ADD CONSTRAINT fk_product_tax_rule FOREIGN KEY (tax_rule_id) REFERENCES tax_rules(id) ON DELETE SET NULL`
    );
    await ensureConstraint(
        'products',
        'fk_product_measure',
        `ALTER TABLE products
         ADD CONSTRAINT fk_product_measure FOREIGN KEY (measure_id) REFERENCES measures(id) ON DELETE SET NULL`
    );

    await ensureColumn(
        'tax_rules',
        'csosn',
        `ALTER TABLE tax_rules
         ADD COLUMN csosn VARCHAR(4) DEFAULT NULL AFTER ncm`
    );
    await ensureColumn(
        'tax_rules',
        'icms_type',
        `ALTER TABLE tax_rules
         ADD COLUMN icms_type VARCHAR(20) DEFAULT 'Normal' AFTER csosn`
    );
    await ensureColumn(
        'tax_rules',
        'mva_internal_percentage',
        `ALTER TABLE tax_rules
         ADD COLUMN mva_internal_percentage DECIMAL(5, 2) DEFAULT 0.00 AFTER icms_percentage`
    );
    await ensureColumn(
        'tax_rules',
        'mva_interstate_percentage',
        `ALTER TABLE tax_rules
         ADD COLUMN mva_interstate_percentage DECIMAL(5, 2) DEFAULT 0.00 AFTER mva_internal_percentage`
    );

    await ensureSalesOrderContract();

    console.log('');
    console.log('[OK] Migration 18 completed successfully.');
}

if (require.main === module) {
    runMigration18().catch(async (error) => {
        console.error('\n[ERROR] Migration 18 failed:', error);
        process.exitCode = 1;
    }).finally(async () => {
        await pool.end();
    });
}
