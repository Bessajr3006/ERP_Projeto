const sql = require('mssql');
const mysql = require('mysql2/promise');

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'db',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'bessa2026',
    database: process.env.DB_NAME || 'projeto_erp_bessa'
  });

  const [companies] = await pool.query('SELECT serv_solidcon, bd_solidcon, login_solidcon, senha_solidcon FROM companies WHERE id = 12');
  const comp = companies[0];
  const parts = comp.serv_solidcon.split(',');
  const cfg = {
    user: comp.login_solidcon,
    password: comp.senha_solidcon,
    database: comp.bd_solidcon,
    server: parts[0].trim(),
    port: parseInt(parts[1] || '1433', 10),
    options: { encrypt: false, trustServerCertificate: true }
  };
  const conn = await sql.connect(cfg);
  const q = await conn.request().query(
    "SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME IN ('tbConta', 'tbContaBaixa', 'tbContaParcela', 'tbBancoContaMovimento') ORDER BY TABLE_NAME, ORDINAL_POSITION"
  );
  console.log(JSON.stringify(q.recordset, null, 2));
  await conn.close();
  await pool.end();
}
main().catch(console.error);
