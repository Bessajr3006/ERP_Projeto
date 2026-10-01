import os
import pty
import sys
import time

def run_cmd():
    sql = "SELECT company_id, COUNT(*) as total_customers FROM customers GROUP BY company_id;"
    cmd = ["ssh", "-o", "StrictHostKeyChecking=no", "root@187.77.24.126", f"docker exec -i erp-bessa-db-1 mariadb -u erp_user -p30mariafn@ bessa_erp -e \"{sql}\""]
    
    pid, fd = pty.fork()
    if pid == 0:
        os.execvp("ssh", cmd)
    else:
        password = "30MariaClara@\n"
        sent_password = False
        while True:
            try:
                data = os.read(fd, 1024)
                if not data:
                    break
                sys.stdout.buffer.write(data)
                sys.stdout.flush()
                if b"password:" in data.lower() and not sent_password:
                    time.sleep(0.5)
                    os.write(fd, password.encode())
                    sent_password = True
            except OSError:
                break

if __name__ == '__main__':
    run_cmd()
