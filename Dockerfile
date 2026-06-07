FROM node:22 AS builder

WORKDIR /app

# Copiar os arquivos de pacote primeiro para aproveitar o cache da camada do Docker
COPY package*.json ./

# Instalar dependências de build (TypeScript, Tailwind, etc.)
RUN npm ci

# Copiar todo o restante do projeto para construir a aplicação
COPY . .

# Compilar o TypeScript e o Tailwind CSS
RUN npm run build && npm run build:css

FROM node:22 AS runner

WORKDIR /app

# Chromium para whatsapp-web.js em ambiente container/cloud
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium ca-certificates fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

# Instalar apenas dependências de produção no stage final
# FFMPEG_STATIC_SKIP_DOWNLOAD evita re-download do binário (copiado do builder)
COPY package*.json ./
RUN FFMPEG_STATIC_SKIP_DOWNLOAD=true npm ci --omit=dev

# Copiar artefatos de build, schema do banco e ativos estáticos
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/database ./database
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json

# Copiar o binário do ffmpeg já baixado no stage de build
COPY --from=builder /app/node_modules/ffmpeg-static/ffmpeg ./node_modules/ffmpeg-static/ffmpeg

# Entry point: cria symlinks para uploads/.runtime quando usamos volume único
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3000
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["npm", "start"]
