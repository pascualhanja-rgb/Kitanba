# ⚙️ API — App Admin (v4)

> Endpoints do **painel administrativo** para gerir lojas, vendedores, planos, pagamentos, anúncios, especialidades, portfólios e orçamentos de serviços.

---

## .. Lista de Endpoint (resumo)
> Os endpoints ## 1 a ## 28 mantêm-se como em `docs/API-ADMIN.md`.
> Os novosEndpoints da v4 estão listados em baixo e no resumo final.

---

## 29. Listar Especialidades Profissionais

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/professional-specialties` |
| **Descrição do Contrato** | Lista as especialidades/profições disponíveis (ex: Canalizador, Pedreiro, Eletricista). |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Resposta / Status

#### `200 OK`

```json
[
  {
    "id": 1,
    "name": "Canalizador",
    "icon_url": null,
    "description": "Reparação de fugas de água, montagem de tubos, desentupimentos e instalação de loiça sanitária",
    "is_active": true,
    "created_at": "2026-11-04T10:00:00.000Z"
  },
  {
    "id": 2,
    "name": "Pedreiro",
    "icon_url": null,
    "description": "Construção civil, assentamento de blocos, reboco, colocação de tijoleira e obras gerais",
    "is_active": true,
    "created_at": "2026-11-04T10:00:00.000Z"
  }
]
```

---

## 30. Criar Especialidade Profissional

| Campo | Valor |
|-------|-------|\n| **Método** | `POST` |
| **Endpoint** | `/professional-specialties` |
| **Descrição do Contrato** | Cria uma nova especialidade profissional. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Payload (Request Body)

```json
{
  "name": "Eletricista",
  "icon_url": "https://example.com/icons/electricista.png",
  "description": "Instalações elétricas, quadros elétricos, reparação de curto-circuitos e geradores"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|\n| `name` | string | ✅ | Nome da especialidade (único) |
| `icon_url` | string | ❌ | URL do ícone |
| `description` | string | ❌ | Descrição |

### Resposta / Status

#### `201 Created`

```json
{
  "id": 3,
  "name": "Eletricista",
  "icon_url": "https://example.com/icons/electricista.png",
  "description": "Instalações elétricas, quadros elétricos, reparação de curto-circuitos e geradores",
  "is_active": true,
  "created_at": "2026-11-04T10:00:00.000Z"
}
```

---

## 31. Atualizar Especialidade Profissional

| Campo | Valor |
|-------|-------|\n| **Método** | `PUT` / `PATCH` |
| **Endpoint** | `/professional-specialties/{id}` |
| **Descrição do Contrato** | Atualiza dados de uma especialidade. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Payload (Request Body)

```json
{
  "name": "Eletricista Industrial",
  "icon_url": "https://example.com/icons/electricista-industrial.png",
  "description": "Instalações elétricas industriais e manutenção de quadros de distribuição",
  "is_active": true
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|\n| `name` | string | ❌ | Novo nome (único) |
| `icon_url` | string | ❌ | Nova URL do ícone |
| `description` | string | ❌ | Nova descrição |
| `is_active` | boolean | ❌ | Ativar/desativar |

### Resposta / Status

#### `200 OK`

```json
{
  "id": 3,
  "name": "Eletricista Industrial",
  "icon_url": "https://example.com/icons/electricista-industrial.png",
  "description": "Instalações elétricas industriais e manutenção de quadros de distribuição",
  "is_active": true,
  "updated_at": "2026-11-04T10:00:00.000Z"
}
```

---

## 32. Eliminar Especialidade Profissional

| Campo | Valor |
|-------|-------|\n| **Método** | `DELETE` |
| **Endpoint** | `/professional-specialties/{id}` |
| **Descrição do Contrato** | Elimina uma especialidade profissional. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Resposta / Status

#### `200 OK`

```json
{
  "message": "Especialidade eliminada com sucesso"
}
```

---

## 33. Listar Especialidades de uma Loja

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/stores/{storeId}/specialties` |
| **Descrição do Contrato** | Lista as especialidades associadas a uma loja prestadora de serviços. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Resposta / Status

#### `200 OK`

```json
[
  {
    "specialty_id": 1,
    "specialty_name": "Canalizador",
    "icon_url": null,
    "description": "Reparação de fugas de água, montagem de tubos, desentupimentos e instalação de loiça sanitária",
    "is_active": true
  },
  {
    "specialty_id": 3,
    "specialty_name": "Eletricista",
    "icon_url": "https://example.com/icons/electricista.png",
    "description": "Instalações elétricas, quadros elétricos, reparação de curto-circuitos e geradores",
    "is_active": true
  }
]
```

---

## 34. Atribuir Especialidades a uma Loja

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/stores/{storeId}/specialties` |
| **Descrição do Contrato** | Atribui uma ou mais especialidades a uma loja prestadora. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Payload (Request Body)

```json
{
  "specialty_ids": [1, 3]
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|\n| `specialty_ids` | number[] | ✅ | Lista de IDs de especialidades |

### Resposta / Status

#### `200 OK`

```json
{
  "message": "Especialidades atribuídas com sucesso",
  "count": 2
}
```

---

## 35. Remover Especialidade de uma Loja

| Campo | Valor |
|-------|-------|
| **Método** | `DELETE` |
| **Endpoint** | `/stores/{storeId}/specialties/{specialtyId}` |
| **Descrição do Contrato** | Remove a associação de uma especialidade a uma loja. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Resposta / Status

#### `200 OK`

```json
{
  "message": "Especialidade removida da loja"
}
```

---

## 36. Listar Portfólio de uma Loja

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/stores/{storeId}/portfolio` |
| **Descrição do Contrato** | Lista os trabalhos/photos de obras apresentadas numa loja. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Resposta / Status

#### `200 OK`

```json
[
  {
    "id": "portfolio-uuid-1",
    "title": "Montagem de Tubagem no Talatona",
    "description": "Instalação completa de rede de água e esgoto residencial",
    "image_url": "https://example.com/portfolio/talaton.jpg",
    "created_at": "2026-11-04T10:00:00.000Z"
  },
  {
    "id": "portfolio-uuid-2",
    "title": "Reparação de Fuga em Loja Comercial",
    "description": "Identificação e reparação rápida de vazamento na cozinha",
    "image_url": "https://example.com/portfolio/fuga.jpg",
    "created_at": "2026-11-04T11:30:00.000Z"
  }
]
```

---

## 37. Adicionar Item ao Portfólio

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/stores/{storeId}/portfolio` |
| **Descrição do Contrato** | Adiciona um novo trabalho/foio ao portfólio da loja. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Payload (Request Body)

```json
{
  "title": "Montagem de Tubagem no Talatona",
  "description": "Instalação completa de rede de água e esgoto residencial",
  "image_url": "https://example.com/portfolio/talaton.jpg"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|\n| `title` | string | ✅ | Título do trabalho |
| `description` | string | ❌ | Descrição detalhada |
| `image_url` | string | ✅ | URL da imagem/obra |

### Resposta / Status

#### `201 Created`

```json
{
  "id": "portfolio-uuid-3",
  "store_id": "loja-uuid",
  "title": "Montagem de Tubagem no Talatona",
  "description": "Instalação completa de rede de água e esgoto residencial",
  "image_url": "https://example.com/portfolio/talaton.jpg",
  "created_at": "2026-11-04T12:00:00.000Z"
}
```

---

## 38. Eliminar Item do Portfólio

| Campo | Valor |
|-------|-------|
| **Método** | `DELETE` |
| **Endpoint** | `/stores/{storeId}/portfolio/{portfolioId}` |
| **Descrição do Contrato** | Remove um item do portfólio da loja. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Resposta / Status

#### `200 OK`

```json
{
  "message": "Item do portfólio eliminado"
}
```

---

## 39. Listar Solicitações de Orçamento / Visita Técnica

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/service-quote-requests` |
| **Descrição do Contrato** | Lista pedidos de orçamento/visita técnica com filtros por estado, cliente e loja. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Payload (Query Parameters)

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|\n| `page` | number | ❌ | Página (padrão: 1) |\n| `limit` | number | ❌ | Itens por página (padrão: 20) |\n| `status` | string | ❌ | Filtrar por: `pending`, `quoted`, `accepted`, `rejected`, `in_progress`, `completed`, `cancelled` |\n| `customer_id` | string (UUID) | ❌ | Filtrar por cliente |\n| `store_id` | string (UUID) | ❌ | Filtrar por loja |

### Resposta / Status

#### `200 OK`

```json
{
  "data": [
    {
      "id": "quote-uuid-1",
      "customer": {
        "id": "customer-uuid",
        "name": "Maria Silva",
        "email": "maria@email.com"
      },
      "store": {
        "id": "store-uuid",
        "name": "Loja de Serviços do João"
      },
      "specialty": {
        "id": 1,
        "name": "Canalizador"
      },
      "title": "Fuga de água na cozinha",
      "description": "Preciso trocar a tubagem que está a pingar por trás da pia",
      "photo_url": "https://example.com/photos/fuga.jpg",
      "address": "Rua Talatona, Luanda",
      "latitude": -8.84000000,
      "longitude": 13.23000000,
      "status": "pending",
      "proposed_price": null,
      "admin_or_provider_notes": null,
      "scheduled_date": null,
      "scheduled_time": null,
      "created_at": "2026-11-04T10:00:00.000Z"
    }
  ],
  "total": 5,
  "page": 1,
  "limit": 20
}
```

---

## 40. Ver Pedido de Orçamento por ID

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/service-quote-requests/{id}` |
| **Descrição do Contrato** | Retorna os detalhes de um pedido de orçamento específico. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Resposta / Status

#### `200 OK`

```json
{
  "id": "quote-uuid-1",
  "customer": {
    "id": "customer-uuid",
    "name": "Maria Silva"
  },
  "store": {
    "id": "store-uuid",
    "name": "Loja de Serviços do João"
  },
  "specialty": {
    "id": 1,
    "name": "Canalizador"
  },
  "title": "Fuga de água na cozinha",
  "description": "Preciso trocar a tubagem que está a pingar por trás da pia",
  "photo_url": "https://example.com/photos/fuga.jpg",
  "address": "Rua Talatona, Luanda",
  "latitude": -8.84000000,
  "longitude": 13.23000000,
  "status": "pending",
  "proposed_price": null,
  "admin_or_provider_notes": null,
  "scheduled_date": null,
  "scheduled_time": null,
  "created_at": "2026-11-04T10:00:00.000Z"
}
```

---

## 41. Atualizar Estado e Notas de um Orçamento

| Campo | Valor |
|-------|-------|
| **Método** | `PATCH` |
| **Endpoint** | `/service-quote-requests/{id}` |
| **Descrição do Contrato** | Atualiza o estado, preço proposto e notas internas de um pedido de orçamento. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Payload (Request Body)

```json
{
  "status": "quoted",
  "proposed_price": 85000,
  "admin_or_provider_notes": "Visita técnica realizada. Orçamento apresentado ao cliente."
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|\n| `status` | string | ❌ | Novo estado (`pending`, `quoted`, `accepted`, `rejected`, `in_progress`, `completed`, `cancelled`) |
| `proposed_price` | number | ❌ | Preço proposto pelo profissional |
| `admin_or_provider_notes` | string | ❌ | Notas internas/administrador |
| `scheduled_date` | string | ❌ | Data agendada (ISO 8601, ex: `2026-11-10`) |\n| `scheduled_time` | string | ❌ | Hora agendada (ex: `09:00`) |

### Resposta / Status

#### `200 OK`

```json
{
  "id": "quote-uuid-1",
  "status": "quoted",
  "proposed_price": 85000,
  "admin_or_provider_notes": "Visita técnica realizada. Orçamento apresentado ao cliente.",
  "scheduled_date": "2026-11-10",
  "scheduled_time": "09:00:00",
  "updated_at": "2026-11-04T14:00:00.000Z"
}
```

---

## 42. Confirmar Visita Técnica / Orçamento (aceite)

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/service-quote-requests/{id}/accept` |
| **Descrição do Contrato** | Marca o orçamento como aceite pelo cliente e agenda automaticamente. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Payload (Request Body)

```json
{
  "scheduled_date": "2026-11-10",
  "scheduled_time": "09:00"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|\n| `scheduled_date` | string | ✅ | Data da visita/agendamento |
| `scheduled_time` | string | ✅ | Hora da visita/agendamento |

### Resposta / Status

#### `200 OK`

```json
{
  "id": "quote-uuid-1",
  "status": "accepted",
  "scheduled_date": "2026-11-10",
  "scheduled_time": "09:00:00",
  "message": "Orçamento aceite e agendado"
}
```

---

## 43. Rejeitar Orçamento

| Campo | Valor |
|-------|-------|\n| **Método** | `POST` |
| **Endpoint** | `/service-quote-requests/{id}/reject` |
| **Descrição do Contrato** | Rejeita o pedido de orçamento, apresentando um motivo interno e/finalizando o ciclo para esse pedido. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Payload (Request Body)

```json
{
  "reason": "Cliente optou por outro profissional"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|\n| `reason` | string | ❌ | Motivo da rejeição (interno) |

### Resposta / Status

#### `200 OK`

```json
{
  "id": "quote-uuid-1",
  "status": "rejected",
  "admin_or_provider_notes": "Cliente optou por outro profissional",
  "message": "Orçamento rejeitado"
}
```

---

## 44. Listar Startups por Especialidade (Admin)

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/professional-specialties/{specialtyId}/stores` |
| **Descrição do Contrato** | Lista lojas que oferecem um determinada especialidade profissional. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Resposta / Status

#### `200 OK`

```json
[
  {
    "store_id": "store-uuid",
    "store_name": "Loja de Serviços do João",
    "city": "Luanda",
    "is_active": true
  }
]
```

---

## Resumo — App Admin (v4)

### Endpoints existentes (mantidos)

| # | Método | Endpoint | Descrição | Permissão |
|---|--------|----------|-----------|-----------|\n| 1 | `GET` | `/stores/admin/all` | Listar todas as lojas | 🔒 admin |\n| ... | . | . | . | . |
| 28 | `POST` | `/advertisements/admin/plans` | Criar plano pub | 🔒 admin |

### Novos Endpoints (v4)

| # | Método | Endpoint | Descrição | Permissão |
|---|--------|----------|-----------|-----------|
| 29 | `GET` | `/professional-specialties` | Listar especialidades | 🔒 admin |
| 30 | `POST` | `/professional-specialties` | Criar especialidade | 🔒 admin |
| 31 | `PUT` | `/professional-specialties/{id}` | Atualizar especialidade | 🔒 admin |
| 32 | `DELETE` | `/professional-specialties/{id}` | Eliminar especialidade | 🔒 admin |
| 33 | `GET` | `/stores/{storeId}/specialties` | Especialidades da loja | 🔒 admin |
| 34 | `POST` | `/stores/{storeId}/specialties` | Atribuir especialidades | 🔒 admin |
| 35 | `DELETE` | `/stores/{storeId}/specialties/{specialtyId}` | Remover especialidade da loja | 🔒 admin |
| 36 | `GET` | `/stores/{storeId}/portfolio` | Portfólio da loja | 🔒 admin |
| 37 | `POST` | `/stores/{storeId}/portfolio` | Adicionar item ao portfólio | 🔒 admin |
| 38 | `DELETE` | `/stores/{storeId}/portfolio/{portfolioId}` | Eliminar item do portfólio | 🔒 admin |
| 39 | `GET` | `/service-quote-requests` | Listar pedidos de orçamento | 🔒 admin |
| 40 | `GET` | `/service-quote-requests/{id}` | Detalhes do orçamento | 🔒 admin |
| 41 | `PATCH` | `/service-quote-requests/{id}` | Atualizar orçamento | 🔒 admin |
| 42 | `POST` | `/service-quote-requests/{id}/accept` | Aceitar e agendar | 🔒 admin |
| 43 | `POST` | `/service-quote-requests/{id}/reject` | Rejeitar orçamento | 🔒 admin |
| 44 | `GET` | `/professional-specialties/{specialtyId}/stores` | Lojas por especialidade | 🔒 admin |

---

> **Swagger:** Acesse `http://localhost:3000/api/docs` para testar todos os endpoints interativamente.
