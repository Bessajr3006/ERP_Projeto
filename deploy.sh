#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
#  deploy.sh — Envia o projeto para o VPS e sobe Docker via SSH
#
#  USO:
#    chmod +x deploy.sh
#    ./deploy.sh deploy@SEU_IP_VPS
#    # Ou especificando chave SSH:
#    SSH_KEY=~/.ssh/deploy_key ./deploy.sh deploy@SEU_IP_VPS
#
#  PRÉ-REQUISITOS (local):
#    - Autenticação por chave SSH configurada
#    - rsync / tar instalado
#
#  PRÉ-REQUISITOS (VPS):
#    - Usuário dedicado de deploy pertencente ao grupo docker / sudo
#    - Chave pública autorizada em ~/.ssh/authorized_keys
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Configurações ────────────────────────────────────────────────
REMOTE="${1:-}"
REMOTE_DIR="/opt/erp-bessa"
COMPOSE_FILE="docker-compose.yml"
SSH_CONTROL="/tmp/ssh_deploy_bessa"
SSH_KEY="${SSH_KEY:-}"

# ── Validação ────────────────────────────────────────────────────
if [[ -z "$REMOTE" ]]; then
    echo "Uso: ./deploy.sh deploy@SEU_IP_VPS"
    echo "Exemplo: SSH_KEY=~/.ssh/id_ed25519 ./deploy.sh deploy@192.168.1.100"
    exit 1
fi

if [[ "$REMOTE" =~ ^root@ ]]; then
    echo "AVISO DE SEGURANÇA: O uso do usuário 'root' direto via SSH não é recomendado."
    echo "Recomendado utilizar um usuário dedicado de deploy (ex: deploy@SEU_IP_VPS)."
fi

if [[ ! -f ".env.production" ]]; then
    echo "ERRO: arquivo .env.production não encontrado."
    echo "Copie .env.production.example para .env.production e preencha os valores."
    exit 1
fi

# ── Opções SSH seguras com autenticação por chave ───────────────
SSH_KEY_OPT=""
if [[ -n "$SSH_KEY" && -f "$SSH_KEY" ]]; then
    SSH_KEY_OPT="-i $SSH_KEY"
fi

SSH_OPTS="$SSH_KEY_OPT -o ControlMaster=auto -o ControlPath=${SSH_CONTROL} -o ControlPersist=300"
SCP_OPTS="$SSH_KEY_OPT -o ControlPath=${SSH_CONTROL}"

# Limpa socket de controle ao sair
cleanup() { ssh -O exit -o ControlPath="${SSH_CONTROL}" "$REMOTE" 2>/dev/null || true; }
trap cleanup EXIT

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Deploy ERP Bessa → $REMOTE:$REMOTE_DIR"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  → Estabelecendo conexão segura via chave SSH..."
ssh $SSH_OPTS "$REMOTE" "echo '  → Conectado com sucesso como \$(whoami)!'"

# ── 1. Verificar Docker no VPS ──────────────────────────────────
echo ""
echo "▶ [1/5] Verificando ambiente Docker no VPS..."
ssh $SSH_OPTS "$REMOTE" bash << 'ENDSSH'
if ! command -v docker &>/dev/null; then
    echo "  → Docker não encontrado. Certifique-se de que o Docker esteja instalado e o usuário pertença ao grupo docker."
    exit 1
else
    echo "  → Docker verificado: $(docker --version)"
fi
ENDSSH

# ── 2. Atualizar versão do build (footer/PWA) ─────────────────────
echo ""
echo "▶ [2/5] Atualizando versão do sistema (build.json + sw cache)..."
npm run --silent bump:build-version

# ── 3. Sincronizar arquivos ───────────────────────────────────────
echo ""
echo "▶ [3/5] Enviando arquivos para o VPS..."
ssh $SSH_OPTS "$REMOTE" "mkdir -p $REMOTE_DIR"

echo "  → Transmitindo arquivos compactados..."
COPYFILE_DISABLE=1 tar \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='.env*' \
    --exclude='public/uploads' \
    --exclude='.gemini' \
    --exclude='.agents' \
    --exclude='.wwebjs_cache' \
    --exclude='.node' \
    --exclude='.runtime' \
    --exclude='*.log' \
    --exclude='*.webp' \
    -czf - . | ssh $SSH_OPTS "$REMOTE" "tar -xzf - -C $REMOTE_DIR"

echo "  → Enviando .env.production..."
scp $SCP_OPTS .env.production "$REMOTE:$REMOTE_DIR/.env.production"

echo "  → Arquivos enviados."

# ── 4. Configurar firewall ────────────────────────────────────────
echo ""
echo "▶ [4/5] Verificando regras de firewall..."
ssh $SSH_OPTS "$REMOTE" bash << 'ENDSSH'
if command -v ufw &>/dev/null && [ "$(id -u)" -eq 0 ]; then
    ufw --force enable
    ufw allow ssh
    ufw allow 80/tcp
    ufw allow 443/tcp
    echo "  → Firewall configurado via UFW."
else
    echo "  → UFW já configurado ou gerenciado a nível de infraestrutura/cloud."
fi
ENDSSH

# ── 5. Subir Docker Compose ───────────────────────────────────────
echo ""
echo "▶ [5/5] Subindo containers no VPS..."
ssh $SSH_OPTS "$REMOTE" bash << 'ENDSSH'
cd /opt/erp-bessa

# Build das novas imagens com multi-stage e usuário não-root
docker compose -f docker-compose.yml build

# Atualiza e sobe os containers com recriação garantida
docker compose -f docker-compose.yml up -d --force-recreate --remove-orphans

echo ""
echo "  → Executando migrações de banco de dados..."
docker compose -f docker-compose.yml exec -T backend node dist/scripts/initdb.js || true

echo ""
echo "  → Status dos containers:"
docker compose -f docker-compose.yml ps
ENDSSH

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✓ Deploy concluído!"
echo "  Acesse: http://$(echo $REMOTE | cut -d@ -f2)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
