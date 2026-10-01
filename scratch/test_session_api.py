import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

login_data = json.dumps({"email": "bessa@aporttec.com", "passwordRaw": "301008"}).encode("utf-8")
req_login = urllib.request.Request(
    "https://erp.keystones.dev/api/v1/auth/login",
    data=login_data,
    headers={"Content-Type": "application/json"}
)

try:
    with urllib.request.urlopen(req_login, context=ctx) as response:
        login_res = json.loads(response.read().decode())
        token = login_res.get("data", {}).get("token") or login_res.get("token")
        print("Login success, token retrieved.")
        
        # Now fetch session status
        req_session = urllib.request.Request(
            "https://erp.keystones.dev/api/v1/users/c34443f9-90b4-4be4-b640-62e0dd934a7c/whatsapp-business/session",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
        )
        
        with urllib.request.urlopen(req_session, context=ctx) as response2:
            print("Response Status:", response2.status)
            print("Response Body:", response2.read().decode())
            
except Exception as e:
    print("Error:", e)
    if hasattr(e, "read"):
        print("Error Body:", e.read().decode())
