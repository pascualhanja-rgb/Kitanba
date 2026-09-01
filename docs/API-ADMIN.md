# ⚙️ API — App Admin

> Endpoints do **painel administrativo** para gerir lojas, vendedores, planos, pagamentos e anúncios.

---

## 1. Listar Todas as Lojas

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/stores/admin/all` |
| **Descrição do Contrato** | Lista todas as lojas do marketplace com filtros por status. Inclui dados do proprietário e plano. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Payload (Query Parameters)

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `page` | number | ❌ | Página (padrão: 1) |
| `limit` | number | ❌ | Itens por página (padrão: 20) |
| `status` | string | ❌ | Filtrar por status: `pending_approval`, `active`, `rejected`, `suspended` |

### Resposta / Status

#### `200 OK`

```json
{
  "data": [
    {
      "id": "loja-uuid",
      "name": "Loja do João",
      "slug": "loja-do-joao",
      "status": "active",
      "owner": {
        "id": "vendedor-uuid",
        "name": "João Silva",
        "email": "joao@email.com"
      },
      "plan": {
        "id": 2,
        "name": "Black",
        "tier": "black"
      },
      "subscription_end_date": "2025-02-15T10:00:00.000Z",
      "approved_at": "2025-01-16T10:00:00.000Z",
      "created_at": "2025-01-15T10:00:00.000Z"
    }
  ],
  "total": 50,
  "page": 1,
  "limit": 20
}
```

---

## 2. Aprovar Loja

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/stores/{id}/approve` |
| **Descrição do Contrato** | Muda o status da loja de `pending_approval` para `active`. A loja fica visível publicamente. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Payload (Request Body)

Nenhum.

### Resposta / Status

#### `200 OK`

```json
{
  "id": "loja-uuid",
  "status": "active",
  "message": "Loja aprovada com sucesso"
}
```

---

