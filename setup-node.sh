#!/usr/bin/env bash
# =============================================================================
# setup-node.sh — Verifica e corrige a instalação do Node/npm
# Execute no terminal do VS Code: bash setup-node.sh
# =============================================================================

echo "🔍 Verificando ambiente Node.js..."
echo ""

# Verifica node
if command -v node &>/dev/null; then
    echo "✅ node: $(which node) — $(node --version)"
else
    echo "❌ node: não encontrado no PATH"
fi

# Verifica npm
if command -v npm &>/dev/null; then
    echo "✅ npm:  $(which npm) — v$(npm --version)"
else
    echo "❌ npm: não encontrado"
    echo ""

    # Tenta symlink de node para rodar npm-cli.js
    NODE_BIN=$(which node 2>/dev/null || echo "")
    if [ -n "$NODE_BIN" ]; then
        NPM_CLI=$(dirname "$NODE_BIN")/../lib/node_modules/npm/bin/npm-cli.js
        if [ -f "$NPM_CLI" ]; then
            echo "   ⚠️  npm-cli.js encontrado em: $NPM_CLI"
            echo "   Execute: sudo ln -sf \"$NPM_CLI\" /usr/local/bin/npm"
        fi
    fi

    echo ""
    echo "💡 Para instalar o Node.js + npm corretamente:"
    echo "   1. Baixe em: https://nodejs.org (versão LTS)"
    echo "   2. Ou via Homebrew: brew install node"
fi

echo ""
echo "─────────────────────────────────────────────────────"
echo "PATH atual:"
echo "$PATH" | tr ':' '\n' | grep -v "^$"
echo ""

# Testa se consegue rodar o jest local
JEST="$(dirname "$0")/node_modules/.bin/jest"
NODE_LOCAL="$(dirname "$0")/node_modules/.bin/node"

if [ -f "$NODE_LOCAL" ] && [ -f "$JEST" ]; then
    echo "✅ node local: $NODE_LOCAL — $($NODE_LOCAL --version)"
    echo "✅ jest local: $JEST"
    echo ""
    echo "▶  Para rodar os testes, use:"
    echo "   ./test.sh unit         → unitários (sem rede)"
    echo "   ./test.sh int          → integração (com rede)"
    echo "   ./test.sh              → todos"
fi
