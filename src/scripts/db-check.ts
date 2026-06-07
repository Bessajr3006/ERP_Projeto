import { checkDbConnection } from '../config/db';

async function runDbCheck() {
    console.log('Initiating database connection check...');

    const isConnected = await checkDbConnection();

    if (isConnected) {
        try {
            const pool = require('../config/db').default;
            await pool.query("ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS nature ENUM('debit', 'credit') NOT NULL DEFAULT 'debit' AFTER type");
            console.log("Column nature added successfully.");
        } catch(e) { console.log(e); }

        console.log('Database connection check passed.');
        process.exit(0);
    } else {
        console.error('Database connection check failed.');
        process.exit(1);
    }
}

runDbCheck();
