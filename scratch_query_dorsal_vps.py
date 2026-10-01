import os
import pty
import sys
import time

def run_cmd():
    js_code = """
const sql = require('mssql');
const config = {
    server: 'n13884.ddns.net',
    port: 1433,
    database: 'dorsal',
    user: 'aporttec',
    password: '30mariafn@',
    options: {
        encrypt: false,
        trustServerCertificate: true
    },
    connectionTimeout: 15000,
    requestTimeout: 20000
};

async function run() {
    try {
        console.log('Connecting to Dorsal DB...');
        const pool = await sql.connect(config);
        const query = `
            SELECT TOP 5
                tbCupom.dtCupom,
                tbCupomItem.qtItem,
                tbCliente.Nome as Cliente,
                tbCupomItem.vlItem as valorUnitario,
                (tbCupomItem.vlItem * tbCupomItem.qtItem - ISNULL(tbCupomItem.vlDesconto, 0)) as valorTotal,
                (tbSuperProduto.vlCusto * ISNULL(tbProduto.nrMultiplicador, 1) * tbCupomItem.qtItem) as valorCustoDia,
                (ISNULL(tbCupomItem.vlCusto, 0) * ISNULL(tbProduto.nrMultiplicador, 1) * tbCupomItem.qtItem) as valorCustoVenda,
                tbOperador.nmOperador as Operador
            FROM tbCupomItem
            INNER JOIN tbCupom ON tbCupomItem.gdCupom = tbCupom.gdCupom
            LEFT OUTER JOIN tbProduto ON tbProduto.cdEmpresa = tbCupom.cdEmpresa
                                     AND tbProduto.cdFilial = tbCupom.cdFilial
                                     AND tbProduto.cdProduto = tbCupomItem.cdProduto
            LEFT OUTER JOIN tbSuperProduto ON tbSuperProduto.cdEmpresa = tbProduto.cdEmpresa
                                         AND tbSuperProduto.cdSuperProduto = tbProduto.cdSuperProduto
            LEFT OUTER JOIN tbCliente ON tbCupom.cdCliente = tbCliente.cdCliente
            LEFT OUTER JOIN tbOperador ON tbCupom.cdOperador = tbOperador.cdOperador 
                                    AND tbCupom.cdEmpresa = tbOperador.cdEmpresa
                                    AND tbCupom.cdFilial = tbOperador.cdFilial
            WHERE tbCupom.cdEmpresa = 10
        `;
        const res = await pool.request().query(query);
        console.log('Detail rows with costs:', res.recordset);
        await pool.close();
    } catch (e) {
        console.error('Query Error:', e);
    }
}
run();
"""
    escaped_js = js_code.replace('"', '\\"').replace('$', '\\$').replace('`', '\\`')
    cmd = ["ssh", "-o", "StrictHostKeyChecking=no", "root@187.77.24.126", f"docker exec -i erp-bessa-backend-1 node -e \"{escaped_js}\""]
    
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
