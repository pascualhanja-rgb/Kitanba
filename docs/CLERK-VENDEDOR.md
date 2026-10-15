# 🏪 API — Login Social (Clerk) — App Vendedor

> Autenticação social com **Google** e **Apple** via Clerk para o **painel de vendedores**. O fluxo é o mesmo do App Cliente (ver [CLERK-CLIENTE.md](CLERK-CLIENTE.md)), com uma diferença importante: para entrar como **vendedor**, enviar `user_type: "seller"` na primeira entrada.

---

## Como funciona (fluxo do vendedor)

1. Vendedor toca **"Entrar com Google"** (ou Apple) no painel.
2. Clerk faz o login social e o frontend obtém o `clerk_token` (`useAuth().getToken()`).
3. Frontend envia `POST /auth/social` com `user_type: "seller"`.
4. Se for a primeira vez, a conta é criada **já como vendedor** (`user_type: "seller"`).
5. A partir daí, o vendedor usa os mesmos tokens Bearer de sempre em `/stores`, `/products`, etc.

> ⚠️ Se o vendedor **já tem conta com senha** (ex: registado antes por email), o email do Google vai ser **ligado** à conta existente — mantém o `user_type` que já tinha (`seller`) e passa a poder entrar das duas formas.

---

## 1. Login / Registro Social como Vendedor

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/auth/social` |
| **Descrição do Contrato** | Valida o token do Clerk, cria a conta com `user_type: seller` na primeira vez (ou liga à conta existente com o mesmo email) e devolve os tokens da aplicação. |
| **Permissão** | 🌐 Pública (rate limit aplicado) |

### Payload (Request Body)

```json
{
  "clerk_token": "eyJhbGciOiJSUzI1NiIs...",
  "user_type": "seller"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `clerk_token` | string | ✅ | Token de sessão do Clerk (`useAuth().getToken()`) |
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
    "avatar_url": "https://img.clerk.com/..."
  },
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
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

#### `401 Unauthorized` — token expirado/inválido:

```json
{
  "statusCode": 401,
  "message": "Token do Clerk inválido ou expirado",
  "error": "Unauthorized"
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
  "clerk_token": "eyJhbGciOiJSUzI1NiIs..."
}
```

### Resposta / Status

#### `200 OK`

```json
{
  "message": "Conta social ligada com sucesso",
  "clerk_provider_email": "joao@gmail.com"
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

- A conta criada por social mantém sempre o `user_type` original da conta (nunca `seller` vira `customer` por ter entrado com Google).
- Login por senha continua a funcionar para contas ligadas ao social.
- `access_token` expira em 15 min; renovar com `POST /auth/refresh`.
- O role de admin **nunca** pode ser atribuído por social (`user_type` só aceita `customer` e `seller`).

## Resumo — App Vendedor

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/auth/social` | POST | Entrar/criar conta de vendedor com Google ou Apple |
| `/auth/social/link` | POST | Ligar social à conta de vendedor (autenticado) |
| `/auth/social/unlink` | DELETE | Desligar conta social (autenticado) |
