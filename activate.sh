#!/usr/bin/env zsh
# activate.sh — Ativa o Node.js local do projeto na sessão atual
# 
# USO: source activate.sh
#
export PATH="/Users/bessa/Projeto_Erp_Bessa/.node/bin:$PATH"
echo "✅ Node.js $(node --version) / npm $(npm --version) ativados nesta sessão"
echo ""
echo "Agora use normalmente:"
echo "  npm run dev"
echo "  npm run test:unit"
echo "  npm run test:integration"
