import pool from './src/config/db';

async function main() {
    const ids = [
        '1a1047c5-e0ae-4522-9747-59740afc89d6',
        '597a6c19-a6ba-436b-a907-654fe6911426',
        '6bd77111-9c52-4655-92a0-14c54826306f',
        '7f930cf8-1262-40d6-8308-779de7317ca0',
        '33fa2a89-1047-42b0-bedf-3022282c0e0c'
    ];

    try {
        const [rows]: any = await pool.query(
            `SELECT id, public_id, description, amount, status, payment_method, billet_url, pix_code, barcode, date 
             FROM transactions 
             WHERE public_id IN (?)`,
            [ids]
        );

        console.log('--- Transactions Found ---');
        console.log(JSON.stringify(rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

main();
