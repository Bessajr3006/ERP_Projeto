import os
import pty
import sys
import time

def run_ssh(cmd, password):
    ssh_cmd = ["ssh", "-o", "StrictHostKeyChecking=no", "root@187.77.24.126", cmd]
    
    pid, fd = pty.fork()
    
    if pid == 0:
        os.execvp("ssh", ssh_cmd)
    else:
        output = b""
        password_sent = False
        
        while True:
            try:
                data = os.read(fd, 1024)
                if not data:
                    break
                output += data
                
                if not password_sent and (b"password:" in data.lower() or b"senha:" in data.lower()):
                    time.sleep(0.5)
                    os.write(fd, password.encode() + b"\n")
                    password_sent = True
            except OSError:
                break
                
        _, status = os.waitpid(pid, 0)
        return status, output.decode(errors='ignore')

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 ssh_run.py <command>")
        sys.exit(1)
        
    cmd = sys.argv[1]
    password = "30MariaClara@"
    status, out = run_ssh(cmd, password)
    print(out)
    sys.exit(status)
