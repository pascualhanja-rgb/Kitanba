# 🔐 AUTH.md — Documentação de Autenticação (Kitanda API)

Documento de referência para o time **cliente (frontend/aplicativo)** sobre como integrar a autenticação da API Kitanda.

---

## 📌 Visão geral

| Forma de entrada | Descrição |
|---|---|
| **Email + senha** | Login tradicional |
| **Telefone + senha** | Login pelo número de telefone cadastrado ✅ **NOVO** |
| **Google / Apple (nativo)** | Login social com 1 clique |
| **OTP (código de 6 dígitos)** | Ativação de conta e reset de senha |

Após qualquer forma de login, a API devolve:
- `access_token` — usado nas chamadas autenticadas (expira curto)
- `refresh_token` — usado para renovar o acesso (expira em ~7 dias)
- objeto `user` com os dados da conta

Todos os endpoints autenticados exigem o header:

```
Authorization: Bearer <access_token>
```

---

## 📝 1. Registo de utilizador

`POST /auth/register`

```json
{
  "name": "João Silva",
  "email": "joao@email.com",
  "password": "MinhaSenh@123!",
  "phone": "+244 923 456 789",      // opcional, mas recomendado
  "user_type": "customer"           // opcional: "customer" | "seller"
}
```

**Regras da senha:** mínimo 8 caracteres, com 1 maiúscula, 1 minúscula, 1 número e 1 caractere especial.

> ⚠️ **Importante:** cada email e cada telefone podem estar ligados a **uma única conta**. Se o telefone já estiver usado, a API responde `409 Conflict` com `"Telefone já está em uso"`.

**Resposta `201`:**

```json
{
  "user": { "id": "uuid", "name": "João Silva", "email": "joao@email.com", "user_type": "customer" },
  "access_token": "eyJ...",
  "refresh_token": "eyJ..."
}
```

---

## 🔑 2. Login

`POST /auth/login` — aceita **email OU telefone** (pelo menos um é obrigatório).

### Opção A — Email

```json
{ "email": "joao@email.com", "password": "MinhaSenh@123!" }
```

### Opção B — Telefone ✅ NOVO

```json
{ "phone": "+244 923 456 789", "password": "MinhaSenh@123!" }
```

> Usa **exatamente o mesmo número** cadastrado no registo (a comparação é literal). Recomenda-se guardar/enviar o telefone no formato escolhido pelo utilizador no registo.

**Resposta `200` (igual para as duas opções):**

```json
{
  "user": { "id": "uuid", "name": "João Silva", "email": "joao@email.com", "phone": "+244 923 456 789", "user_type": "customer" },
  "access_token": "eyJ...",
  "refresh_token": "eyJ..."
}
```

**Erros:**

| Status | Quando |
|---|---|
| `400` | Nenhum identificador informado (`"Informe email ou telefone para entrar"`) |
| `401` | Telefone/email não existe ou senha errada (`"Credenciais inválidas"`) |

---

## 🔄 3. Renovar tokens (refresh)

`POST /auth/refresh`

```json
{ "refresh_token": "eyJ..." }
```

Resposta `200`: novos `access_token` e `refresh_token`. O refresh anterior é **revogado** ao ser usado (uso único).

---

## 🚪 4. Logout

`POST /auth/logout` *(autenticado)*

```json
{ "refresh_token": "eyJ..." }   // opcional, mas recomendado
```

Revoga o refresh token e limpa a sessão no servidor.

---

## 🔒 5. Alterar senha

`POST /auth/change-password`

Três formas de usar:

1. **Autenticado:** header `Authorization: Bearer <access_token>` + `{ "new_password": "..." }` (e `"current_password"` para confirmar).
2. **Via fluxo de reset (OTP):** após verificar o OTP, usar o `reset_token` recebido + `{ "reset_token": "...", "new_password": "..." }`.
3. **Via email:** `{ "email": "...", "new_password": "..." }` conforme fluxo acordado com o backend.

---

## 📱 6. OTP (código de 6 dígitos)

Base: `/otps`

| Endpoint | Uso |
|---|---|
| `POST /otps/send-activation` *(autenticado)* | Envia OTP de ativação da conta |
| `POST /otps/verify-activation` *(autenticado)* | `{"otp_code": "123456"}` — ativa a conta |
| `POST /otps/verify-activation-public` | `{"email": "...", "otp_code": "123456"}` — ativa a conta sem token JWT |
| `POST /otps/request-password-reset` | `{"email": "..."}` — envia OTP de reset de senha |
| `POST /otps/verify-password-reset` | `{"email": "...", "otp_code": "123456"}` — valida o código e habilita a troca de senha |

O código tem **exatamente 6 dígitos**.

---

## 🌍 7. Login social (Google / Apple — nativo, sem Clerk)

- `POST /auth/social` — recebe `{"provider": "google", "token": "<ID Token nativo>", "user_type": "customer"}` do frontend. O backend valida o token diretamente com a Google (`google-auth-library`) ou Apple (JWKS), cria/lia a conta e devolve os mesmos tokens da aplicação. Detalhes em [docs/SOCIAL-CLIENTE.md](docs/SOCIAL-CLIENTE.md) e [docs/SOCIAL-VENDEDOR.md](docs/SOCIAL-VENDEDOR.md).
- `POST /auth/social/link` *(autenticado)* — liga Google/Apple à conta atual (`provider` + `token`).
- `DELETE /auth/social/unlink` *(autenticado)* — desliga a conta social (só se houver senha definida).

> ℹ️ Na app Flutter o token vem dos SDKs nativos (`google_sign_in`, `sign_in_with_apple`); nenhum serviço de terceiros é usado para autenticação.

---

## 👤 8. Perfil

`GET /auth/profile` *(autenticado)* — devolve o utilizador logado (sem senha).

---

## 🧭 Fluxo recomendado no app (cliente)

1. No ecrã de login, permitir alternar entre **Email** e **Telefone** (enviar a chave correspondente: `email` ou `phone`).
2. Guardar o `access_token` em memória/secure storage e o `refresh_token` em secure storage.
3. Ao receber `401` numa chamada comum, tentar `POST /auth/refresh`; se falhar, deslogar e pedir novo login.
4. Sugerir cadastro de telefone no registo — assim o utilizador pode entrar por telefone depois.

> ℹ️ Notas técnicas para o time: validação global ativa (whitelist — não enviar campos extras ou a requisição falha); rate limit geral de 20 req/min por IP.
