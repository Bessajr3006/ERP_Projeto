import 'dotenv/config';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_me_in_production';

async function main() {
    // Payload for user 6 (bessa@aporttec.com)
    const payload = {
        id: '7afab0ae-fb0a-4762-a4e8-e9979e78a620',
        role: 'admin',
        company_id: 2
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    console.log('JWT Token signed:', token);

    // Call send message endpoint
    const response = await fetch('http://127.0.0.1:3000/api/v1/companies/5951571a-3102-47db-927d-ad66232dcd39/whatsapp-business/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            to: '5521996895570',
            message: 'Olá! Esta é uma mensagem de teste enviada pelo backend do ERP Bessa.'
        })
    });

    console.log('Response Status:', response.status);
    const data = await response.json();
    console.log('Response Body:', data);
}

main().catch(err => {
    console.error('Fatal error:', err);
});
