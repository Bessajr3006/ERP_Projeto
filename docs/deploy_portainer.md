# Deploy no Portainer via Repositorio (Producao)

Este projeto ja esta preparado para publicar no Portainer usando:

- docker-compose.yml
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
docker-compose.yml
```

5. Em **Environment variables**, configure as variáveis obrigatórias:

### Variáveis Obrigatórias de Segurança:
- `DB_PASSWORD`: Senha de conexão da aplicação (`erp_app`) com o MariaDB.
- `MARIADB_PASSWORD`: Senha do usuário MariaDB `erp_app` (geralmente a mesma que `DB_PASSWORD`).
- `MARIADB_ROOT_PASSWORD`: Senha do usuário `root` do MariaDB (para manutenções e backups restritos).
- `JWT_SECRET`: Chave secreta para assinatura dos tokens JWT (**mínimo 32 caracteres**).
- `ENCRYPTION_KEY`: Chave de 64 caracteres hexadecimais (32 bytes AES-256) para criptografia de credenciais (gere com `openssl rand -hex 32`).

### Variáveis Opcionais (possuem defaults no compose):
- `DB_USER` (default: `erp_app`)
- `DB_NAME` / `MARIADB_DATABASE` (default: `bessa_erp`)
- `MARIADB_USER` (default: `erp_app`)
- `JWT_EXPIRES_IN` (default: `24h`)
- `SALT_ROUNDS` (default: `10`)
- `TRAEFIK_CERTRESOLVER` (default: `myresolver`)

Você pode usar o arquivo [.env.production.example](../.env.production.example) como modelo.

## 3) DNS necessário

Crie/ajuste os registros para apontar ao host do Traefik:

- erp.keystones.dev

> **Nota de Segurança**: O phpMyAdmin não fica exposto publicamente via Traefik. Para acessá-lo com segurança, utilize túnel SSH (`ssh -L 8082:127.0.0.1:8082 usuario@ip-vps` -> `http://localhost:8082`) ou IP seguro da VPN NetBird.

## 4) Validação pós deploy

1. Verifique se todos os serviços subiram no Portainer.
2. Abra:
   - https://erp.keystones.dev
3. Confirme emissão de certificado TLS pelo Traefik.

## Observacao sobre primeira subida

- O backend roda `initdb` antes de iniciar a API.
- Na primeira execucao isso pode levar alguns minutos.
- O health check foi configurado com janela maior (`start_period`) para evitar falso `unhealthy` durante essa fase.

## Observacoes

- O frontend fica exposto via Traefik e faz proxy da API para o backend pelo Nginx interno.
- Banco MariaDB fica apenas na rede interna (nao exposto publicamente).
- O phpMyAdmin fica publico apenas pelo dominio dedicado com TLS.
