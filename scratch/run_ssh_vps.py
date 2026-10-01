import os
import pty
import sys
import time

def run_ssh(cmd_str):
    cmd = ["ssh", "-o", "StrictHostKeyChecking=no", "root@187.77.24.126", cmd_str]
    pid, fd = pty.fork()
    if pid == 0:
        os.execvp("ssh", cmd)
    else:
        output = b""
        password = "30Simoneamor@"
        password_sent = False
        while True:
            try:
                data = os.read(fd, 1024)
                if not data:
                    break
                sys.stdout.buffer.write(data)
                sys.stdout.flush()
                output += data
                if (b"password:" in data.lower() or b"senha:" in data.lower()) and not password_sent:
                    time.sleep(0.5)
                    os.write(fd, password.encode() + b"\n")
                    password_sent = True
            except OSError:
                break
        os.waitpid(pid, 0)
        return output

if __name__ == "__main__":
    if len(sys.argv) > 1:
        run_ssh(sys.argv[1])
    else:
        run_ssh("docker ps")
