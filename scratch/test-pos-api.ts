import { pool } from '../src/database/conn';
import fetch from 'node-fetch';

async function main() {
    try {
        const [rows]: any = await pool.query('SELECT * FROM company_poscontrol_configs WHERE company_id = 13 LIMIT 1');
        if (rows.length === 0) {
            console.error('No configuration found for company 13.');
            return;
        }
        
        const cfg = rows[0];
        console.log('Using config:', {
            id: cfg.id,
            company_id: cfg.company_id,
            poscontrol_username: cfg.poscontrol_username,
            subscription_key: cfg.subscription_key,
            ocp_apim_subscription_key: cfg.ocp_apim_subscription_key
        });

        // 1. Auth Token
        const params = new URLSearchParams();
        params.append('username', cfg.poscontrol_username);
        params.append('password', cfg.poscontrol_password);

        const headers: any = {
            'Content-Type': 'application/x-www-form-urlencoded'
        };

        if (cfg.ocp_apim_subscription_key) {
            headers['Ocp-Apim-Subscription-Key'] = cfg.ocp_apim_subscription_key;
        }

        let url = cfg.url_token || 'https://api.poscontrole.com.br/v2/auth/token';
        if (cfg.subscription_key) {
            const urlObj = new URL(url);
            urlObj.searchParams.set('subscription-key', cfg.subscription_key);
            url = urlObj.toString();
        }

        console.log('Authenticating at:', url);
        const authResponse = await fetch(url, {
            method: 'POST',
            headers,
            body: params.toString()
        });

        if (!authResponse.ok) {
            const errText = await authResponse.text();
            throw new Error(`Auth failed: ${authResponse.statusText} (${authResponse.status}) - ${errText}`);
        }

        const authData: any = await authResponse.json();
        console.log('Auth response:', JSON.stringify(authData, null, 2));

        let jwt = '';
        if (Array.isArray(authData) && authData.length > 0 && authData[0].jwt) {
            jwt = authData[0].jwt;
        } else if (authData && authData.jwt) {
            jwt = authData.jwt;
        }

        if (!jwt) {
            throw new Error('No JWT returned.');
        }

        // 2. Fetch Products
        let productsUrl = 'https://api.poscontrole.com.br/v2/products';
        if (cfg.subscription_key) {
            const urlObj = new URL(productsUrl);
            urlObj.searchParams.set('subscription-key', cfg.subscription_key);
            productsUrl = urlObj.toString();
        }

        const prodHeaders: any = {
            'Authorization': `Bearer ${jwt}`,
            'Accept': 'application/json'
        };
        if (cfg.ocp_apim_subscription_key) {
            prodHeaders['Ocp-Apim-Subscription-Key'] = cfg.ocp_apim_subscription_key;
        }

        console.log('Fetching products from:', productsUrl);
        const prodResponse = await fetch(productsUrl, {
            method: 'GET',
            headers: prodHeaders
        });

        if (!prodResponse.ok) {
            const errText = await prodResponse.text();
            throw new Error(`Products fetch failed: ${prodResponse.statusText} (${prodResponse.status}) - ${errText}`);
        }

        const prodData: any = await prodResponse.json();
        console.log('Products keys/type:', typeof prodData, Array.isArray(prodData) ? `Array (len: ${prodData.length})` : Object.keys(prodData));
        if (Array.isArray(prodData)) {
            console.log('First product sample:', JSON.stringify(prodData[0], null, 2));
        } else {
            console.log('Response sample:', JSON.stringify(prodData, null, 2).substring(0, 1000));
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

main();
