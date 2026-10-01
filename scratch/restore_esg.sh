#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
PASS=$(cat "$DIR/askpass.sh" | grep -v '^#' | sed 's/echo "//;s/"//' | tr -d '\r\n')
export PASS

/usr/bin/expect << 'EOF'
set timeout 30
set pass $env(PASS)
spawn ssh -o StrictHostKeyChecking=no root@187.77.24.126 "docker exec -i erp-bessa-db-1 mariadb -u erp_user -p301008FN@ bessa_erp"

expect {
    -nocase "password:" {
        send "$pass\r"
        exp_continue
    }
    -nocase "MariaDB" {
        send "UPDATE companies SET serv_solidcon = 'n13884.ddns.net', bd_solidcon = 'solidcon', login_solidcon = 'aporttec', senha_solidcon = '30mariafn@', serv_dorsal = 'n13884.ddns.net', bd_dorsal = 'dorsal', login_dorsal = 'aporttec', senha_dorsal = '30mariafn@', show_solidcon = 1, cdfilial = '1', cdpdv = '1,2', solidcon_url_1 = 'http://n13884.ddns.net:5100/api/Produto/GetProdutos?ativo=true&estoque=true', solidcon_url_2 = 'http://n13884.ddns.net:5100/api/Cliente/GetClientes' WHERE id = 12;\r"
        send "exit\r"
        exp_continue
    }
    eof
}
EOF
