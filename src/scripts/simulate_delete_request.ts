import 'dotenv/config';

async function main() {
    try {
        console.log('Logging in to backend at http://localhost:3001...');
        const loginRes = await fetch('http://localhost:3001/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'bessa@aporttec.com',
                passwordRaw: '123'
            })
        });

        if (!loginRes.ok) {
            console.error('Login failed:', loginRes.status, await loginRes.text());
            return;
        }

        const loginData = await loginRes.json() as any;
        const token = loginData.token || loginData.data?.token;
        console.log('Login successful. Token:', token ? 'obtained' : 'missing');

        // Let's attempt deletion of Júlio Cesar (public_id: af8a9ff8-511e-47cc-9ca1-0634933bb554)
        const targetUserId = 'af8a9ff8-511e-47cc-9ca1-0634933bb554';
        console.log(`Sending DELETE /api/v1/users/${targetUserId}...`);

        const deleteRes = await fetch(`http://localhost:3001/api/v1/users/${targetUserId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('Response Status:', deleteRes.status);
        console.log('Response Headers:', Object.fromEntries(deleteRes.headers.entries()));
        
        const text = await deleteRes.text();
        console.log('Response Body:', text);

    } catch (err) {
        console.error('Request failed:', err);
    }
}

main();
