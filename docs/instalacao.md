# Guia de Instalação — KEYSTONE ERP

## Requisitos

| Ferramenta | Versão mínima |
| --- | --- |
| Node.js | 20.x ou superior |
| npm | 10.x ou superior |
| Docker | 24.x ou superior |
| Docker Compose | v2 (plugin) |

---

## Modo Desenvolvimento (local)

### 1. Clonar o repositório

```bash
git clone https://github.com/Bessajr3006/projeto-erp-bessa2.git
cd projeto-erp-bessa2
```

### 2. Instalar o Node.js local (se não tiver)

```bash
bash install-node-local.sh
```

Isso instala o Node.js em `.node/` e cria o arquivo `activate.sh`.

### 3. Ativar o Node.js na sessão

```bash
source activate.sh
```

### 4. Instalar dependências

```bash
npm install
```

### 5. Configurar o ambiente

Crie o arquivo `.env` na raiz do projeto (você pode copiar de `.env.example`):

```env
NODE_ENV=development
PORT=3020

DB_HOST=127.0.0.1
DB_PORT=3308
DB_NAME=bessa_erp
DB_USER=root
DB_PASSWORD=sua_senha_aqui

ENCRYPTION_KEY=gere_uma_chave_hexadecimal_com_64_caracteres
```

> **Gerar ENCRYPTION_KEY:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 6. Subir o banco de dados (Docker)

O `docker-compose.yml` do repositório está focado em deploy (Traefik/Portainer), então o MariaDB **não expõe porta** por padrão.

Para desenvolvimento local, crie um arquivo **não versionado** `docker-compose.local.yml` na raiz com:

```yaml
services:
  db:
    ports:
      - "3308:3306"
```

E suba assim:

```bash
export MARIADB_ROOT_PASSWORD="sua_senha_aqui"
export MARIADB_PASSWORD="sua_senha_aqui"

docker compose -f docker-compose.yml -f docker-compose.local.yml up -d db
```

### 7. Inicializar o banco de dados

```bash
npm run initdb
```

Isso cria as tabelas, roles, permissões e o usuário superadmin padrão.

**Credenciais padrão do superadmin:**

- E-mail: `superadmin@keystone.local`
- Senha: `123`

> Altere a senha após o primeiro acesso.

### 8. Compilar o CSS

```bash
npm run build:css
```

### 9. Iniciar o servidor

```bash
npm run dev
```

O sistema ficará disponível em: <http://localhost:3020>

---

## Modo Produção (Docker)

### 1. Configurar o ambiente de produção

Copie e edite o arquivo de exemplo:

```bash
cp .env.production.example .env.production
```

Preencha todas as variáveis:

```env
NODE_ENV=production
PORT=3000
TZ=America/Sao_Paulo

DB_HOST=db
DB_PORT=3306
DB_NAME=bessa_erp
DB_USER=erp_user
DB_PASSWORD=senha_forte_aqui
DB_ROOT_PASSWORD=senha_root_forte_aqui

MARIADB_DATABASE=bessa_erp
MARIADB_USER=erp_user
MARIADB_PASSWORD=senha_forte_aqui
MARIADB_ROOT_PASSWORD=senha_root_forte_aqui

JWT_SECRET=segredo_longo_e_unico
JWT_EXPIRES_IN=24h
SALT_ROUNDS=10
ENCRYPTION_KEY=chave_hexadecimal_64_chars
```

### 2. Build e subir todos os serviços

```bash
docker compose up -d --build
```

Isso sobe quatro containers:

| Container | Função |
| --- | --- |
| `Projeto_ERP_DB` | Banco de dados MariaDB 11.4 |
| `Projeto_ERP_Backend` | Servidor Express API (porta interna 3000) |
| `Projeto_ERP_Frontend` | Nginx — serve o frontend (porta 80) |
| `Projeto_ERP_Worker` | Fila de background (WhatsApp, etc.) |

O banco é inicializado automaticamente na primeira execução pelo comando `node dist/scripts/initdb.js`.

### 3. Verificar status

```bash
docker compose ps
docker compose logs Projeto_ERP_Backend --tail=50
```

O sistema estará disponível em: <http://localhost:3000>

---

## Scripts úteis

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia o servidor em modo desenvolvimento com hot-reload |
| `npm run worker` | Inicia o worker (WhatsApp/SEFAZ) em modo desenvolvimento |
| `npm run build` | Compila o TypeScript para `dist/` |
| `npm run build:css` | Gera o `public/css/style.css` |
| `npm run initdb` | Inicializa banco de dados e seed |
| `npm run reset-admin` | Reseta a senha do superadmin |
| `npm run db:check` | Verifica conexão com o banco |
| `npm run db:generate` | Gera `src/types/database.ts` (requer `DATABASE_URL`) |

---

## Estrutura de pastas relevante

```text
├── src/                  # Código fonte TypeScript (backend)
│   ├── controllers/      # Controladores das rotas
│   ├── services/         # Regras de negócio
│   ├── routes/           # Definição das rotas Express
│   └── scripts/          # Scripts de inicialização e migração
├── public/               # Frontend estático
│   ├── pages/            # Páginas HTML
│   ├── js/               # Scripts JavaScript
│   └── css/              # Estilos compilados
├── database/             # Scripts SQL de migração
├── .env                  # Configuração local (não versionar)
├── .env.production       # Configuração de produção (não versionar)
├── docker-compose.yml    # Orquestração Docker (produção)
└── Dockerfile            # Build da imagem da aplicação
```

---

## Solução de problemas

**Porta 3020 já em uso:**

```bash
lsof -ti:3020 | xargs kill -9
```

**Erro de conexão com o banco:**

```bash
npm run db:check
```

**Banco não inicializado:**

```bash
npm run initdb
```

**Container do banco não sobe:**

```bash
docker compose logs db
```
