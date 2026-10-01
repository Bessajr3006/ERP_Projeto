import sys
import pty
import os
import time

def run_ssh(cmd_list):
    pid, fd = pty.fork()
    if pid == 0:
        os.execvp("ssh", ["ssh", "root@187.77.24.126"] + cmd_list)
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
                if b"password:" in data.lower() and not password_sent:
                    time.sleep(0.5)
                    os.write(fd, password.encode() + b"\n")
                    password_sent = True
            except OSError:
                break
        _, status = os.waitpid(pid, 0)
        return status

if __name__ == "__main__":
    run_ssh(sys.argv[1:])
