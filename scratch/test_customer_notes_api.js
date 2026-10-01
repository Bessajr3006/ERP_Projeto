const host = 'http://127.0.0.1:3000';

async function test() {
    console.log('1. Logging in...');
    const loginRes = await fetch(`${host}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'administrador+empresa-2@keystone.local', password: '123' })
    });
    
    if (!loginRes.ok) {
        throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
    }
    
    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log('Login successful! Token acquired.');

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-company-id': '2'
    };

    console.log('\n2. Listing customers to get a test customer...');
    const customersRes = await fetch(`${host}/api/v1/entities/customers`, { headers });
    const customersData = await customersRes.json();
    const customers = customersData.data || [];
    if (customers.length === 0) {
        throw new Error('No customers found to test with.');
    }
    
    const targetCustomer = customers[0];
    const customerId = targetCustomer.public_id;
    console.log(`Using customer: ${targetCustomer.name} (${customerId})`);

    console.log('\n3. Creating a new customer note...');
    const createRes = await fetch(`${host}/api/v1/entities/customers/${customerId}/notes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ note: 'Esta é uma anotação de teste automatizada.' })
    });
    const createData = await createRes.json();
    console.log('Create note response:', createData);
    if (createData.status !== 'success') {
        throw new Error('Failed to create note.');
    }
    const noteId = createData.data.public_id;

    console.log('\n4. Listing notes for customer...');
    const listRes = await fetch(`${host}/api/v1/entities/customers/${customerId}/notes`, { headers });
    const listData = await listRes.json();
    console.log('Notes list:', listData.data);
    const found = listData.data.find(n => n.public_id === noteId);
    if (!found) {
        throw new Error('Created note not found in the list!');
    }
    console.log('Success: Note found in history!');

    console.log('\n5. Deleting customer note...');
    const deleteRes = await fetch(`${host}/api/v1/entities/customers/${customerId}/notes/${noteId}`, {
        method: 'DELETE',
        headers
    });
    const deleteData = await deleteRes.json();
    console.log('Delete note response:', deleteData);

    console.log('\n6. Verifying note was deleted...');
    const verifyRes = await fetch(`${host}/api/v1/entities/customers/${customerId}/notes`, { headers });
    const verifyData = await verifyRes.json();
    const stillFound = verifyData.data.find(n => n.public_id === noteId);
    if (stillFound) {
        throw new Error('Note still exists after deletion!');
    }
    console.log('Success: Note deleted successfully and no longer exists in history!');
    console.log('\nALL TESTS PASSED SUCCESSFULLY!');
}

test().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
