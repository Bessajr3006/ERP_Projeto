import os
import pty
import sys
import time

DIAG_CODE = """
import sys
import requests
import pymysql

def main():
    db = pymysql.connect(
        host="127.0.0.1",
        user="erp_user",
        password="30mariafn@",
        database="bessa_erp",
        port=3306
    )
    cursor = db.cursor(pymysql.cursors.DictCursor)
    cursor.execute("SELECT * FROM company_poscontrol_configs WHERE company_id = 13 LIMIT 1")
    cfg = cursor.fetchone()
    if not cfg:
        print("Config not found")
        return
        
    print(f"Config found: username={cfg['poscontrol_username']}")
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
        print("No JWT token found")
        return
        
    status_url = "https://api.poscontrole.com.br/v2/statustypes"
    if cfg['subscription_key']:
        status_url = status_url + f"?subscription-key={cfg['subscription_key']}"
        
    headers_jwt = {
        'Authorization': f"Bearer {jwt}"
    }
    if cfg['ocp_apim_subscription_key']:
        headers_jwt['Ocp-Apim-Subscription-Key'] = cfg['ocp_apim_subscription_key']
        
    res_status = requests.get(status_url, headers=headers_jwt)
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
    
    # Get products
    cursor.execute(\"\"\"
        SELECT p.*, c.idgrupopos AS category_pos_id, pt.idprodutotipopos AS product_type_pos_id, me.idmedidapos AS measure_pos_id 
        FROM products p 
        LEFT JOIN product_categories c ON p.category_id = c.id 
        LEFT JOIN product_types pt ON p.product_type_id = pt.id 
        LEFT JOIN measures me ON p.measure_id = me.id 
        WHERE p.company_id = 13 
        LIMIT 25
    \"\"\")
    products = cursor.fetchall()
    print(f"Loaded {len(products)} products from DB.")
    
    mapped = []
    for p in products:
        ean = p.get('ean') or ""
        barcodes_list = [{"BarCode": ean}] if ean else []
        while len(barcodes_list) < 5:
            barcodes_list.append({"BarCode": ""})
            
        status_pos_id = p.get('status_pos_id')
        if status_pos_id == "ABCDEABC-ABCD-ABCD-ABCD-ABCED1457822":
            status_pos_id = inactive_id
        else:
            status_pos_id = active_id
            
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
        
    products_url = "https://api.poscontrole.com.br/v2/products"
    if cfg['subscription_key']:
        products_url = products_url + f"?subscription-key={cfg['subscription_key']}"
        
    headers_post = {
        'Content-Type': 'application/json',
        'Authorization': f"Bearer {jwt}"
    }
    if cfg['ocp_apim_subscription_key']:
        headers_post['Ocp-Apim-Subscription-Key'] = cfg['ocp_apim_subscription_key']
        
    print(f"Sending products...")
    res_post = requests.post(products_url, headers=headers_post, json=mapped)
    print(f"Response status: {res_post.status_code}")
    print("Response raw body:")
    print(res_post.text)

if __name__ == '__main__':
    main()
"""

def run_ssh(cmd_str):
    cmd = ["ssh", "-o", "StrictHostKeyChecking=no", "root@187.77.24.126", cmd_str]
    pid, fd = pty.fork()
    if pid == 0:
        os.execvp("ssh", cmd)
    else:
        password = "30Simoneamor@\n"
        sent_password = False
        output = b""
        while True:
            try:
                data = os.read(fd, 1024)
                if not data:
                    break
                output += data
                if b"password:" in data.lower() and not sent_password:
                    time.sleep(0.5)
                    os.write(fd, password.encode())
                    sent_password = True
            except OSError:
                break
        os.waitpid(pid, 0)
        return output.decode('utf-8', errors='ignore')

if __name__ == '__main__':
    print("Installing packages on VPS host...")
    run_ssh("pip3 install requests pymysql")
    
    print("Writing diagnostic code to VPS...")
    # Escape quotes and $ for bash heredoc
    escaped_code = DIAG_CODE.replace('$', '\\$').replace('`', '\\`')
    run_ssh(f"cat << 'EOF' > /tmp/diag.py\n{escaped_code}\nEOF")
    
    print("Executing diagnostic code on VPS...")
    # Run inside host so it connects to local MariaDB docker port (port 3306 on 127.0.0.1)
    res = run_ssh("python3 /tmp/diag.py")
    print(res)
    
    print("Cleaning up...")
    run_ssh("rm /tmp/diag.py")
