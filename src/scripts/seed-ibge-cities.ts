/**
 * seed-ibge-cities.ts
 *
 * Busca todos os municípios do IBGE via API pública e insere na tabela ibge_cities.
 * Uso: npx tsx src/scripts/seed-ibge-cities.ts
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';

const DB_CONFIG = {
  host    : process.env.DB_HOST     ?? '127.0.0.1',
  port    : Number(process.env.DB_PORT ?? 3306),
  user    : process.env.DB_USER     ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME     ?? 'bessa_erp',
};

const IBGE_API = 'https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome';

interface IBGECity {
  id: number;
  nome: string;
  'regiao-imediata': { 'regiao-intermediaria': { UF: { id: number } } } | null;
  microrregiao: { mesorregiao: { UF: { id: number } } } | null;
}

function getStateId(c: IBGECity): number | null {
  return (
    c['regiao-imediata']?.['regiao-intermediaria']?.UF?.id ??
    c.microrregiao?.mesorregiao?.UF?.id ??
    null
  );
}

async function main() {
  console.log('🌐 Buscando municípios na API do IBGE...');
  const res = await fetch(IBGE_API);
  if (!res.ok) throw new Error(`API IBGE retornou ${res.status}`);
  const cities = (await res.json()) as IBGECity[];
  console.log(`✅ ${cities.length} municípios recebidos.`);

  const valid = cities.filter(c => getStateId(c) !== null);
  const skipped = cities.length - valid.length;
  if (skipped > 0) console.warn(`⚠️  ${skipped} município(s) ignorado(s) sem UF.`);

  const conn = await mysql.createConnection(DB_CONFIG);
  console.log('🔌 Conectado ao banco de dados.');

  const BATCH = 500;
  let inserted = 0;

  for (let i = 0; i < valid.length; i += BATCH) {
    const slice = valid.slice(i, i + BATCH);
    const values = slice.map(c => [c.id, getStateId(c), c.nome]);
    await conn.query(`INSERT IGNORE INTO ibge_cities (id, state_id, name) VALUES ?`, [values]);
    inserted += slice.length;
    process.stdout.write(`\r  → ${inserted}/${valid.length} inseridos...`);
  }

  console.log('\n🎉 Seed concluído com sucesso!');
  await conn.end();
}

main().catch(err => {
  console.error('\n❌ Erro:', err);
  process.exit(1);
});
