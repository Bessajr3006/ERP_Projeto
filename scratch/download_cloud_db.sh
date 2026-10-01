#!/usr/bin/env bash
set -e

# Configurações VPS e Local
VPS_HOST="root@187.77.24.126"
REMOTE_CONTAINER="erp-bessa-db-1"
REMOTE_DB="bessa_erp"
REMOTE_USER="root"
REMOTE_PASS="30mariafn@"

LOCAL_CONTAINER="projeto_erp_bessa-db-1"
LOCAL_DB="bessa_erp"
LOCAL_USER="erp_user"
LOCAL_PASS="ERPBessa!Db2026@Safe"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ASKPASS="$SCRIPT_DIR/askpass.sh"
DUMP_FILE="$SCRIPT_DIR/bessa_erp_cloud_dump.sql.gz"
BACKUP_LOCAL="$SCRIPT_DIR/local_backup_$(date +%Y%m%d_%H%M%S).sql.gz"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Download do Banco de Dados da Nuvem → Docker Local"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

export DISPLAY=d:0
export SSH_ASKPASS_REQUIRE=force
export SSH_ASKPASS="$ASKPASS"
chmod +x "$ASKPASS"

echo "▶ [1/5] Gerando dump compactado no VPS ($VPS_HOST)..."
ssh -o StrictHostKeyChecking=no "$VPS_HOST" "docker exec $REMOTE_CONTAINER mariadb-dump -u $REMOTE_USER -p$REMOTE_PASS --single-transaction --quick --routines --triggers $REMOTE_DB | gzip > /tmp/bessa_erp_cloud_dump.sql.gz"

echo "▶ [2/5] Baixando dump do VPS para máquina local..."
scp -o StrictHostKeyChecking=no "$VPS_HOST":/tmp/bessa_erp_cloud_dump.sql.gz "$DUMP_FILE"

echo "▶ [3/5] Fazendo backup do banco local antes de restaurar..."
docker exec "$LOCAL_CONTAINER" mariadb-dump -u "$LOCAL_USER" -p"$LOCAL_PASS" --single-transaction --quick "$LOCAL_DB" | gzip > "$BACKUP_LOCAL" 2>/dev/null || true
echo "  → Backup local salvo em: $BACKUP_LOCAL"

echo "▶ [4/5] Restaurando dump da nuvem no Docker local ($LOCAL_CONTAINER)..."
gunzip -c "$DUMP_FILE" | docker exec -i "$LOCAL_CONTAINER" mariadb -u "$LOCAL_USER" -p"$LOCAL_PASS" "$LOCAL_DB"

echo "▶ [5/5] Executando migrações locais pendentes (initdb)..."
cd "$SCRIPT_DIR/.."
npm run initdb

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✓ Banco de dados da nuvem sincronizado com sucesso no Docker local!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
