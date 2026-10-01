const { default: pool } = require('/app/dist/config/db');

async function main() {
    try {
        const [rows] = await pool.query('SELECT * FROM company_poscontrol_configs WHERE company_id = 13 LIMIT 1');
        if (!rows || rows.length === 0) {
            console.error('No config found');
            process.exit(1);
        }
        const cfg = rows[0];
        console.log('Using username:', cfg.poscontrol_username);

        // 1. Authenticate
        let url = cfg.url_token || 'https://api.poscontrole.com.br/v2/auth/token';
        if (cfg.subscription_key) {
            const urlObj = new URL(url);
            urlObj.searchParams.set('subscription-key', cfg.subscription_key);
            url = urlObj.toString();
        }

        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded'
        };
        if (cfg.ocp_apim_subscription_key) {
            headers['Ocp-Apim-Subscription-Key'] = cfg.ocp_apim_subscription_key;
        }

        const params = new URLSearchParams();
        params.append('username', cfg.poscontrol_username);
        params.append('password', cfg.poscontrol_password);

        console.log('Authenticating at:', url);
        const authRes = await fetch(url, {
            method: 'POST',
            headers,
            body: params.toString()
        });

        if (!authRes.ok) {
            const text = await authRes.text();
            throw new Error(`Auth failed: ${authRes.statusText} (${authRes.status}) - ${text}`);
        }

        const authData = await authRes.json();
        let jwt = '';
        if (Array.isArray(authData) && authData.length > 0 && authData[0].jwt) {
            jwt = authData[0].jwt;
        } else if (authData && authData.jwt) {
            jwt = authData.jwt;
        }

        if (!jwt) {
            throw new Error('No JWT returned');
        }
        console.log('JWT obtained successfully');

        // 2. Get Status Types
        let statusUrl = "https://api.poscontrole.com.br/v2/statustypes";
        if (cfg.subscription_key) {
            const urlObj = new URL(statusUrl);
            urlObj.searchParams.set('subscription-key', cfg.subscription_key);
            statusUrl = urlObj.toString();
        }

        const headersJwt = {
            'Authorization': `Bearer ${jwt}`
        };
        if (cfg.ocp_apim_subscription_key) {
            headersJwt['Ocp-Apim-Subscription-Key'] = cfg.ocp_apim_subscription_key;
        }

        const statusRes = await fetch(statusUrl, { headers: headersJwt });
        let activeId = "ABCDEABC-ABCD-ABCD-ABCD-ABCED1758966";
        let inactiveId = "ABCDEABC-ABCD-ABCD-ABCD-ABCED1457822";
        if (statusRes.ok) {
            const statusList = await statusRes.json();
            console.log('statusList response:', JSON.stringify(statusList));
            const list = Array.isArray(statusList) ? statusList : (statusList && Array.isArray(statusList.Result) ? statusList.Result : []);
            for (const st of list) {
                if (st.Name === 'Habilitado') {
                    activeId = st.StatusTypeID;
                } else if (st.Name === 'Desabilitado') {
                    inactiveId = st.StatusTypeID;
                }
            }
        }
        console.log('Active StatusID:', activeId, 'Inactive StatusID:', inactiveId);

        // 3. Get first 25 products
        const [products] = await pool.query(`
            SELECT p.*, c.idgrupopos AS category_pos_id, pt.idprodutotipopos AS product_type_pos_id, me.idmedidapos AS measure_pos_id 
            FROM products p 
            LEFT JOIN product_categories c ON p.category_id = c.id 
            LEFT JOIN product_types pt ON p.product_type_id = pt.id 
            LEFT JOIN measures me ON p.measure_id = me.id 
            WHERE p.company_id = 13 
            LIMIT 25
        `);
        console.log(`Loaded ${products.length} products`);

        // 4. Map products
        const mapped = products.map(p => {
            const ean = p.ean || "";
            const barcodes = [{"BarCode": ean}];
            while (barcodes.length < 5) {
                barcodes.push({"BarCode": ""});
            }

            const status_pos_id = p.status_pos_id === "ABCDEABC-ABCD-ABCD-ABCD-ABCED1457822" ? inactiveId : activeId;
            const prod_type_id = p.product_type_pos_id || "55550E77-10D1-40DA-A067-075CB2124577";
            const unit_type_id = p.measure_pos_id || "55550E77-10D1-40DA-A067-075CB2124ACC";

            return {
                "Product": {
                    "ProductID": p.idprodutopos || "",
                    "StatusID": status_pos_id,
                    "ProductGroupID": p.category_pos_id || "",
                    "ProductTypeID": prod_type_id,
                    "UnitTypeID": unit_type_id,
                    "Name": String(p.name || "").substring(0, 50),
                    "NameEng": String(p.name || "").substring(0, 50),
                    "InternalCode": p.sku || "",
                    "BarCode": ean,
                    "BarCodeJS": barcodes,
                    "ImageBase64": "",
                    "NFCeNCM": p.ncm || "",
                    "NFCeCFOP": "",
                    "NFCeCST": "",
                    "NFCeAliqICMS": "",
                    "NFCeCEST": p.cest || "",
                    "NFCeCSTPIS": "",
                    "NFCeAliqPIS": "",
                    "NFCeCSTCOFINS": "",
                    "NFCeAliqCOFINS": "",
                    "NFCeCodANP": "",
                    "NFCeBaseRedICMS": "",
                    "NFCeCodBenef": "",
                    "NFCecBenef": "",
                    "NFCeMotBenef": "",
                    "SalePrice": parseFloat(p.selling_price || 0.0),
                    "NFCeIBS_CBS_CST": "",
                    "NFCeIBS_AliqUF": "",
                    "NFCeIBS_AliqMUN": "",
                    "NFCeIBS_PercRedBase": ""
                }
            };
        });

        // 5. Send products
        let productsUrl = "https://api.poscontrole.com.br/v2/products";
        if (cfg.subscription_key) {
            const urlObj = new URL(productsUrl);
            urlObj.searchParams.set('subscription-key', cfg.subscription_key);
            productsUrl = urlObj.toString();
        }

        const headersPost = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwt}`
        };
        if (cfg.ocp_apim_subscription_key) {
            headersPost['Ocp-Apim-Subscription-Key'] = cfg.ocp_apim_subscription_key;
        }

        console.log('Sending products to:', productsUrl);
        const postRes = await fetch(productsUrl, {
            method: 'POST',
            headers: headersPost,
            body: JSON.stringify(mapped)
        });

        console.log('Response Status:', postRes.status, postRes.statusText);
        const text = await postRes.text();
        console.log('Response raw body:');
        console.log(text);
        
        process.exit(0);
    } catch (err) {
        console.error('Error in script:', err);
        process.exit(1);
    }
}

main();
