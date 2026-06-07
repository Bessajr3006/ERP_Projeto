#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
#  deploy.sh — Envia o projeto para o VPS Hostinger e sobe Docker
#
#  USO:
#    chmod +x deploy.sh
#    ./deploy.sh root@SEU_IP_VPS
#
#  PRÉ-REQUISITOS (local):
#    - SSH configurado (chave ou senha)
#    - rsync instalado (já vem no macOS)
#
#  PRÉ-REQUISITOS (VPS — executado automaticamente na 1ª vez):
#    - Ubuntu/Debian 20.04+
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Configurações ────────────────────────────────────────────────
REMOTE="${1:-}"
REMOTE_DIR="/opt/erp-bessa"
COMPOSE_FILE="docker-compose.yml"
SSH_CONTROL="/tmp/ssh_deploy_$$"

# ── Validação ────────────────────────────────────────────────────
if [[ -z "$REMOTE" ]]; then
    echo "Uso: ./deploy.sh root@SEU_IP_VPS"
    exit 1
fi

if [[ ! -f ".env.production" ]]; then
    echo "ERRO: arquivo .env.production não encontrado."
    echo "Copie .env.production.example para .env.production e preencha os valores."
    exit 1
fi

# ── Opções SSH compartilhadas (pede senha só 1 vez) ──────────────
SSH_OPTS="-o StrictHostKeyChecking=no -o ControlMaster=auto -o ControlPath=${SSH_CONTROL} -o ControlPersist=300"

# Limpa socket de controle ao sair
cleanup() { ssh -O exit -o ControlPath="${SSH_CONTROL}" "$REMOTE" 2>/dev/null || true; }
trap cleanup EXIT

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Deploy ERP Bessa → $REMOTE:$REMOTE_DIR"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  → Conectando ao VPS (digite a senha uma vez)..."
# Abre a conexão mestra — pede senha aqui
ssh $SSH_OPTS "$REMOTE" "echo '  → Conectado!'"

# ── 1. Instalar Docker no VPS (só se não existir) ────────────────
echo ""
echo "▶ [1/4] Verificando Docker no VPS..."
ssh $SSH_OPTS "$REMOTE" bash << 'ENDSSH'
if ! command -v docker &>/dev/null; then
    echo "  → Instalando Docker (pode demorar 2-3 min)..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo "  → Docker instalado com sucesso."
else
    echo "  → Docker já instalado: $(docker --version)"
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

rsync -az --delete \
    -e "ssh $SSH_OPTS" \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='.env*' \
    --exclude='public/uploads' \
    . "$REMOTE:$REMOTE_DIR"

echo "  → Enviando .env.production..."
scp -o StrictHostKeyChecking=no -o ControlPath="${SSH_CONTROL}" \
    .env.production "$REMOTE:$REMOTE_DIR/.env.production"

echo "  → Arquivos enviados."

# ── 4. Configurar firewall ────────────────────────────────────────
echo ""
echo "▶ [4/5] Configurando firewall (ufw)..."
ssh $SSH_OPTS "$REMOTE" bash << 'ENDSSH'
if command -v ufw &>/dev/null; then
    ufw --force enable
    ufw allow ssh
    ufw allow 80/tcp
    ufw allow 443/tcp
    echo "  → Firewall configurado."
else
    echo "  → ufw não encontrado, pulando..."
fi
ENDSSH

# ── 5. Subir Docker Compose ───────────────────────────────────────
echo ""
echo "▶ [5/5] Subindo containers no VPS (pode demorar na 1ª vez)..."
ssh $SSH_OPTS "$REMOTE" bash << ENDSSH
cd $REMOTE_DIR

# Para containers antigos para evitar conflito de build
docker compose -f $COMPOSE_FILE down --remove-orphans 2>/dev/null || true

# Build e sobe todos os serviços
docker compose -f $COMPOSE_FILE up -d --build

echo ""
echo "  → Status dos containers:"
docker compose -f $COMPOSE_FILE ps
ENDSSH

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✓ Deploy concluído!"
echo "  Acesse: http://$(echo $REMOTE | cut -d@ -f2)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
