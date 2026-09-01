# 🔐 API — Autenticação (Auth)

> **Base URL:** `/auth`  
> Todos os apps (Cliente, Vendedor, Admin) usam estes endpoints.

---

## 1. Registrar Novo Utilizador

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/auth/register` |
| **Descrição do Contrato** | Cria uma nova conta de utilizador. Retorna tokens JWT imediatamente. |
| **Permissão** | 🔓 Público (sem autenticação) |

### Payload (Request Body)

```json
{
  "name": "João Silva",
  "email": "joao@email.com",
  "password": "MinhaSenh@123!",
  "phone": "+244 923 456 789",
  "user_type": "customer"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `name` | string | ✅ | Nome completo (2-100 caracteres) |
| `email` | string | ✅ | Email válido e único |
| `password` | string | ✅ | Mínimo 8 chars, 1 maiúscula, 1 minúscula, 1 número, 1 especial |
| `phone` | string | ❌ | Telefone com código do país |
| `user_type` | string | ❌ | `"customer"` (padrão) ou `"seller"` |

### Resposta / Status

#### `201 Created`

```json
{
  "user": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "João Silva",
    "email": "joao@email.com",
    "user_type": "customer",
    "is_email_verified": false
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### `409 Conflict`

```json
{
  "statusCode": 409,
  "message": "Email já está em uso",
  "error": "Conflict"
}
```

#### `400 Bad Request`

```json
{
  "statusCode": 400,
  "message": [
    "A senha deve conter pelo menos uma letra maiúscula",
    "email must be an email"
  ],
  "error": "Bad Request"
}
```

---

## 2. Login

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/auth/login` |
| **Descrição do Contrato** | Autentica o utilizador. Retorna access_token (1h) e refresh_token (7 dias). Protegido contra brute force (5 tentativas → bloqueio 15min). |
| **Permissão** | 🔓 Público (sem autenticação) |

### Payload (Request Body)

```json
{
  "email": "joao@email.com",
  "password": "MinhaSenh@123!"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `email` | string | ✅ | Email registado |
| `password` | string | ✅ | Senha da conta |

### Resposta / Status

#### `200 OK`

```json
{
  "user": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "João Silva",
    "email": "joao@email.com",
    "user_type": "seller",
    "is_email_verified": true
  },
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### `401 Unauthorized`

```json
{
  "statusCode": 401,
  "message": "Credenciais inválidas",
  "error": "Unauthorized"
}
```

#### `401 Unauthorized` (Conta bloqueada)

```json
{
  "statusCode": 401,
  "message": "Conta temporariamente bloqueada devido a múltiplas tentativas. Tente novamente mais tarde.",
  "error": "Unauthorized"
}
```

---

## 3. Renovar Token

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/auth/refresh` |
| **Descrição do Contrato** | Renova os tokens usando o refresh_token. O refresh_token antigo é revogado (rotação de tokens). |
| **Permissão** | 🔓 Público (usa refresh_token) |

### Payload (Request Body)

```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `refresh_token` | string | ✅ | Token de renovação |

### Resposta / Status

#### `200 OK`

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### `401 Unauthorized`

```json
{
  "statusCode": 401,
  "message": "Refresh token inválido ou expirado",
  "error": "Unauthorized"
}
```

---

## 4. Logout

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/auth/logout` |
| **Descrição do Contrato** | Revoga o refresh_token e limpa cache do utilizador no Redis. |
| **Permissão** | 🔒 Bearer Token |

### Payload (Request Body)

```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `refresh_token` | string | ❌ | Token a revogar (opcional, mas recomendado) |

### Resposta / Status

#### `200 OK`

```json
{
  "message": "Logout efetuado com sucesso"
}
```

---

## 5. Alterar Senha

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/auth/change-password` |
| **Descrição do Contrato** | Altera a senha do utilizador autenticado. Exige senha atual. Nova senha deve ser diferente da atual. |
| **Permissão** | 🔒 Bearer Token |

### Payload (Request Body)

```json
{
  "current_password": "MinhaSenh@123!",
  "new_password": "NovaSenh@456!"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `current_password` | string | ✅ | Senha atual |
| `new_password` | string | ✅ | Nova senha (mesmas regras de registro) |

### Resposta / Status

#### `200 OK`

```json
{
  "message": "Senha alterada com sucesso"
}
```

#### `400 Bad Request`

```json
{
  "statusCode": 400,
  "message": "Senha atual incorreta",
  "error": "Bad Request"
}
```

---

## 6. Obter Perfil

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/auth/profile` |
| **Descrição do Contrato** | Retorna os dados do utilizador autenticado. Nunca retorna password_hash. |
| **Permissão** | 🔒 Bearer Token |

### Payload (Request Body)

Nenhum.

### Resposta / Status

#### `200 OK`

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "João Silva",
  "email": "joao@email.com",
  "phone": "+244 923 456 789",
  "avatar_url": null,
  "document_url": null,
  "user_type": "seller",
  "is_email_verified": true,
  "created_at": "2025-01-01T10:00:00.000Z"
}
```

---

## 7. Enviar OTP de Ativação

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/otps/send-activation` |
| **Descrição do Contrato** | Envia código OTP de 6 dígitos para o email do utilizador autenticado. |
| **Permissão** | 🔒 Bearer Token |

### Payload (Request Body)

Nenhum.

### Resposta / Status

#### `200 OK`

```json
{
  "message": "OTP de ativação enviado para o seu email"
}
```

---

## 8. Verificar OTP de Ativação

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/otps/verify-activation` |
| **Descrição do Contrato** | Verifica o código OTP e ativa a conta do utilizador. |
| **Permissão** | 🔒 Bearer Token |

### Payload (Request Body)

```json
{
  "otp_code": "123456"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `otp_code` | string | ✅ | Código de 6 dígitos |

### Resposta / Status

#### `200 OK`

```json
{
  "message": "Conta ativada com sucesso"
}
```

---

## 9. Solicitar Reset de Senha

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/otps/request-password-reset` |
| **Descrição do Contrato** | Envia OTP de reset para o email. Mensagem genérica (não revela se email existe). |
| **Permissão** | 🔓 Público |

### Payload (Request Body)

```json
{
  "email": "joao@email.com"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `email` | string | ✅ | Email da conta |

### Resposta / Status

#### `200 OK`

```json
{
  "message": "Se o email existir, receberá um código de verificação"
}
```

---

## 10. Verificar OTP de Reset

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/otps/verify-password-reset` |
| **Descrição do Contrato** | Verifica o OTP de reset. Retorna token para definir nova senha. |
| **Permissão** | 🔓 Público |

### Payload (Request Body)

```json
{
  "email": "joao@email.com",
  "otp_code": "123456"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `email` | string | ✅ | Email da conta |
| `otp_code` | string | ✅ | Código de 6 dígitos |

### Resposta / Status

#### `200 OK`

```json
{
  "message": "Código verificado. Pode definir nova senha.",
  "reset_token": "token-para-definir-nova-senha"
}
```

#### `400 Bad Request`

```json
{
  "statusCode": 400,
  "message": "Código OTP deve ter exatamente 6 dígitos",
  "error": "Bad Request"
}
```

---

## Resumo — Autenticação

| # | Método | Endpoint | Descrição | Permissão |
|---|--------|----------|-----------|-----------|
| 1 | `POST` | `/auth/register` | Registar novo utilizador | 🔓 Público |
| 2 | `POST` | `/auth/login` | Login do utilizador | 🔓 Público |
| 3 | `POST` | `/auth/refresh` | Renovar tokens | 🔓 Público |
| 4 | `POST` | `/auth/logout` | Logout (revogar token) | 🔒 Token |
| 5 | `POST` | `/auth/change-password` | Alterar senha | 🔒 Token |
| 6 | `GET` | `/auth/profile` | Ver perfil | 🔒 Token |
| 7 | `POST` | `/otps/send-activation` | Enviar OTP ativação | 🔒 Token |
| 8 | `POST` | `/otps/verify-activation` | Verificar OTP ativação | 🔒 Token |
| 9 | `POST` | `/otps/request-password-reset` | Solicitar reset senha | 🔓 Público |
| 10 | `POST` | `/otps/verify-password-reset` | Verificar OTP reset | 🔓 Público |

---

## Fluxo de Autenticação

```
┌─────────────────────────────────────────────────────────┐
│                    FLUXO DE LOGIN                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Login → POST /auth/login                             │
│     ↓                                                    │
│  2. Receber access_token + refresh_token                 │
│     ↓                                                    │
│  3. Usar access_token em todas as requisições            │
│     Authorization: Bearer <access_token>                 │
│     ↓                                                    │
│  4. Access token expira (1h)?                            │
│     ↓                                                    │
│  5. Renovar → POST /auth/refresh                         │
│     Body: { refresh_token: "..." }                       │
│     ↓                                                    │
│  6. Receber novos tokens                                 │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

> **Dica para Frontend:** Guarde o `access_token` no `localStorage` e o `refresh_token` em `httpOnly cookie` ou `localStorage`. Implemente um interceptor que renova automaticamente quando receber `401`.
