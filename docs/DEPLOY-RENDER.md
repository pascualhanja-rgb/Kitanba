# Deploy em produção — Render

Guia para publicar a API Kitanda no Render com Postgres (Neon), Redis gerido,
migrações automáticas, health check e rate limiting.

## 1. Pré-requisitos

- Conta no [Render](https://render.com) com billing ativo (o `preDeployCommand`
  e o Redis exigem plano pago; o web service está em `standard` = 2GB).
- Repositório ligado ao GitHub/GitLab com a branch `main`.
- Base de dados Postgres (Neon) criada e a connection string à mão.
  Use a connection string **pooled** (host com `-pooler`) para produção.

## 2. Criar o serviço (Blueprint)

1. Render Dashboard → **New → Blueprint** → escolher este repositório.
2. O Render lê o `render.yaml` e cria:
   - `kitanda-api` (Node, Frankfurt, health check `/health`)
   - `kitanda-redis` (Key Value, apenas rede interna)
3. Preencher os segredos marcados com `sync: false` no dashboard:

| Variável | Onde obter |
| --- | --- |
| `DATABASE_URL` | Neon → Connection string (pooled, `sslmode=require`) |
| `JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `APP_URL` | URL pública do serviço, ex. `https://kitanda-api.onrender.com` |
| `CORS_ORIGINS` | Domínios do site/painel, separados por vírgulas |
| `BREVO_API_KEY`, `BREVO_FROM` | Brevo → SMTP & API |
| `CLOUDINARY_*` | Cloudinary Console |
| `R2_*` | Cloudflare R2 → Manage API Tokens |
| `GOOGLE_CLIENT_ID_WEB`, `GOOGLE_CLIENT_ID_ANDROID` | Google Cloud Console → Credentials |

O Redis é ligado automaticamente via `REDIS_URL` (`fromService`), sem copiar
credenciais. `PORT` é injetado pelo Render.

## 3. Migrações

- `preDeployCommand: npm run db:migrate` corre antes de cada deploy.
- O script `scripts/migrate.mjs`:
  - cria `schema_migrations`;
  - aplica `database/schema.sql` apenas se a base estiver vazia;
  - aplica `database/migrations/*.sql` por ordem, uma única vez, em transação.
- Manualmente (ou noutra máquina):

```bash
DATABASE_URL="postgresql://..." npm run db:migrate
```

## 4. Depois do primeiro deploy

1. Abrir `https://<serviço>.onrender.com/health` → deve devolver
   `{"status":"ok","checks":{"database":"up","redis":"up"}}`.
2. Google Cloud Console → OAuth Client → **Authorized JavaScript origins**:
   adicionar a URL do Render (e a do site).
3. Cloudflare R2 → bucket → **CORS** (uploads diretos do browser/app):

```json
[
  {
    "AllowedOrigins": ["https://kitanda-api.onrender.com", "https://oteudominio.com"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

4. Testar login, upload de imagem e uma rota pública.

## 5. Performance e escala

Configuração aplicada:

- Compressão gzip das respostas.
- Pool Postgres: 10 ligações por instância (`DB_POOL_MAX`), timeout de 30s.
- `keepAliveTimeout` de 65s (o proxy do Render fecha idle aos 60s).
- Redis para cache (anúncios), blacklist de tokens, brute-force e contadores.
- Rate limit global de 300 req/min por IP (`THROTTLE_LIMIT`), login 20/min.
- Health check rápido (<1s) para o Render não reiniciar o serviço à toa.

**Uma instância (`numInstances: 1`)** aguenta milhares de utilizadores em
pedidos HTTP. Para subir para 2+ instâncias:

- Socket.IO (chat/tracking) precisa do adapter Redis —
  `@socket.io/redis-adapter` + `redis`, publicado no `main.ts`/gateway.
  Sem ele, eventos em tempo real só chegam à instância que os recebeu.
- O rate limiting em memória passa a ser por instância (o limite efetivo
  multiplica). Para limite global, usar storage Redis no throttler.
- Ajustar `DB_POOL_MAX` para não exceder o limite de ligações do Neon.

Neon: se usar autoscaling do Render, prefira a connection string pooled.

## 6. Segurança já ativa

- Helmet, CORS restritivo por lista, validação global com whitelist.
- Swagger desativado em produção (`ENABLE_SWAGGER=true` para reativar).
- `JWT_SECRET` obrigatório (>=32 chars) — o processo não arranca sem ele.
- Erros internos nunca expõem stack traces.
- `synchronize: false` — schema só muda por migração.
- Redis sem exposição pública (`ipAllowList: []`).

## 7. Problemas comuns

| Sintoma | Causa / solução |
| --- | --- |
| Deploy falha no build | Peers do Nest: o build já usa `--legacy-peer-deps`. |
| 502 intermitente | Confirme `keepAliveTimeout` (já configurado) e o health check. |
| `ECONNREFUSED` na BD | `DATABASE_URL` errado ou Neon suspenso; ver logs do Render. |
| 429 em massa | `THROTTLE_LIMIT` demasiado baixo ou `trust proxy` ausente. |
| Redis “disabled” nos logs | `REDIS_URL` vazio — confirme o serviço `kitanda-redis`. |
| Upload falha no browser | CORS do bucket R2 (passo 4.3). |
