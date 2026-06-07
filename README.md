# Bessa ERP

Sistema ERP com backend em Node.js + TypeScript e frontend PWA em HTML/JavaScript, com foco em vendas, financeiro, estoque, fiscal e operacao multiempresa.

## Visao geral

- Frontend PWA servido a partir de `public/`.
- API REST em Express com prefixo `api/v1`.
- Worker dedicado para processos assincronos (WhatsApp e filas).
- Banco MariaDB/MySQL com migrations e inicializacao via script.

## Stack principal

- Node.js 22+
- TypeScript
- Express 4
- MariaDB/MySQL (`mysql2`)
- Zod (validacao)
- JWT + bcrypt (autenticacao)
- PWA (manifest + service worker)
- Docker + Docker Compose

## Arquitetura resumida

- `public/`: paginas HTML, scripts JS e assets do PWA
- `src/app.ts`: configuracao do Express (middlewares, rotas, docs)
- `src/server.ts`: bootstrap da API e startup
- `src/worker.ts`: processamento em background
- `src/routes -> controllers -> services -> repositories`: fluxo principal de backend
- `src/scripts/initdb.ts`: inicializacao/migracoes do banco

## Modulos do sistema

- Dashboard e tarefas
- Vendas e pedidos
- Compras
- Financeiro (receitas, despesas, categorias, relatorios)
- Contabilidade
- Estoque (produtos, categorias, tipos de estoque, fabricantes, medidas, regras)
- Fiscal (NFe e manifestacao)
- Entidades (clientes, fornecedores, contatos)
- Usuarios, perfis e permissoes

## Requisitos

- Node.js 22+
- npm 10+
- MariaDB/MySQL
- Docker e Docker Compose (opcional, recomendado)

## Configuracao local (desenvolvimento)

1. Instale dependencias:

```bash
npm install
```

1. Opcional: ativar Node local do projeto:

```bash
source activate.sh
```

1. Crie o arquivo `.env` na raiz (exemplo minimo):

```env
NODE_ENV=development
PORT=3030
HTTPS_PORT=8443

DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=bessa_erp
DB_USER=root
DB_PASSWORD=sua_senha

JWT_SECRET=troque_esta_chave
JWT_EXPIRES_IN=90d
SALT_ROUNDS=10

# 64 caracteres hexadecimais
ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000
```

1. Inicialize banco e migrations:

```bash
npm run initdb
```

1. Inicie a API em desenvolvimento:

```bash
npm run dev
```

1. (Opcional) Inicie o worker em outro terminal:

```bash
npm run worker
```

## HTTPS local

Se `certs/cert.pem` e `certs/key.pem` existirem, o servidor sobe em HTTPS (`HTTPS_PORT`, padrao `8443`).
Sem certificados, sobe em HTTP (`PORT`, padrao `3030`).

## Scripts disponiveis

Principais scripts em `package.json`:

- `npm run dev`: API com watch
- `npm run worker`: worker com watch
- `npm run build`: compila TypeScript do backend
- `npm start`: executa backend compilado (`dist/server.js`)
- `npm run start:worker`: executa worker compilado
- `npm run initdb`: inicializa schema/migracoes
- `npm run reset-admin`: reset de admin
- `npm run db:check`: validacao de conexao
- `npm run build:css`: gera CSS do frontend
- `npm run watch:css`: watch do CSS
- `npm run build:public`: compila TS publico + service worker

## Build e frontend

- `npm run build` compila apenas backend TypeScript.
- Para atualizar artefatos de frontend compilado, rode tambem:

```bash
npm run build:public
npm run build:css
```

## API e healthcheck

- Health: `/health`
- Swagger UI: `/api-docs`
- Swagger JSON: `/api-docs.json`
- Prefixo das rotas da API: `/api/v1`

Exemplos:

- `/api/v1/auth`
- `/api/v1/products`
- `/api/v1/estoque`
- `/api/v1/finance`
- `/api/v1/tasks`

## Docker e deploy

- Deploy com Traefik/Portainer: usar `docker-compose.portainer.yml`.
- Compose principal: `docker-compose.yml` (inclui backend, worker, frontend e db conforme ambiente).
- Documentacao complementar:
  - `docs/instalacao.md`
  - `docs/deploy_portainer.md`
  - `docs/arquitetura_pwa.md`

## Estrutura de pastas (resumo)

```text
.
|- public/
|  |- pages/
|  |- js/
|  |- css/
|  |- sw.js
|  |- manifest.json
|- src/
|  |- routes/
|  |- controllers/
|  |- services/
|  |- repositories/
|  |- scripts/
|  |- app.ts
|  |- server.ts
|  |- worker.ts
|- database/
|- docs/
|- docker-compose.yml
|- docker-compose.portainer.yml
|- package.json
```

## Observacoes

- Em producao, mantenha `JWT_SECRET` e `ENCRYPTION_KEY` fortes.
- Nao versionar `.env` com credenciais reais.
- Para mudancas estruturais de banco, prefira migrations em `src/scripts` e scripts SQL em `database/`.
