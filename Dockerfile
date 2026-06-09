FROM node:22 AS builder

WORKDIR /app

# Copiar os arquivos de pacote primeiro para aproveitar o cache da camada do Docker
COPY package*.json ./

# PUPPETEER_SKIP_DOWNLOAD=true evita que o puppeteer baixe o Chromium
# FFMPEG_STATIC_SKIP_DOWNLOAD=true evita que o ffmpeg baixe o binário de 80MB
# Instalar dependências (PUPPETEER e FFMPEG bloqueados por env vars, evita OOM e downloads pesados)
RUN FFMPEG_STATIC_SKIP_DOWNLOAD=true PUPPETEER_SKIP_DOWNLOAD=true npm install --no-audit --no-fund

# Copiar todo o restante do projeto para construir a aplicação
COPY . .

# Compilar o TypeScript e o Tailwind CSS
RUN npm run build && npm run build:css

# Limpar as dependências de desenvolvimento para economizar espaço
# Assim evitamos rodar um segundo "npm ci" pesado no stage runner que causa OOM (Out Of Memory)
RUN FFMPEG_STATIC_SKIP_DOWNLOAD=true PUPPETEER_SKIP_DOWNLOAD=true npm prune --omit=dev

FROM node:22 AS runner

WORKDIR /app

# Chromium para whatsapp-web.js em ambiente container/cloud e ffmpeg nativo
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium ca-certificates fonts-liberation ffmpeg \
  && rm -rf /var/lib/apt/lists/*

# Variáveis para que o puppeteer use o Chromium do sistema
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Copiar artefatos de build, schema do banco e ativos estáticos
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/database ./database
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json

# Copiar os node_modules já enxutos do builder (evita crash do npm ci no Render)
COPY --from=builder /app/crash-wrapper.js ./crash-wrapper.js
COPY --from=builder /app/node_modules ./node_modules

# Fazer o ffmpeg-static apontar para o ffmpeg do sistema (economiza 80MB)
RUN mkdir -p /app/node_modules/ffmpeg-static \
    && ln -sf /usr/bin/ffmpeg /app/node_modules/ffmpeg-static/ffmpeg

# Entry point: cria symlinks para uploads/.runtime quando usamos volume único
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["npm", "start"]
