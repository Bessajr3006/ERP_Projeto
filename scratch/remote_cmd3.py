import os
import pty
import sys
import time

def run_remote_cmd(cmd_str, password):
    cmd = ["ssh", "root@187.77.24.126", cmd_str]
    
    pid, fd = pty.fork()
    
    if pid == 0:
        os.execvp("ssh", cmd)
    else:
        output = b""
        password_attempts = 0
        max_password_attempts = 5
        
        while True:
            try:
                data = os.read(fd, 1024)
                if not data:
                    break
                sys.stdout.buffer.write(data)
                sys.stdout.flush()
                output += data
                
                if (b"password:" in data.lower() or b"senha:" in data.lower()) and password_attempts < max_password_attempts:
                    time.sleep(0.5)
                    os.write(fd, password.encode() + b"\n")
                    password_attempts += 1
            except OSError:
                break
                
        _, status = os.waitpid(pid, 0)
        return status

if __name__ == "__main__":
    password = "30Simoneamor@"
    status = run_remote_cmd('docker logs erp-bessa-backend-1 2>&1 | grep -i -E "categorias|productgroup|Mapeando item de categoria|Resultado do update da categoria"', password)
    sys.exit(status)
