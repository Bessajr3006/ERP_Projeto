import os
import pty
import sys
import time
import base64

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
    # Load and encode local diag.js
    local_path = os.path.join(os.path.dirname(__file__), 'diag.js')
    with open(local_path, 'rb') as f:
        code_bytes = f.read()
    b64_str = base64.b64encode(code_bytes).decode('ascii')
    
    print("Writing diagnostic JS code inside backend container via base64...")
    # Decode base64 directly into the container's /tmp/diag.js
    run_ssh(f"docker exec -i erp-bessa-backend-1 sh -c 'echo \"{b64_str}\" | base64 -d > /tmp/diag.js'")
    
    print("Executing JS diagnostic code...")
    res = run_ssh("docker exec -i erp-bessa-backend-1 node /tmp/diag.js")
    print(res)
    
    print("Cleaning up...")
    run_ssh("docker exec -i erp-bessa-backend-1 rm /tmp/diag.js")
