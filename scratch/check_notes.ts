import 'dotenv/config';
import pool from '../src/config/db';

async function run() {
    try {
        console.log("Checking customer_notes table...");
        const [columns] = await pool.query("DESCRIBE customer_notes");
        console.log("Columns of customer_notes:", columns);

        const [notes] = await pool.query("SELECT * FROM customer_notes LIMIT 5");
        console.log("Sample customer_notes records:", notes);

        const [customers] = await pool.query("SELECT id, public_id, name FROM customers LIMIT 5");
        console.log("Sample customers:", customers);

        const [notesCount] = await pool.query("SELECT COUNT(*) as count FROM customer_notes");
        console.log("Total notes count:", notesCount);

    } catch (e) {
        console.error("Error executing query:", e);
    } finally {
        process.exit(0);
    }
}

run();
