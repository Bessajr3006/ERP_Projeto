#!/usr/bin/env bash
# =============================================================================
# install-node-local.sh
# Baixa e instala o Node.js v22 LTS dentro da pasta .node/ do projeto.
# Não precisa de sudo, brew ou instalação global.
#
# Execute UMA VEZ no terminal do VS Code:
#   bash install-node-local.sh
# =============================================================================

set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_DIR="$DIR/.node"
NODE_VERSION="22.14.0"
ARCH="$(uname -m)"

# Detecta arquitetura
if [ "$ARCH" = "arm64" ]; then
    PLATFORM="darwin-arm64"
else
    PLATFORM="darwin-x64"
fi

TARBALL="node-v${NODE_VERSION}-${PLATFORM}.tar.gz"
URL="https://nodejs.org/dist/v${NODE_VERSION}/${TARBALL}"

echo "═══════════════════════════════════════════════════"
echo "  Instalando Node.js v${NODE_VERSION} (${PLATFORM})"
echo "  Destino: $NODE_DIR"
echo "═══════════════════════════════════════════════════"
echo ""

# Remove instalação anterior se existir
if [ -d "$NODE_DIR" ]; then
    echo "🗑  Removendo versão anterior..."
    rm -rf "$NODE_DIR"
fi

# Baixa o tarball
echo "⬇️  Baixando $URL ..."
curl -fsSL "$URL" -o "/tmp/$TARBALL"
echo "✅ Download concluído"
echo ""

# Extrai na pasta .node/
echo "📦 Extraindo..."
mkdir -p "$NODE_DIR"
tar -xzf "/tmp/$TARBALL" -C "$NODE_DIR" --strip-components=1
rm -f "/tmp/$TARBALL"
echo "✅ Extração concluída"
echo ""

# Verifica
NODE_BIN="$NODE_DIR/bin/node"
NPM_BIN="$NODE_DIR/bin/npm"

echo "Versões instaladas:"
echo "  node: $("$NODE_BIN" --version)"
echo "  npm:  $("$NPM_BIN" --version)"
echo ""

# Adiciona ao PATH desta sessão e instala dependências
export PATH="$NODE_DIR/bin:$PATH"

echo "📦 Instalando dependências do projeto (npm install)..."
cd "$DIR"
npm install
echo ""

echo "═══════════════════════════════════════════════════"
echo "✅ PRONTO! Node.js instalado localmente."
echo ""
echo "Para usar nesta sessão do terminal, execute:"
echo "  export PATH=\"$NODE_DIR/bin:\$PATH\""
echo ""
echo "Para SEMPRE ter disponível, adicione ao ~/.zshrc:"
echo "  echo 'export PATH=\"$NODE_DIR/bin:\$PATH\"' >> ~/.zshrc"
echo "  source ~/.zshrc"
echo ""
echo "Depois use normalmente:"
echo "  npm run test:unit"
echo "  npm run test:integration"
echo "  npm run dev"
echo "═══════════════════════════════════════════════════"
