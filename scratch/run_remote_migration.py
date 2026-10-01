import os
import pty
import sys
import time

def run_cmd(password):
    cmd = ["ssh", "-o", "StrictHostKeyChecking=no", "root@187.77.24.126", "cd /opt/erp-bessa && docker compose exec -T backend node -e \"require('./dist/scripts/run_migration_227_expand_declaration_types_tax_regime').runMigration227ExpandDeclarationTypesTaxRegime().then(() => process.exit(0))\""]
    
    pid, fd = pty.fork()
    
    if pid == 0:
        os.execvp("ssh", cmd)
    else:
        output = b""
        password_sent = False
        
        while True:
            try:
                data = os.read(fd, 1024)
                if not data:
                    break
                sys.stdout.buffer.write(data)
                sys.stdout.flush()
                output += data
                
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
    status = run_cmd(password)
    sys.exit(status)
