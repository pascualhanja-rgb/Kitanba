# 🛒 API — Login Social Nativo (Google / Apple) — App Cliente

> Autenticação social **direta** com **Google** e **Apple**, sem intermediários de terceiros (sem Clerk). O frontend Flutter (`kitanba_cliente`) usa os SDKs nativos (`google_sign_in` e `sign_in_with_apple`), obtém o **ID Token** no dispositivo e envia-o para esta API, que faz a **validação criptográfica** diretamente com o fornecedor (`google-auth-library` para o Google, JWKS público da Apple) e devolve os tokens da aplicação (mesmo formato do `POST /auth/login`).

---

## Como funciona (fluxo geral)

```
Frontend (App Cliente)
  └─ Usuário toca "Entrar com Google" (ou Apple)
      └─ google_sign_in / sign_in_with_apple → ID Token nativo
          └─ Frontend envia POST /auth/social { provider, token, user_type }
              └─ API valida o token diretamente com a Google/Apple
                  └─ cria/lia o utilizador
                      └─ API devolve access_token + refresh_token do Kitanda
```

> ✅ **Sem Clerk.** A validação é feita no servidor NestJS:
> - **Google** — assinatura + audiência (`GOOGLE_CLIENT_ID_WEB` / `GOOGLE_CLIENT_ID_ANDROID`) via `google-auth-library`.
> - **Apple** — assinatura + issuer + audiência (`APPLE_CLIENT_ID`) via JWKS público (`https://appleid.apple.com/auth/keys`).

---

## 1. Login / Registro Social (Google ou Apple)

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/auth/social` |
| **Descrição do Contrato** | Valida o ID Token nativo diretamente com o fornecedor, cria o utilizador na primeira vez (ou liga à conta existente com o mesmo email) e devolve os tokens da aplicação. Para o **App Cliente**, enviar `user_type: "customer"` ou omitir (default). |
| **Permissão** | 🌐 Pública (rate limit aplicado) |

### Payload (Request Body)

```json
{
  "provider": "google",
  "token": "eyJhbGciOiJSUzI1NiIs...",
  "user_type": "customer"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `provider` | string | ✅ | `"google"` ou `"apple"` |
| `token` | string | ✅ | **ID Token** obtido nativamente no Flutter (`google_sign_in` ou `sign_in_with_apple`) |
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
    "avatar_url": "https://lh3.googleusercontent.com/..."
  },
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

> ✅ Na primeira vez o utilizador é criado com `is_email_verified: true` (email confiado ao Google/Apple — só entram depois de verificado no fornecedor) e sem senha (`password_hash` nulo) — só entra por Google/Apple.
>
> ℹ️ O ID social é guardado na tabela `users`: `google_id` (o `sub` do token do Google) ou `apple_id` (o `sub` do token da Apple). Nenhuma tabela nova foi criada.

#### `401 Unauthorized`

```json
{
  "statusCode": 401,
  "message": "Token do Google inválido ou expirado",
  "error": "Unauthorized"
}
```

> Também pode devolver `401` com `"Autenticação com Google/Apple não configurada no servidor"` se as variáveis de ambiente do fornecedor não estiverem preenchidas.

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
| **Descrição do Contrato** | Liga a conta social (Google/Apple) do token nativo à conta já autenticada. Depois disso, dá para entrar das duas formas (senha **ou** social). |
| **Permissão** | 🔒 Bearer Token |

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
  "social_provider_email": "maria@gmail.com"
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
| **Descrição do Contrato** | Remove a(s) ligação(ões) com o Google/Apple. Só funciona se a conta tiver senha definida (senão ficaria sem forma de entrar). |
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
- O role de admin **nunca** pode ser atribuído por social (`user_type` só aceita `customer` e `seller`).

## Resumo — App Cliente

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/auth/social` | POST | Entrar/criar conta com Google ou Apple (token nativo) |
| `/auth/social/link` | POST | Ligar social à conta atual (autenticado) |
| `/auth/social/unlink` | DELETE | Desligar conta social (autenticado) |
