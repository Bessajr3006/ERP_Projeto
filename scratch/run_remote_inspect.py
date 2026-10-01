import os
import pty
import sys
import time

def run_remote_inspect(password):
    scp_cmd = ["scp", "-o", "StrictHostKeyChecking=no", "scratch/test_service_output.ts", "root@187.77.24.126:/tmp/test_service_output.ts"]
    print("Enviando script...")
    run_with_pty(scp_cmd, password)
    
    ssh_cmd = ["ssh", "-o", "StrictHostKeyChecking=no", "root@187.77.24.126", "cd /opt/erp-bessa && docker cp /tmp/test_service_output.ts $(docker compose ps -q backend):/app/test_service_output.ts && docker compose exec -T backend npx tsx /app/test_service_output.ts"]
    print("\nExecutando script no servidor...")
    return run_with_pty(ssh_cmd, password)

def run_with_pty(cmd, password):
    pid, fd = pty.fork()
    if pid == 0:
        os.execvp(cmd[0], cmd)
    else:
        password_sent = False
        while True:
            try:
                data = os.read(fd, 1024)
                if not data:
                    break
                sys.stdout.buffer.write(data)
                sys.stdout.flush()
                
                if not password_sent and (b"password:" in data.lower() or b"senha:" in data.lower()):
                    time.sleep(0.5)
                    os.write(fd, password.encode() + b"\n")
                    password_sent = True
            except OSError:
                break
        _, status = os.waitpid(pid, 0)
        return status

if __name__ == "__main__":
    password = "30Simoneamor@"
    status = run_remote_inspect(password)
    sys.exit(status)
