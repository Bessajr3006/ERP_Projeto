# API Docs (Swagger)

## Acesso

- Swagger UI: /api-docs
- JSON OpenAPI: /api-docs.json

## Autenticacao

A maioria das rotas exige JWT. Use o endpoint de login para obter o token e informe no Swagger como Bearer.

Tambem e possivel usar o token Swagger da empresa (prefixo swg_) como Bearer para acesso externo:

Authorization: Bearer swg_...

Exemplo de header:

Authorization: Bearer TOKEN

## Observacoes

- A base da API e /api/v1
- Rotas documentadas incluem auth, finance, products e estoque/categorias de produto
- Categorias de produto: /estoque/categories
