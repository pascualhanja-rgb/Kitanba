# 🏪 API — Login Social Nativo (Google / Apple) — App Vendedor

> Autenticação social **direta** com **Google** e **Apple** (sem Clerk) para o **painel de vendedores**. O fluxo é o mesmo do App Cliente (ver [SOCIAL-CLIENTE.md](SOCIAL-CLIENTE.md)), com uma diferença importante: para entrar como **vendedor**, enviar `user_type: "seller"` na primeira entrada.

---

## Como funciona (fluxo do vendedor)

1. Vendedor toca **"Entrar com Google"** (ou Apple) no painel.
2. O SDK nativo (`google_sign_in` / `sign_in_with_apple`) devolve o **ID Token**.
3. Frontend envia `POST /auth/social` com `provider`, `token` e `user_type: "seller"`.
4. O backend valida o token diretamente com o fornecedor (`google-auth-library` / JWKS da Apple).
5. Se for a primeira vez, a conta é criada **já como vendedor** (`user_type: "seller"`).
6. A partir daí, o vendedor usa os mesmos tokens Bearer de sempre em `/stores`, `/products`, etc.

> ⚠️ Se o vendedor **já tem conta com senha** (ex: registado antes por email), o email do Google/Apple vai ser **ligado** à conta existente — mantém o `user_type` que já tinha (`seller`) e passa a poder entrar das duas formas.

---

## 1. Login / Registro Social como Vendedor

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/auth/social` |
| **Descrição do Contrato** | Valida o ID Token nativo diretamente com o fornecedor, cria a conta com `user_type: seller` na primeira vez (ou liga à conta existente com o mesmo email) e devolve os tokens da aplicação. |
| **Permissão** | 🌐 Pública (rate limit aplicado) |

### Payload (Request Body)

```json
{
  "provider": "google",
  "token": "eyJhbGciOiJSUzI1NiIs...",
  "user_type": "seller"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `provider` | string | ✅ | `"google"` ou `"apple"` |
| `token` | string | ✅ | **ID Token** obtido nativamente no Flutter (`google_sign_in` ou `sign_in_with_apple`) |
| `user_type` | string | ❌ | **Enviar `"seller"`** para o painel de vendedores (default é `customer`) |

### Resposta / Status

#### `200 OK`

```json
{
  "user": {
    "id": "uuid-do-utilizador",
    "name": "João Kitanda",
    "email": "joao@gmail.com",
    "user_type": "seller",
    "avatar_url": "https://lh3.googleusercontent.com/..."
  },
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### `401 Unauthorized` — token expirado/inválido:

```json
{
  "statusCode": 401,
  "message": "Token do Google inválido ou expirado",
  "error": "Unauthorized"
}
```

#### `409 Conflict` — email social já pertence a outra conta social:

```json
{
  "statusCode": 409,
  "message": "Este email já está ligado a outra conta social. Faça login normalmente.",
  "error": "Conflict"
}
```

---

## 2. Ligar Google/Apple à Loja/Vendedor Existente

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/auth/social/link` |
| **Descrição do Contrato** | Vendedor já autenticado (senha) liga a conta Google/Apple — depois entra das duas formas sem perder o role `seller`. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

### Payload (Request Body)

```json
{
  "provider": "google",
  "token": "eyJhbGciOiJSUzI1NiIs..."
}
```

### Resposta / Status

#### `200 OK`

```json
{
  "message": "Conta social ligada com sucesso",
  "social_provider_email": "joao@gmail.com"
}
```

#### `409 Conflict` — conta social já ligada a outro utilizador:

```json
{
  "statusCode": 409,
  "message": "Esta conta social já está ligada a outro utilizador",
  "error": "Conflict"
}
```

---

## 3. Desligar Conta Social

| Campo | Valor |
|-------|-------|
| **Método** | `DELETE` |
| **Endpoint** | `/auth/social/unlink` |
| **Descrição do Contrato** | Remove a ligação social. **Importante para o vendedor**: só funciona se a conta tiver senha — a senha é a única forma de permanecer a aceder à loja sem o social. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

### Resposta / Status

#### `200 OK`

```json
{ "message": "Conta social desligada com sucesso" }
```

#### `400 Bad Request`

```json
{
  "statusCode": 400,
  "message": "Defina uma senha antes de desligar a conta social, caso contrário perde o acesso",
  "error": "Bad Request"
}
```

---

## Regras Aplicadas (Resumo)

- A conta criada por social mantém sempre o `user_type` original da conta (nunca `seller` vira `customer` por ter entrado com Google/Apple).
- Login por senha continua a funcionar para contas ligadas ao social.
- `access_token` expira em 15 min; renovar com `POST /auth/refresh`.
- O role de admin **nunca** pode ser atribuído por social (`user_type` só aceita `customer` e `seller`).

## Resumo — App Vendedor

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/auth/social` | POST | Entrar/criar conta de vendedor com Google ou Apple (token nativo) |
| `/auth/social/link` | POST | Ligar social à conta de vendedor (autenticado) |
| `/auth/social/unlink` | DELETE | Desligar conta social (autenticado) |
