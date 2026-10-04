# 📚 Kitanda API — Documentação Completa

> **Base URL:** `http://localhost:3000`  
> **Swagger Docs:** `http://localhost:3000/api/docs`  
> **Versão:** 1.0

## Visão Geral

A API Kitanda é um **marketplace** onde:
- **Clientes** compram produtos
- **Vendedores** criam lojas e gerem produtos
- **Admins** gerem todo o sistema

```
┌─────────────────────────────────────────────────────────┐
│                    KITANDA API                           │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  CLIENTE  │  │ VENDEDOR │  │  ADMIN   │              │
│  │   App     │  │   App    │  │   App    │              │
│  └─────┬─────┘  └─────┬────┘  └─────┬────┘              │
│        │              │             │                    │
│        └──────────────┼─────────────┘                    │
│                       │                                  │
│              ┌────────┴────────┐                         │
│              │   KITANDA API   │                         │
│              │  (NestJS + PG)  │                         │
│              └─────────────────┘                         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Autenticação

Todas as rotas protegidas precisam de um **Bearer Token** no header:

```
Authorization: Bearer <access_token>
```

### Estrutura do Token JWT

```json
{
  "sub": "uuid-do-utilizador",
  "email": "user@email.com",
  "user_type": "customer | seller | admin",
  "iat": 1700000000,
  "exp": 1700003600
}
```

---

## Sistema de Roles

| Role | Descrição |
|------|-----------|
| `customer` | Cliente comprador |
| `seller` | Vendedor/lojista |
| `admin` | Administrador |

---

## Código de Erros

| Código | Significado |
|--------|-------------|
| `200` | OK — Requisição bem-sucedida |
| `201` | Created — Recurso criado |
| `400` | Bad Request — Dados inválidos |
| `401` | Unauthorized — Não autenticado |
| `403` | Forbidden — Sem permissão |
| `404` | Not Found — Recurso não encontrado |
| `409` | Conflict — Conflito (ex: email já existe) |
| `429` | Too Many Requests — Rate limiting |
| `500` | Internal Server Error |

### Formato da Resposta de Erro

```json
{
  "statusCode": 400,
  "message": ["A senha deve conter pelo menos uma letra maiúscula"],
  "error": "Bad Request"
}
```

---

## Documentação por App

| Documento | App | Descrição |
|-----------|-----|-----------|
| [API-AUTH.md](./API-AUTH.md) | Todos | Autenticação e gestão de sessão |
| [API-CLIENTE.md](./API-CLIENTE.md) | Cliente | Endpoints para compradores |
| [API-VENDEDOR.md](./API-VENDEDOR.md) | Vendedor | Endpoints para lojistas |
| [API-ADMIN.md](./API-ADMIN.md) | Admin | Endpoints administrativos |

---

## Regra de Visibilidade dos Anúncios

Todos os anúncios aprovados são visíveis a **TODOS os utilizadores** (clientes e vendedores) por **14 dias** após aprovação.

```
┌─────────────────────────────────────────────────────────┐
│         CICLO DE VIDA DE UM ANÚNCIO                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Vendedor cria anúncio                                │
│     POST /advertisements (status: pending_approval)      │
│     ↓                                                    │
│  2. Admin aprova                                         │
│     POST /advertisements/{id}/approve                    │
│     ↓                                                    │
│  3. Anúncio fica VISÍVEL por 14 DIAS                     │
│     GET /advertisements/active                           │
│     (visível para clientes E vendedores)                 │
│     ↓                                                    │
│  4. Após 14 dias, anúncio automaticamente invisível      │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

> **Swagger Interativo:** Acesse `http://localhost:3000/api/docs` para testar todos os endpoints.
