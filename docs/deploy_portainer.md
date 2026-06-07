# Deploy no Portainer via Repositorio (Producao)

Este projeto ja esta preparado para publicar no Portainer usando:

- docker-compose.portainer.yml
- Dockerfile.portainer
- Dockerfile.frontend

Dominios configurados:

- erp.keystones.dev
- phpmyadmin.erp.keystones.dev

## 1) Pre-requisitos no host Docker

1. Traefik instalado e funcional no host (entrypoint websecure e certresolver ativo).
2. Rede externa do Traefik existente:

```bash
docker network create traefik
```

3. O volume do MariaDB agora e criado automaticamente pela stack no primeiro deploy.

## 2) Stack no Portainer (Repository)

1. Acesse Portainer > Stacks > Add stack.
2. Selecione Repository.
3. Informe o repositorio e branch.
4. Em Compose path, use:

```text
docker-compose.portainer.yml
```

5. Em Environment variables, nao e obrigatorio preencher nada para subir a stack.

Defaults ja embutidos no projeto:

- DB_USER=root
- DB_PASSWORD=30mariafn@
- MARIADB_PASSWORD=30mariafn@
- MARIADB_ROOT_PASSWORD=30mariafn@
- PMA_USER=root
- PMA_PASSWORD=30mariafn@

Opcionalmente, voce pode sobrescrever:

- JWT_SECRET
- ENCRYPTION_KEY

Voce pode usar a base de [.env.production.example](../.env.production.example).

## 3) DNS necessario

Crie/ajuste os registros para apontar ao host do Traefik:

- erp.keystones.dev
- phpmyadmin.erp.keystones.dev

## 4) Validacao pos deploy

1. Verifique se todos os servicos subiram no Portainer.
2. Abra:
   - https://erp.keystones.dev
   - https://phpmyadmin.erp.keystones.dev
3. Confirme emissao de certificado TLS pelo Traefik.

## Observacao sobre primeira subida

- O backend roda `initdb` antes de iniciar a API.
- Na primeira execucao isso pode levar alguns minutos.
- O health check foi configurado com janela maior (`start_period`) para evitar falso `unhealthy` durante essa fase.

## Observacoes

- O frontend fica exposto via Traefik e faz proxy da API para o backend pelo Nginx interno.
- Banco MariaDB fica apenas na rede interna (nao exposto publicamente).
- O phpMyAdmin fica publico apenas pelo dominio dedicado com TLS.
