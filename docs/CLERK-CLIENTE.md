# 🛒 API — Login Social (Clerk) — App Cliente

> Autenticação social com **Google** e **Apple** via Clerk. O frontend usa os componentes do Clerk (`<SignIn />`, botões Google/Apple) e envia o **token de sessão** para esta API, que valida, syncroniza o utilizador e devolve os tokens da aplicação (mesmo formato do `POST /auth/login`).

---

## Como funciona (fluxo geral)

```
Frontend (App Cliente)
  └─ Usuário toca "Entrar com Google" (ou Apple)
      └─ Clerk abre popup do Google/Apple e faz o login
          └─ useAuth().getToken() → clerk_token
              └─ Frontend envia POST /auth/social { clerk_token }
                  └─ API valida o token no servidor, cria/liga o utilizador
                      └─ API devolve access_token + refresh_token do Kitanda
```

> ⚠️ O Google/Apple **não fala diretamente com esta API**. Tudo é mediado pelo Clerk no frontend; o backend só valida o token.

---

## 1. Login / Registro Social (Google ou Apple)

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/auth/social` |
| **Descrição do Contrato** | Valida o token de sessão do Clerk, cria o utilizador na primeira vez (ou liga à conta existente com o mesmo email) e devolve os tokens da aplicação. Para o **App Cliente**, enviar `user_type: "customer"` ou omitir (default). |
| **Permissão** | 🌐 Pública (rate limit aplicado) |

### Payload (Request Body)

```json
{
  "clerk_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6Imlu...",
  "user_type": "customer"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `clerk_token` | string | ✅ | Token de sessão do Clerk (`useAuth().getToken()`) |
| `user_type` | string | ❌ | `customer` (default) ou `seller`. Não existe por aqui `admin` |

### Resposta / Status

#### `200 OK`

```json
{
  "user": {
    "id": "uuid-do-utilizador",
    "name": "Maria Domingos",
    "email": "maria@gmail.com",
    "user_type": "customer",
    "avatar_url": "https://img.clerk.com/..."
  },
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

> ✅ Na primeira vez o utilizador é criado com `is_email_verified: true` (confiado ao Clerk) e sem senha (`password_hash` nulo) — só entra por Google/Apple.

#### `401 Unauthorized`

```json
{
  "statusCode": 401,
  "message": "Token do Clerk inválido ou expirado",
  "error": "Unauthorized"
}
```

#### `409 Conflict`

```json
{
  "statusCode": 409,
  "message": "Este email já está ligado a outra conta social. Faça login normalmente.",
  "error": "Conflict"
}
```

---

## 2. Ligar Google/Apple a uma Conta Existente

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/auth/social/link` |
| **Descrição do Contrato** | Liga a conta social (Google/Apple) do token do Clerk à conta já autenticada. Depois disso, dá para entrar das duas formas (senha **ou** social). |
| **Permissão** | 🔒 Bearer Token |

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
  "clerk_provider_email": "maria@gmail.com"
}
```

#### `409 Conflict` — conta social já está noutro utilizador:

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
| **Descrição do Contrato** | Remove a ligação com o Google/Apple. Só funciona se a conta tiver senha definida (senão ficaria sem forma de entrar). |
| **Permissão** | 🔒 Bearer Token |

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

> Use `POST /auth/change-password` (já documentado em [API-AUTH.md](API-AUTH.md)) para definir a primeira senha da conta criada por social.

---

## Regras Aplicadas (Resumo)

- O email do Google/Apple é único: se já houver conta com o mesmo email (criada por senha), a conta social é **ligada** a ela — não se cria duplicado.
- Utilizadores criados por social não têm senha: `POST /auth/login` (email/senha) devolve `401` até definirem uma senha.
- `access_token` expira em 15 min; renovar com `POST /auth/refresh` (ver [API-AUTH.md](API-AUTH.md)).
- Logout com `POST /auth/logout` revoga os tokens normalmente.
- Utilizadores do social entram direto como `customer`; upgrade para `seller` segue o fluxo normal do app.

## Resumo — App Cliente

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/auth/social` | POST | Entrar/criar conta com Google ou Apple |
| `/auth/social/link` | POST | Ligar social à conta atual (autenticado) |
| `/auth/social/unlink` | DELETE | Desligar conta social (autenticado) |
