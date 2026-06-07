# Estrutura de Pastas - KEYSTONE ERP

O Keystone ERP é estruturado fisicamente na separação moderna de responsabilidades. Ele junta na mesma pasta o front-end modular (Vanilla JS + HTML) e o Back-end (TypeScript API) processado diretamente pelo Node.js.

Abaixo está o mapeamento descritivo da raiz `Projeto_ERP_Bessa/`:

## 📁 `public/` (App Frontend PWA)

Aqui moram todos os arquivos que o navegador dos seus clientes/usuários fará download. É o sistema visual.

* **`index.html`**: Tela inicial, encarregada do de login (porta de entrada para as Tokens JWT).
* **`register.html`**: Tela de cadastro/credenciamento inicial das lojas usando API de Receita.
* **`manifest.json`**: Arquivo JSON usado por Android, iOS e Windows para permitir a "instalação" do PWA como um aplicativo nativo.
* **`sw.js`**: Service Worker do PWA. É o script invisível que cacheia esses arquivos para que o sistema carregue incrivelmente rápido e sem precisar de rede ativa.
* **`.DS_Store`**: Automático do macOS, não usado pelo ERP.

### 📂 `public/pages/`

As telinhas do sistema (estruturas base de layout criadas em HTML), preparadas para os dados preencherem os vazios:

* `dashboard.html`, `sales.html`, `products.html`, `users.html`, `company.html`, `finance_categories.html`, etc.

### 📂 `public/js/`

A lógica de negócio local injetada nas telas acima. São os cérebros "offline".

* `api.js`: Arquivo crítico, ponte de comunicação com servidor real que esconde os `CacheManager` (Local Storage) e `SyncManager`.
* `sales.js`: Motor robusto da Frente de Caixa/PDV.
* `pwa.js`: Script curtíssimo apenas para registrar e ligar o `sw.js` no navegador do usuário.
* `components/`: Guarda os injetores assíncronos (como a NavBar).

### 📂 `public/css/`

* `style.css`: Arquivo compilado pelo framework *Tailwind CSS*. Ele já tem todas as cores e espaçamentos do sistema. Toda vez que quiser mudar o tom da marca, basta mudar os hexadecimais no topo desse artigo!

### 📂 Outros do Public

* `img/` - Logos em png cruas da "NEXAB/KEYSTONE".

---

## 📁 `src/` (API Backend - Typescript Engine)

Aqui vive o cérebro escondido, conectado pelo NodeJS, blindado de usuários e exposto atrás do terminal.

* **`server.ts`**: Código inicial base. Ergue a segurança CORS, hospeda a API (`app.listen`) nas portas especificadas, roteia e define os domínios restritos `/api/v1/`.
* **`input.css`**: Arquivo não compilado (raiz) para os desenvolvedores pedirem classes novas ao Tailwind antes de passarem pro `public/css/style.css`.

### 📂 `src/controllers/`

O "recepcionista". Eles pegam o que a tela HTML enviou de formulário (Request HTTP), validam quem está enviando e passam pro Service. Se quebrar, é daqui que ele avisa na tela do usuário "Ops! 500".

* `entityController.ts`, `financeController.ts`, `productController.ts`, etc.

### 📂 `src/services/`

A essência e as chaves. Pegam ordens do Controller, conferem se tem estoque suficiente real, fazem contas de impostos cruas, executam os comandos na ponta e escrevem direto no arquivo binário/remoto relacional.

* `orderService.ts`, `productService.ts`.

### 📂 `src/routes/`

A "Mesa de Telefones". Exemplo: Quando o visual em JavaScript aciona `fetch('/api/v1/products/25')` é pelo `productRoutes.ts` dentro dessa pasta que a inteligência artificial do sistema sabe pra onde o fluxo de Node tem que ir.

### 📂 `src/types/`

Esqueletos tipados (`Entities`). São as garantias que o motor de busca proíbe que você tente somar um booleano de caixa com uma string de nome.

* `Product.ts` (Força o Backend a ler que InitialStock sempre precisa ser Numérico antes de cometer um erro grave).

---

## 📁 `database/` (A Memória e Histórico)

Scripts SQL para evolução do schema do ERP em MariaDB/MySQL.

* Todos os scripts numerados (`05_...sql`, `06_...sql`, etc.) dentro dessa pasta servem pra criar/ajustar tabelas e regras fiscais/financeiras.

---

## 📄 Arquivos Raiz

* **`.env`**: (Onde devem ficar senhas criptográficas, Portas reais de ambiente de Teste ou IP de Prod, JWT Secrets).
* **`package.json`** Módulo responsável pelos comandos do CLI `npm run dev` e que registra o tamanho massivo das bibliotecas invisíveis da raiz (`/node_modules/`).
