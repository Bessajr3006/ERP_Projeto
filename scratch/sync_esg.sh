#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
PASS=$(cat "$DIR/askpass.sh" | grep -v '^#' | sed 's/echo "//;s/"//' | tr -d '\r\n')
export PASS

/usr/bin/expect << 'EOF'
set timeout 90
set pass $env(PASS)
spawn ssh -o StrictHostKeyChecking=no root@187.77.24.126 "docker exec -i erp-bessa-backend-1 node -e \"const { FinanceService } = require('./dist/services/financeService'); FinanceService.syncAllRevenuesAndSolidcon(12, 1, { startDate: '2026-09-01', endDate: '2026-09-30' }).then(r => { console.log('Sync result:', r); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });\""

expect {
    -nocase "password:" {
        send "$pass\r"
        exp_continue
    }
    eof
}
EOF
