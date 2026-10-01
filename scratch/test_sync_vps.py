import sys
import requests
import pymysql

def main():
    # Connect to database
    db = pymysql.connect(
        host="187.77.24.126",
        user="erp_user",
        password="30mariafn@",
        database="bessa_erp",
        port=3306
    )
    cursor = db.cursor(pymysql.cursors.DictCursor)
    
    # 1. Get config
    cursor.execute("SELECT * FROM company_poscontrol_configs WHERE company_id = 13 LIMIT 1")
    cfg = cursor.fetchone()
    if not cfg:
        print("Config not found")
        return
        
    print(f"Config found: username={cfg['poscontrol_username']}")
    
    # 2. Authenticate
    url = cfg['url_token'] or 'https://api.poscontrole.com.br/v2/auth/token'
    if cfg['subscription_key']:
        url = url + f"?subscription-key={cfg['subscription_key']}"
        
    headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
    }
    if cfg['ocp_apim_subscription_key']:
        headers['Ocp-Apim-Subscription-Key'] = cfg['ocp_apim_subscription_key']
        
    payload = {
        'username': cfg['poscontrol_username'],
        'password': cfg['poscontrol_password']
    }
    
    print(f"Authenticating at {url}...")
    res = requests.post(url, headers=headers, data=payload)
    print(f"Auth response: {res.status_code}")
    if res.status_code != 200:
        print(res.text)
        return
        
    data = res.json()
    jwt = None
    if isinstance(data, list) and len(data) > 0 and 'jwt' in data[0]:
        jwt = data[0]['jwt']
    elif isinstance(data, dict) and 'jwt' in data:
        jwt = data['jwt']
        
    if not jwt:
        print("No JWT token found in auth response:", data)
        return
        
    print("JWT token obtained successfully.")
    
    # 3. Get Active/Inactive Status IDs
    status_url = "https://api.poscontrole.com.br/v2/statustypes"
    if cfg['subscription_key']:
        status_url = status_url + f"?subscription-key={cfg['subscription_key']}"
        
    headers_jwt = {
        'Authorization': f"Bearer {jwt}"
    }
    if cfg['ocp_apim_subscription_key']:
        headers_jwt['Ocp-Apim-Subscription-Key'] = cfg['ocp_apim_subscription_key']
        
    res_status = requests.get(status_url, headers=headers_jwt)
    print(f"Status response: {res_status.status_code}")
    active_id = "ABCDEABC-ABCD-ABCD-ABCD-ABCED1758966"
    inactive_id = "ABCDEABC-ABCD-ABCD-ABCD-ABCED1457822"
    if res_status.status_code == 200:
        status_list = res_status.json()
        for st in status_list:
            if st.get('Name') == 'Habilitado':
                active_id = st.get('StatusTypeID')
            elif st.get('Name') == 'Desabilitado':
                inactive_id = st.get('StatusTypeID')
    print(f"Active StatusID: {active_id}, Inactive StatusID: {inactive_id}")
    
    # 4. Get 25 products
    cursor.execute("""
        SELECT p.*, c.idgrupopos AS category_pos_id, pt.idprodutotipopos AS product_type_pos_id, me.idmedidapos AS measure_pos_id 
        FROM products p 
        LEFT JOIN product_categories c ON p.category_id = c.id 
        LEFT JOIN product_types pt ON p.product_type_id = pt.id 
        LEFT JOIN measures me ON p.measure_id = me.id 
        WHERE p.company_id = 13 
        LIMIT 25
    """)
    products = cursor.fetchall()
    print(f"Loaded {len(products)} products from DB.")
    
    # 5. Format payload
    mapped = []
    for p in products:
        ean = p.get('ean') or ""
        # Format BarCodeJS
        barcodes_list = [{"BarCode": ean}] if ean else []
        while len(barcodes_list) < 5:
            barcodes_list.append({"BarCode": ""})
            
        status_pos_id = p.get('status_pos_id')
        if status_pos_id == "ABCDEABC-ABCD-ABCD-ABCD-ABCED1457822":
            status_pos_id = inactive_id
        else:
            status_pos_id = active_id
            
        # Default fallback GUIDs matching the template
        prod_type_id = p.get('product_type_pos_id') or "55550E77-10D1-40DA-A067-075CB2124577"
        unit_type_id = p.get('measure_pos_id') or "55550E77-10D1-40DA-A067-075CB2124ACC"
        
        item = {
            "Product": {
                "ProductID": p.get('idprodutopos') or "",
                "StatusID": status_pos_id,
                "ProductGroupID": p.get('category_pos_id') or "",
                "ProductTypeID": prod_type_id,
                "UnitTypeID": unit_type_id,
                "Name": str(p.get('name') or "")[:50],
                "NameEng": str(p.get('name') or "")[:50],
                "InternalCode": p.get('sku') or "",
                "BarCode": ean,
                "BarCodeJS": barcodes_list,
                "ImageBase64": "",
                "NFCeNCM": p.get('ncm') or "",
                "NFCeCFOP": "",
                "NFCeCST": "",
                "NFCeAliqICMS": "",
                "NFCeCEST": p.get('cest') or "",
                "NFCeCSTPIS": "",
                "NFCeAliqPIS": "",
                "NFCeCSTCOFINS": "",
                "NFCeAliqCOFINS": "",
                "NFCeCodANP": "",
                "NFCeBaseRedICMS": "",
                "NFCeCodBenef": "",
                "NFCecBenef": "",
                "NFCeMotBenef": "",
                "SalePrice": float(p.get('selling_price') or 0.0),
                "NFCeIBS_CBS_CST": "",
                "NFCeIBS_AliqUF": "",
                "NFCeIBS_AliqMUN": "",
                "NFCeIBS_PercRedBase": ""
            }
        }
        mapped.append(item)
        
    # 6. Send payload to POS-Control
    products_url = "https://api.poscontrole.com.br/v2/products"
    if cfg['subscription_key']:
        products_url = products_url + f"?subscription-key={cfg['subscription_key']}"
        
    headers_post = {
        'Content-Type': 'application/json',
        'Authorization': f"Bearer {jwt}"
    }
    if cfg['ocp_apim_subscription_key']:
        headers_post['Ocp-Apim-Subscription-Key'] = cfg['ocp_apim_subscription_key']
        
    print(f"Sending products to {products_url}...")
    res_post = requests.post(products_url, headers=headers_post, json=mapped)
    print(f"Response status: {res_post.status_code}")
    print("Response headers:", res_post.headers)
    print("Response raw body:")
    print(res_post.text)

if __name__ == '__main__':
    main()