## 3. Rejeitar Loja

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/stores/{id}/reject` |
| **Descrição do Contrato** | Rejeita uma loja pendente com motivo. O vendedor recebe a notificação. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Payload (Request Body)

```json
{
  "reason": "Logo não segue as diretrizes da plataforma"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `reason` | string | ❌ | Motivo da rejeição |

### Resposta / Status

#### `200 OK`

```json
{
  "id": "loja-uuid",
  "status": "rejected",
  "message": "Loja rejeitada"
}
```

---

## 4. Suspender Loja (Fraude)

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/stores/{id}/suspend` |
| **Descrição do Contrato** | Suspensão por violação das regras (fraude, produtos proibidos). A loja fica invisível. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Payload (Request Body)

```json
{
  "reason": "Venda de produtos proibidos detectada"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `reason` | string | ❌ | Motivo da suspensão |

### Resposta / Status

#### `200 OK`

```json
{
  "id": "loja-uuid",
  "status": "suspended",
  "message": "Loja suspensa"
}
```

---

## 5. Eliminar Loja

| Campo | Valor |
|-------|-------|
| **Método** | `DELETE` |
| **Endpoint** | `/stores/{id}` |
| **Descrição do Contrato** | Elimina uma loja permanentemente. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Payload (Request Body)

Nenhum.

### Resposta / Status

#### `200 OK`

```json
{
  "message": "Loja eliminada com sucesso"
}
```

---

## 6. Status Possíveis de uma Loja

| Status | Significado |
|--------|-------------|
| `pending_approval` | Aguarda aprovação do admin |
| `active` | Loja aprovada e ativa |
| `rejected` | Loja rejeitada pelo admin |
| `suspended` | Loja suspensa (fraude/violação) |

---

## 7. Listar Todos os Utilizadores

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/users` |
| **Descrição do Contrato** | Lista todos os utilizadores do sistema com paginação. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Payload (Query Parameters)

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `page` | number | ❌ | Página (padrão: 1) |
| `limit` | number | ❌ | Itens por página (padrão: 20) |

### Resposta / Status

#### `200 OK`

```json
{
  "data": [
    {
      "id": "user-uuid",
      "name": "Maria Silva",
      "email": "maria@email.com",
      "phone": "+244 923 456 789",
      "user_type": "customer",
      "is_email_verified": true,
      "created_at": "2025-01-10T10:00:00.000Z"
    }
  ],
  "total": 200,
  "page": 1,
  "limit": 20
}
```

---

## 8. Ver Utilizador por ID

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/users/{id}` |
| **Descrição do Contrato** | Retorna todos os dados de um utilizador específico. |
| **Permissão** | 🔒 Bearer Token |

### Payload (Request Body)

Nenhum.

### Resposta / Status

#### `200 OK`

```json
{
  "id": "user-uuid",
  "name": "Maria Silva",
  "email": "maria@email.com",
  "phone": "+244 923 456 789",
  "avatar_url": null,
  "document_url": null,
  "user_type": "customer",
  "is_email_verified": true,
  "created_at": "2025-01-10T10:00:00.000Z"
}
```

---

## 9. Eliminar Utilizador

| Campo | Valor |
|-------|-------|
| **Método** | `DELETE` |
| **Endpoint** | `/users/{id}` |
| **Descrição do Contrato** | Elimina um utilizador permanentemente. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Payload (Request Body)

Nenhum.

### Resposta / Status

#### `200 OK`

```json
{
  "message": "Utilizador eliminado com sucesso"
}
```

---

## 10. Listar Todos os Planos (Admin)

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/plans/admin` |
| **Descrição do Contrato** | Lista todos os planos de assinatura (incluindo desativados). |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Payload (Request Body)

Nenhum.

### Resposta / Status

#### `200 OK`

```json
[
  {
    "id": 1,
    "name": "Normal",
    "tier": "normal",
    "monthly_price": 10000,
    "max_products": 50,
    "allow_flyer_ads": false,
    "allow_banner_ads": false,
    "allow_video_ads": false
  },
  {
    "id": 2,
    "name": "Black",
    "tier": "black",
    "monthly_price": 25000,
    "max_products": 200,
    "allow_flyer_ads": true,
    "allow_banner_ads": false,
    "allow_video_ads": false
  },
  {
    "id": 3,
    "name": "Premium",
    "tier": "premium",
    "monthly_price": 50000,
    "max_products": 0,
    "allow_flyer_ads": true,
    "allow_banner_ads": true,
    "allow_video_ads": true
  }
]
```

---

## 11. Criar Novo Plano

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/plans` |
| **Descrição do Contrato** | Cria um novo plano de assinatura para vendedores. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Payload (Request Body)

```json
{
  "name": "Enterprise",
  "tier": "premium",
  "monthly_price": 100000,
  "max_products": 0,
  "allow_flyer_ads": true,
  "allow_banner_ads": true,
  "allow_video_ads": true
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `name` | string | ✅ | Nome do plano |
| `tier` | string | ✅ | `"normal"`, `"black"` ou `"premium"` |
| `monthly_price` | number | ✅ | Preço mensal em Kz |
| `max_products` | number | ✅ | Limite de produtos (0 = ilimitado) |
| `allow_flyer_ads` | boolean | ✅ | Permite anúncios flyer |
| `allow_banner_ads` | boolean | ✅ | Permite banners |
| `allow_video_ads` | boolean | ✅ | Permite vídeos |

### Resposta / Status

#### `201 Created`

```json
{
  "id": 4,
  "name": "Enterprise",
  "tier": "premium",
  "monthly_price": 100000,
  "max_products": 0,
  "allow_flyer_ads": true,
  "allow_banner_ads": true,
  "allow_video_ads": true
}
```

---

## 12. Atualizar Plano

| Campo | Valor |
|-------|-------|
| **Método** | `PUT` |
| **Endpoint** | `/plans/{id}` |
| **Descrição do Contrato** | Atualiza dados de um plano existente. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Payload (Request Body)

```json
{
  "monthly_price": 30000,
  "max_products": 300
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `name` | string | ❌ | Nome do plano |
| `monthly_price` | number | ❌ | Preço mensal |
| `max_products` | number | ❌ | Limite de produtos |
| `allow_flyer_ads` | boolean | ❌ | Permite flyers |
| `allow_banner_ads` | boolean | ❌ | Permite banners |
| `allow_video_ads` | boolean | ❌ | Permite vídeos |

### Resposta / Status

#### `200 OK`

```json
{
  "id": 2,
  "name": "Black",
  "tier": "black",
  "monthly_price": 30000,
  "max_products": 300,
  "allow_flyer_ads": true,
  "allow_banner_ads": false,
  "allow_video_ads": false
}
```

---

## 13. Desativar Plano

| Campo | Valor |
|-------|-------|
| **Método** | `DELETE` |
| **Endpoint** | `/plans/{id}` |
| **Descrição do Contrato** | Desativa um plano. Lojas existentes mantêm o plano até o fim do ciclo. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Payload (Request Body)

Nenhum.

### Resposta / Status

#### `200 OK`

```json
{
  "message": "Plano desativado com sucesso"
}
```

---

## 14. Listar Todos os Pagamentos

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/subscriptions/admin/all` |
| **Descrição do Contrato** | Lista todos os pagamentos de assinatura de todas as lojas. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Payload (Query Parameters)

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `status` | string | ❌ | Filtrar por: `pending`, `approved`, `rejected` |

### Resposta / Status

#### `200 OK`

```json
[
  {
    "id": "pagamento-uuid",
    "store": {
      "id": "loja-uuid",
      "name": "Loja do João"
    },
    "amount": 25000,
    "status": "pending",
    "payment_proof_url": "https://example.com/comprovativo.pdf",
    "created_at": "2025-01-15T10:00:00.000Z"
  }
]
```

---

## 15. Aprovar Pagamento

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/subscriptions/admin/{id}/approve` |
| **Descrição do Contrato** | Aprova um pagamento de assinatura. Ativa a assinatura da loja. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Payload (Request Body)

Nenhum.

### Resposta / Status

#### `200 OK`

```json
{
  "id": "pagamento-uuid",
  "status": "approved",
  "message": "Pagamento aprovado"
}
```

---

## 16. Rejeitar Pagamento

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/subscriptions/admin/{id}/reject` |
| **Descrição do Contrato** | Rejeita um pagamento de assinatura. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Payload (Request Body)

Nenhum.

### Resposta / Status

#### `200 OK`

```json
{
  "id": "pagamento-uuid",
  "status": "rejected",
  "message": "Pagamento rejeitado"
}
```

---

## 17. Listar Solicitações de Upgrade

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/stores/admin/upgrade-requests` |
| **Descrição do Contrato** | Lista solicitações de upgrade de plano pendentes ou processadas. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Payload (Query Parameters)

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `status` | string | ❌ | Filtrar por: `pending`, `approved`, `rejected` (padrão: `pending`) |

### Resposta / Status

#### `200 OK`

```json
[
  {
    "id": "solicitacao-uuid",
    "store": {
      "id": "loja-uuid",
      "name": "Loja do João"
    },
    "current_plan": {
      "id": 1,
      "name": "Normal"
    },
    "requested_plan": {
      "id": 3,
      "name": "Premium"
    },
    "payment_proof_url": "https://example.com/comprovativo.pdf",
    "status": "pending",
    "created_at": "2025-01-15T10:00:00.000Z"
  }
]
```

---

## 18. Responder à Solicitação de Upgrade

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/stores/admin/upgrade-requests/{requestId}` |
| **Descrição do Contrato** | Aprova ou rejeita uma solicitação de upgrade. Se aprovado, o plano da loja é atualizado automaticamente. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Payload (Request Body)

```json
{
  "status": "approved",
  "admin_notes": "Pagamento verificado. Upgrade processado."
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `status` | string | ✅ | `"approved"` ou `"rejected"` |
| `admin_notes` | string | ❌ | Notas internas |

### Resposta / Status

#### `200 OK`

```json
{
  "id": "solicitacao-uuid",
  "status": "approved",
  "message": "Upgrade aprovado. Plano da loja atualizado."
}
```

---

## 19. Criar Categoria

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/categories` |
| **Descrição do Contrato** | Cria uma nova categoria. Pode ser principal ou subcategoria. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Payload (Request Body)

```json
{
  "name": "Eletrónicos",
  "parent_id": null
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `name` | string | ✅ | Nome da categoria |
| `parent_id` | number | ❌ | ID da categoria mãe (null = principal) |

### Resposta / Status

#### `201 Created`

```json
{
  "id": 1,
  "name": "Eletrónicos",
  "slug": "eletronicos",
  "parent_id": null
}
```

---

## 20. Atualizar Categoria

| Campo | Valor |
|-------|-------|
| **Método** | `PUT` / `PATCH` |
| **Endpoint** | `/categories/{id}` |
| **Descrição do Contrato** | Atualiza dados de uma categoria. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Payload (Request Body)

```json
{
  "name": "Eletrônicos"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `name` | string | ❌ | Nome da categoria |

### Resposta / Status

#### `200 OK`

```json
{
  "id": 1,
  "name": "Eletrônicos",
  "slug": "eletronicos"
}
```

---

## 21. Eliminar Categoria

| Campo | Valor |
|-------|-------|
| **Método** | `DELETE` |
| **Endpoint** | `/categories/{id}` |
| **Descrição do Contrato** | Elimina uma categoria. Subcategorias ficam órfãs (parent_id = null). |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Payload (Request Body)

Nenhum.

### Resposta / Status

#### `200 OK`

```json
{
  "message": "Categoria eliminada com sucesso"
}
```

---

## 22. Criar Atributo para Categoria

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/categories/{id}/attributes` |
| **Descrição do Contrato** | Cria um atributo para uma categoria (ex: Cor, Tamanho, Material). |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Payload (Request Body)

```json
{
  "name": "Cor",
  "type": "text"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `name` | string | ✅ | Nome do atributo |
| `type` | string | ✅ | Tipo: `text`, `select`, `number` |

### Resposta / Status

#### `201 Created`

```json
{
  "id": 1,
  "name": "Cor",
  "type": "text",
  "category_id": 1
}
```

---

## 23. Eliminar Atributo

| Campo | Valor |
|-------|-------|
| **Método** | `DELETE` |
| **Endpoint** | `/categories/attributes/{attributeId}` |
| **Descrição do Contrato** | Elimina um atributo de uma categoria. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Payload (Request Body)

Nenhum.

### Resposta / Status

#### `200 OK`

```json
{
  "message": "Atributo eliminado com sucesso"
}
```

---

## 24. Listar Todos os Anúncios (Admin)

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/advertisements/admin/all` |
| **Descrição do Contrato** | Lista todos os anúncios do sistema com filtros por status. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Payload (Query Parameters)

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `status` | string | ❌ | Filtrar por: `pending_approval`, `active`, `rejected` |

### Resposta / Status

#### `200 OK`

```json
[
  {
    "id": "anuncio-uuid",
    "title": "Promoção de Verão",
    "status": "pending_approval",
    "media_url": "https://example.com/ad-flyer.jpg",
    "start_date": "2025-01-15T10:00:00.000Z",
    "end_date": "2025-01-29T10:00:00.000Z",
    "store": {
      "id": "loja-uuid",
      "name": "Loja do João"
    },
    "ad_plan": {
      "id": 1,
      "name": "Flyer"
    },
    "created_at": "2025-01-15T10:00:00.000Z"
  }
]
```

---

## 25. Aprovar Anúncio

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/advertisements/{id}/approve` |
| **Descrição do Contrato** | Aprova um anúncio. Fica visível por **14 dias** para TODOS os utilizadores (clientes e vendedores). |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Payload (Request Body)

Nenhum.

### Resposta / Status

#### `200 OK`

```json
{
  "message": "Anúncio aprovado",
  "id": "anuncio-uuid",
  "status": "active",
  "start_date": "2025-01-15T10:00:00.000Z",
  "end_date": "2025-01-29T10:00:00.000Z",
  "visible_days": 14
}
```

---

## 26. Rejeitar Anúncio

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/advertisements/{id}/reject` |
| **Descrição do Contrato** | Rejeita um anúncio. Não fica visível para ninguém. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Payload (Request Body)

Nenhum.

### Resposta / Status

#### `200 OK`

```json
{
  "message": "Anúncio rejeitado"
}
```

---

## 27. Eliminar Anúncio

| Campo | Valor |
|-------|-------|
| **Método** | `DELETE` |
| **Endpoint** | `/advertisements/{id}` |
| **Descrição do Contrato** | Elimina um anúncio permanentemente. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Payload (Request Body)

Nenhum.

### Resposta / Status

#### `200 OK`

```json
{
  "message": "Anúncio eliminado"
}
```

---

## 28. Listar Planos de Publicidade (Admin)

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/advertisements/admin/plans` |
| **Descrição do Contrato** | Lista todos os planos de publicidade (incluindo desativados). |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Payload (Request Body)

Nenhum.

### Resposta / Status

#### `200 OK`

```json
[
  {
    "id": 1,
    "name": "Flyer",
    "ad_type": "image",
    "placement": "feed",
    "duration_days": 14,
    "price": 5000,
    "is_active": true
  },
  {
    "id": 2,
    "name": "Banner",
    "ad_type": "image",
    "placement": "store_page",
    "duration_days": 14,
    "price": 15000,
    "is_active": true
  },
  {
    "id": 3,
    "name": "Video Ad",
    "ad_type": "video",
    "placement": "feed",
    "duration_days": 14,
    "price": 30000,
    "is_active": true
  }
]
```

---

## 29. Criar Plano de Publicidade

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/advertisements/admin/plans` |
| **Descrição do Contrato** | Cria um novo plano de publicidade. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Payload (Request Body)

```json
{
  "name": "Destaque",
  "ad_type": "featured",
  "placement": "homepage",
  "duration_days": 14,
  "price": 25000,
  "is_active": true
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `name` | string | ✅ | Nome do plano |
| `ad_type` | string | ✅ | Tipo: `image`, `video`, `featured` |
| `placement` | string | ✅ | Local: `feed`, `store_page`, `homepage` |
| `duration_days` | number | ✅ | Duração em dias (padrão: 14) |
| `price` | number | ✅ | Preço em Kz |
| `is_active` | boolean | ❌ | Ativo (padrão: true) |

### Resposta / Status

#### `201 Created`

```json
{
  "id": 4,
  "name": "Destaque",
  "ad_type": "featured",
  "placement": "homepage",
  "duration_days": 14,
  "price": 25000,
  "is_active": true
}
```

---

## Resumo — App Admin

| # | Método | Endpoint | Descrição | Permissão |
|---|--------|----------|-----------|-----------|
| 1 | `GET` | `/stores/admin/all` | Listar todas as lojas | 🔒 admin |
| 2 | `POST` | `/stores/{id}/approve` | Aprovar loja | 🔒 admin |
| 3 | `POST` | `/stores/{id}/reject` | Rejeitar loja | 🔒 admin |
| 4 | `POST` | `/stores/{id}/suspend` | Suspender loja | 🔒 admin |
| 5 | `DELETE` | `/stores/{id}` | Eliminar loja | 🔒 admin |
| 6 | `GET` | `/users` | Listar utilizadores | 🔒 admin |
| 7 | `GET` | `/users/{id}` | Ver utilizador | 🔒 |
| 8 | `DELETE` | `/users/{id}` | Eliminar utilizador | 🔒 admin |
| 9 | `GET` | `/plans/admin` | Listar planos | 🔒 admin |
| 10 | `POST` | `/plans` | Criar plano | 🔒 admin |
| 11 | `PUT` | `/plans/{id}` | Atualizar plano | 🔒 admin |
| 12 | `DELETE` | `/plans/{id}` | Desativar plano | 🔒 admin |
| 13 | `GET` | `/subscriptions/admin/all` | Listar pagamentos | 🔒 admin |
| 14 | `POST` | `/subscriptions/admin/{id}/approve` | Aprovar pagamento | 🔒 admin |
| 15 | `POST` | `/subscriptions/admin/{id}/reject` | Rejeitar pagamento | 🔒 admin |
| 16 | `GET` | `/stores/admin/upgrade-requests` | Solicitações upgrade | 🔒 admin |
| 17 | `POST` | `/stores/admin/upgrade-requests/{id}` | Responder upgrade | 🔒 admin |
| 18 | `POST` | `/categories` | Criar categoria | 🔒 admin |
| 19 | `PUT` | `/categories/{id}` | Atualizar categoria | 🔒 admin |
| 20 | `DELETE` | `/categories/{id}` | Eliminar categoria | 🔒 admin |
| 21 | `POST` | `/categories/{id}/attributes` | Criar atributo | 🔒 admin |
| 22 | `DELETE` | `/categories/attributes/{id}` | Eliminar atributo | 🔒 admin |
| 23 | `GET` | `/advertisements/admin/all` | Listar anúncios | 🔒 admin |
| 24 | `POST` | `/advertisements/{id}/approve` | Aprovar anúncio | 🔒 admin |
| 25 | `POST` | `/advertisements/{id}/reject` | Rejeitar anúncio | 🔒 admin |
| 26 | `DELETE` | `/advertisements/{id}` | Eliminar anúncio | 🔒 admin |
| 27 | `GET` | `/advertisements/admin/plans` | Planos publicidade | 🔒 admin |
| 28 | `POST` | `/advertisements/admin/plans` | Criar plano pub | 🔒 admin |

---

## Fluxo de Aprovação de Loja

```
┌─────────────────────────────────────────────────────────┐
│           FLUXO DE APROVAÇÃO DE LOJA                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Vendedor cria loja                                    │
│     POST /stores (status: pending_approval)              │
│     ↓                                                    │
│  2. Admin vê lojas pendentes                              │
│     GET /stores/admin/all?status=pending_approval        │
│     ↓                                                    │
│  3. Admin aprova ou rejeita                               │
│     POST /stores/{id}/approve  OU                        │
│     POST /stores/{id}/reject                             │
│     ↓                                                    │
│  4. Loja fica ativa e vendedor pode adicionar produtos   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Fluxo de Upgrade de Plano

```
┌─────────────────────────────────────────────────────────┐
│           FLUXO DE UPGRADE DE PLANO                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Vendedor solicita upgrade                             │
│     POST /stores/{id}/upgrade-request                    │
│     (com comprovativo de pagamento)                      │
│     ↓                                                    │
│  2. Admin vê solicitações pendentes                       │
│     GET /stores/admin/upgrade-requests?status=pending    │
│     ↓                                                    │
│  3. Admin aprova ou rejeita                               │
│     POST /stores/admin/upgrade-requests/{id}             │
│     ↓                                                    │
│  4. Plano da loja é atualizado automaticamente           │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Fluxo de Anúncios (14 dias)

```
┌─────────────────────────────────────────────────────────┐
│           FLUXO DE ANÚNCIOS (14 DIAS)                    │
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

> **Swagger:** Acesse `http://localhost:3000/api/docs` para testar todos os endpoints interativamente.
