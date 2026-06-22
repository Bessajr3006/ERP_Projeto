import dotenv from 'dotenv';
dotenv.config({ override: true });
import jwt from 'jsonwebtoken';
import https from 'https';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_me_in_production';

async function main() {
    const payload = {
        id: 'bc17d65c-17f5-438b-adde-a53f39f2b2ba', // Bessa's public_id
        role: 'admin',
        company_id: 2
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    console.log('Generated Token:', token);

    const agent = new https.Agent({
        rejectUnauthorized: false
    });

    const options = {
        hostname: 'localhost',
        port: 3020,
        path: '/api/v1/finance/category-types',
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
        },
        agent: agent
    };

    const req = https.request(options, (res) => {
        console.log('Status Code:', res.statusCode);
        console.log('Headers:', res.headers);

        let body = '';
        res.on('data', (chunk) => {
            body += chunk;
        });

        res.on('end', () => {
            console.log('Response Body:', body);
        });
    });

    req.on('error', (err) => {
        console.error('Request Error:', err.message);
    });

    req.end();
}

main();
