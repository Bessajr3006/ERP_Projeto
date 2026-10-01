import os
import pty
import sys
import time

def run_query(sql_str):
    escaped_sql = sql_str.replace('"', '\\"')
    cmd = ["ssh", "-o", "StrictHostKeyChecking=no", "root@187.77.24.126", f"docker exec -i erp-bessa-db-1 mariadb -u erp_user -p30mariafn@ bessa_erp -e \"{escaped_sql}\""]
    
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
    sql = sys.argv[1] if len(sys.argv) > 1 else "SELECT version();"
    print(run_query(sql))
