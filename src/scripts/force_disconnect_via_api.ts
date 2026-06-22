import 'dotenv/config';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_me_in_production';

async function main() {
    const payload = {
        id: '7afab0ae-fb0a-4762-a4e8-e9979e78a620',
        role: 'admin',
        company_id: 2
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    console.log('JWT Token signed:', token);

    // Call disconnect session endpoint on the backend container (port 3001 on host)
    const response = await fetch('http://127.0.0.1:3001/api/v1/users/7afab0ae-fb0a-4762-a4e8-e9979e78a620/whatsapp-business/session', {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    console.log('Response Status:', response.status);
    const data = await response.json();
    console.log('Response Body:', data);
}

main().catch(err => {
    console.error('Fatal error:', err);
});
