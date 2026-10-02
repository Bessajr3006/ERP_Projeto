# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:22-bookworm-slim@sha256:560c5a2c10b50aa22eb4fbc266ee5b28d0eb9f68ad38753239a51cb684c311c6 AS builder

WORKDIR /app

# Copiar os arquivos de pacote primeiro para aproveitar o cache da camada do Docker
COPY package*.json ./

# Instalar dependências (PUPPETEER e FFMPEG bloqueados por env vars, evita OOM e downloads pesados)
RUN FFMPEG_STATIC_SKIP_DOWNLOAD=true PUPPETEER_SKIP_DOWNLOAD=true npm ci --no-audit --no-fund

# Copiar todo o restante do projeto para construir a aplicação
COPY . .

# Compilar o TypeScript, Tailwind CSS e scripts públicos
RUN npm run build && npm run build:css && npm run build:public

# Limpar as dependências de desenvolvimento para economizar espaço
RUN FFMPEG_STATIC_SKIP_DOWNLOAD=true PUPPETEER_SKIP_DOWNLOAD=true npm prune --omit=dev

# ── Stage 2: Runner (Seguro e Não-Root) ────────────────────────────────────────
FROM node:22-bookworm-slim@sha256:560c5a2c10b50aa22eb4fbc266ee5b28d0eb9f68ad38753239a51cb684c311c6 AS runner

WORKDIR /app

# Chromium para whatsapp-web.js em ambiente container/cloud e ffmpeg nativo
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium ca-certificates fonts-liberation ffmpeg \
  && rm -rf /var/lib/apt/lists/*

# Variáveis para que o puppeteer use o Chromium do sistema
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Criar diretórios de persistência e runtime com permissões para o usuário node
RUN mkdir -p /data/uploads /data/runtime /app/public/uploads /app/.runtime \
  && chown -R node:node /app /data

# Copiar artefatos de build, schema do banco e ativos estáticos mantendo ownership node:node
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/public ./public
COPY --chown=node:node --from=builder /app/database ./database
COPY --chown=node:node --from=builder /app/package.json ./package.json
COPY --chown=node:node --from=builder /app/package-lock.json ./package-lock.json
COPY --chown=node:node --from=builder /app/crash-wrapper.js ./crash-wrapper.js
COPY --chown=node:node --from=builder /app/node_modules ./node_modules

# Fazer o ffmpeg-static apontar para o ffmpeg do sistema (economiza 80MB)
RUN mkdir -p /app/node_modules/ffmpeg-static \
    && ln -sf /usr/bin/ffmpeg /app/node_modules/ffmpeg-static/ffmpeg \
    && chown -R node:node /app/node_modules/ffmpeg-static

# Entry point: cria symlinks para uploads/.runtime
COPY --chown=node:node docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Executar como usuário não-root node (segurança de containers)
USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["npm", "start"]
