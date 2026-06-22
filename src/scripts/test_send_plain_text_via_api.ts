import 'dotenv/config';
import jwt from 'jsonwebtoken';
import pool from '../config/db';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_me_in_production';

async function main() {
    // Get company 2 public ID
    const [companyRows]: any = await pool.query('SELECT public_id FROM companies WHERE id = 2');
    if (!companyRows.length) {
        throw new Error('Company 2 not found');
    }
    const companyPublicId = companyRows[0].public_id;
    console.log('Company 2 Public ID:', companyPublicId);

    // Get user 6 public ID
    const [userRows]: any = await pool.query('SELECT public_id FROM users WHERE id = 6');
    if (!userRows.length) {
        throw new Error('User 6 not found');
    }
    const userPublicId = userRows[0].public_id;
    console.log('User 6 Public ID:', userPublicId);

    const payload = {
        id: userPublicId,
        role: 'admin',
        company_id: 2
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    console.log('JWT Token signed:', token);

    // Hit the send message endpoint on port 3001
    const url = `http://127.0.0.1:3001/api/v1/companies/${companyPublicId}/whatsapp-business/messages`;
    console.log('Sending request to:', url);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            to: '5521996895581',
            message: 'Olá! Segue em anexo o documento de teste enviado via API.',
            attachment: {
                base64: 'JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9QYXJlbnQgMiAwIFIgL01lZGlhQm94IFswIDAgNTk1IDg0Ml0gPj4KZW5kb2JqCnhyZWYKMCA0CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxNyAwMDAwMCBuIAowMDAwMDAwMDcwIDAwMDAwIG4gCjAwMDAwMDAxMjAgMDAwMDAgbiAKdHJhaWxlcgo8PCAvU2l6ZSA0IC9Sb290IDEgMCBSID4+CnN0YXJ0eHJlZgoxNzIKJSVFT0YK',
                mimeType: 'application/pdf',
                fileName: 'recibo_teste.pdf'
            }
        })
    });

    console.log('Response Status:', response.status);
    const data = await response.json();
    console.log('Response Body:', data);
}

main().catch(err => {
    console.error('Fatal error:', err);
}).finally(() => {
    pool.end();
});
