import os
import pty
import sys
import time

def run_cmd():
    # SCP local scratch_query_external.js to VPS /tmp/
    os.system("scp -o StrictHostKeyChecking=no scratch_query_external.js root@187.77.24.126:/tmp/scratch_query_external.js")
    
    # Run interactive SSH command to copy it into container /app/ and execute it
    sql_cmd = (
        "docker cp /tmp/scratch_query_external.js erp-bessa-backend-1:/app/scratch_query_external.js && "
        "docker exec -i erp-bessa-backend-1 node /app/scratch_query_external.js"
    )
    cmd = ["ssh", "-o", "StrictHostKeyChecking=no", "root@187.77.24.126", sql_cmd]
    
    pid, fd = pty.fork()
    if pid == 0:
        os.execvp("ssh", cmd)
    else:
        password = "30Simoneamor@\n"
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
