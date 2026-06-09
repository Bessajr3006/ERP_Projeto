#!/usr/bin/env sh
set -e

DATA_DIR="${DATA_DIR:-/data}"
UPLOADS_DIR="${DATA_DIR}/uploads"
RUNTIME_DIR="${DATA_DIR}/runtime"

DB_HOST="${DB_HOST:-}"
DB_PORT="${DB_PORT:-3306}"
DB_WAIT_TIMEOUT_SECONDS="${DB_WAIT_TIMEOUT_SECONDS:-120}"

mkdir -p "${UPLOADS_DIR}" "${RUNTIME_DIR}"

# uploads
if [ -e /app/public/uploads ] && [ ! -L /app/public/uploads ]; then
  rm -rf /app/public/uploads
fi
ln -snf "${UPLOADS_DIR}" /app/public/uploads

# runtime (whatsapp sessions)
if [ -e /app/.runtime ] && [ ! -L /app/.runtime ]; then
  rm -rf /app/.runtime
fi
ln -snf "${RUNTIME_DIR}" /app/.runtime

# Aguarda DNS e porta do banco para reduzir falhas transitórias EAI_AGAIN no startup.
if [ -n "${DB_HOST}" ] && [ -z "${MYSQL_UNIX_PORT:-}" ]; then
  echo "[entrypoint] aguardando banco em ${DB_HOST}:${DB_PORT} (timeout ${DB_WAIT_TIMEOUT_SECONDS}s)..."
  node -e "
const dns = require('node:dns').promises;
const net = require('node:net');

const host = process.env.DB_HOST;
const port = Number(process.env.DB_PORT || 3306);
const timeoutSeconds = Number(process.env.DB_WAIT_TIMEOUT_SECONDS || 120);
const startedAt = Date.now();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const canConnect = () => new Promise((resolve) => {
  const socket = net.createConnection({ host, port });
  let done = false;
  const finish = (ok) => {
    if (done) return;
    done = true;
    socket.destroy();
    resolve(ok);
  };
  socket.setTimeout(1500);
  socket.once('connect', () => finish(true));
  socket.once('timeout', () => finish(false));
  socket.once('error', () => finish(false));
});

(async () => {
  for (;;) {
    const elapsedSeconds = (Date.now() - startedAt) / 1000;
    if (elapsedSeconds > timeoutSeconds) {
      console.error('[entrypoint] timeout aguardando banco em ' + host + ':' + port);
      process.exit(1);
    }

    try {
      await dns.lookup(host, { family: 4 });
      if (await canConnect()) {
        console.log('[entrypoint] banco disponível em ' + host + ':' + port);
        process.exit(0);
      }
    } catch (_err) {
      // Continua tentando.
    }

    await sleep(1000);
  }
})();
"
fi

exec "$@"
