const pool = require('../dist/config/db').default;

async function check() {
    try {
        const [txs] = await pool.query('SELECT amount, type, status FROM transactions WHERE type = "expense" LIMIT 3');
        console.log('Expenses in DB:', txs);
        
        const [stmts] = await pool.query('SELECT amount, type, status FROM bank_statements LIMIT 5');
        console.log('Statements in DB:', stmts);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

check();
