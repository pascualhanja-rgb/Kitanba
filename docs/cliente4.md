# 📱 API — App Cliente (v4)

> Endpoints que a **app de clientes** usa para explorar o marketplace, ver lojas, produtos, serviços, portfólios e solicitar orçamentos.

---

## .. Lista de Endpoint (resumo)
> Os endpoints ## 1 a ## 17 mantêm-se como em `docs/API-CLIENTE.md`.
> Os novosEndpoints da v4 estão listados em baixo e no resumo final.

---

## 18. Ver Loja por URL (slug)

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/stores/public/{slug}` |
| **Descrição do Contrato** | Acessa a página pública de uma loja pelo seu "slug" (URL amigável). Retorna dados da loja, plano e dono. |
| **Permissão** | 🔓 Público (sem autenticação) |

### Resposta / Status

#### `200 OK`

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Loja do João",
  "slug": "loja-do-joao",
  "logo_url": "https://example.com/logo.png",
  "banner_url": "https://example.com/banner.jpg",
  "description": "A melhor loja de Angola",
  "status": "active",
  "owner": {
    "id": "vendedor-uuid",
    "name": "João Silva"
  },
  "plan": {
    "id": 2,
    "name": "Black",
    "tier": "black"
  },
  "created_at": "2025-01-01T10:00:00.000Z"
}
```

#### `404 Not Found`

```json
{
  "statusCode": 404,
  "message": "Loja não encontrada",
  "error": "Not Found"
}
```

---

## 19. Listar Especialidades Disponíveis

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/professional-specialties` |
| **Descrição do Contrato** | Lista as especialidades/profições disponíveis para serviços (ex: Canalizador, Pedreiro, Eletricista). |
| **Permissão** | 🔓 Público |

### Resposta / Status

#### `200 OK`

```json
[
  {
    "id": 1,
    "name": "Canalizador",
    "icon_url": "https://example.com/icons/canalizador.png",
    "description": "Reparação de fugas de água, montagem de tubos, desentupimentos e instalação de loiça sanitária"
  },
  {
    "id": 2,
    "name": "Pedreiro",
    "icon_url": "https://example.com/icons/pedreiro.png",
    "description": "Construção civil, assentamento de blocos, reboco, colocação de tijoleira e obras gerais"
  },
  {
    "id": 3,
    "name": "Eletricista",
    "icon_url": "https://example.com/icons/eletricista.png",
    "description": "Instalações elétricas, quadros elétricos, reparação de curto-circuitos e geradores"
  }
]
```

---

## 20. Listar Lojas por Especialidade

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/professional-specialties/{specialtyId}/stores` |
| **Descrição do Contrato** | Lista lojas ativas que oferecem um determinada especialidade profissional. |
| **Permissão** | 🔓 Público |

### Resposta / Status

#### `200 OK`

```json
[
  {
    "id": "store-uuid-1",
    "name": "Loja de Serviços do João",
    "slug": "loja-servicos-joao",
    "logo_url": "https://example.com/logo.png",
    "city": "Luanda",
    "specialty_name": "Canalizador"
  },
  {
    "id": "store-uuid-2",
    "name": "Reparações rápidas",
    "slug": "reparacoes-rapidas",
    "logo_url": "https://example.com/logo2.png",
    "city": "Luanda",
    "specialty_name": "Canalizador"
  }
]
```

---

## 21. Ver Portfólio de uma Loja

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/stores/{storeId}/portfolio` |
| **Descrição do Contrato** | Lista as fotos/works de obras realizadas pela loja prestadora de serviços. |
| **Permissão** | 🔓 Público |

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

## 22. Criar Solicitação de Orçamento / Visita Técnica

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/service-quote-requests` |
| **Descrição do Contrato** | Cliente solicita um orçamento ou visita técnica para um serviço (ex: fuga de água, canalização, instalação elétrica). |
| **Permissão** | 🔒 Bearer Token |

### Payload (Request Body)

```json
{
  "store_id": "store-uuid",
  "specialty_id": 1,
  "title": "Fuga de água na cozinha",
  "description": "Preciso trocar a tubagem que está a pingar por trás da pia",
  "photo_url": "https://example.com/photos/fuga.jpg",
  "address": "Rua Talatona, Luanda",
  "latitude": -8.84000000,
  "longitude": 13.23000000
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|\n| `store_id` | string (UUID) | ✅ | ID da loja prestadora de serviços |\n| `specialty_id` | number | ❌ | ID da especialidade (opcional) |\n| `title` | string | ✅ | Título do problema (até 150 caracteres) |\n| `description` | string | ✅ | Descrição detalhada do problema |\n| `photo_url` | string | ❌ | URL de uma foto do problema (opcional) |\n| `address` | string | ✅ | Endereço onde o trabalho será realizado |\n| `latitude` | number | ❌ | Latitude do local (opcional) |\n| `longitude` | number | ❌ | Longitude do local (opcional) |

### Resposta / Status

#### `201 Created`

```json
{
  "id": "quote-uuid",
  "store_id": "store-uuid",
  "specialty_id": 1,
  "title": "Fuga de água na cozinha",
  "description": "Preciso trocar a tubagem que está a pingar por trás da pia",
  "photo_url": "https://example.com/photos/fuga.jpg",
  "address": "Rua Talatona, Luanda",
  "latitude": -8.84000000,
  "longitude": 13.23000000,
  "status": "pending",
  "created_at": "2026-11-04T10:00:00.000Z"
}
```

---

## 23. Listar Meus Pedidos de Orçamento

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/service-quote-requests` |
| **Descrição do Contrato** | Lista os pedidos de orçamento do cliente autenticado com filtros por estado. |
| **Permissão** | 🔒 Bearer Token |

### Payload (Query Parameters)

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|\n| `page` | number | ❌ | Página (padrão: 1) |\n| `limit` | number | ❌ | Itens por página (padrão: 20) |\n| `status` | string | ❌ | Filtrar por: `pending`, `quoted`, `accepted`, `rejected`, `in_progress`, `completed`, `cancelled` |

### Resposta / Status

#### `200 OK`

```json
{
  "data": [
    {
      "id": "quote-uuid",
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
      "status": "quoted",
      "proposed_price": 85000,
      "admin_or_provider_notes": "Visita técnica realizada. Orçamento apresentado ao cliente.",
      "scheduled_date": "2026-11-10",
      "scheduled_time": "09:00:00",
      "created_at": "2026-11-04T10:00:00.000Z"
    }
  ],
  "total": 2,
  "page": 1,
  "limit": 20
}
```

---

## 24. Ver Pedido de Orçamento por ID

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/service-quote-requests/{id}` |
| **Descrição do Contrato** | Retorna os detalhes completos de um pedido de orçamento específico. |
| **Permissão** | 🔒 Bearer Token |

### Resposta / Status

#### `200 OK`

```json
{
  "id": "quote-uuid",
  "store": {
    "id": "store-uuid",
    "name": "Loja de Serviços do João",
    "slug": "loja-servicos-joao"
  },
  "specialty": {
    "id": 1,
    "name": "Canalizador",
    "icon_url": "https://example.com/icons/canalizador.png",
    "description": "Reparação de fugas de água, montagem de tubos, desentupimentos e instalação de loiça sanitária"
  },
  "title": "Fuga de água na cozinha",
  "description": "Preciso trocar a tubagem que está a pingar por trás da pia",
  "photo_url": "https://example.com/photos/fuga.jpg",
  "address": "Rua Talatona, Luanda",
  "latitude": -8.84000000,
  "longitude": 13.23000000,
  "status": "quoted",
  "proposed_price": 85000,
  "admin_or_provider_notes": "Visita técnica realizada. Orçamento apresentado ao cliente.",
  "scheduled_date": "2026-11-10",
  "scheduled_time": "09:00:00",
  "created_at": "2026-11-04T10:00:00.000Z"
}
```

---

## 25. Aceitar Orçamento

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/service-quote-requests/{id}/accept` |
| **Descrição do Contrato** | Cliente aceita o orçamento proposto e agende a visita técnica. |
| **Permissão** | 🔒 Bearer Token |

### Payload (Request Body)

```json
{
  "scheduled_date": "2026-11-10",
  "scheduled_time": "09:00"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|\n| `scheduled_date` | string | ✅ | Data agendada para a visita (ex: `2026-11-10`) |\n| `scheduled_time` | string | ✅ | Hora agendada (ex: `09:00`) |

### Resposta / Status

#### `200 OK`

```json
{
  "id": "quote-uuid",
  "status": "accepted",
  "scheduled_date": "2026-11-10",
  "scheduled_time": "09:00:00",
  "message": "Orçamento aceite e agendado com sucesso"
}
```

---

## 26. Recusar Orçamento

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/service-quote-requests/{id}/reject` |
| **Descrição do Contrato** | Cliente recusa o orçamento proposto. |
| **Permissão** | 🔒 Bearer Token |

### Resposta / Status

#### `200 OK`

```json
{
  "id": "quote-uuid",
  "status": "rejected",
  "message": "Orçamento recusado pelo cliente"
}
```

---

## Resumo — App Cliente (v4)

### Endpoints existentes (mantidos)

| # | Método | Endpoint | Descrição | Permissão |
|---|--------|----------|-----------|-----------|
| 1 | `GET` | `/stores/public/{slug}` | Ver loja por URL | 🔓 |\n| 2 | `GET` | `/products` | Listar produtos | 🔓 |\n| 3 | `GET` | `/products/{id}` | Ver produto | 🔓 |\n| ... | . | . | . | . |\n| 17 | `PUT` | `/users/{id}` | Atualizar perfil | 🔒 |

### Novos Endpoints (v4)

| # | Método | Endpoint | Descrição | Permissão |
|---|--------|----------|-----------|-----------|
| 18 | `GET` | `/stores/public/{slug}` | Ver loja por URL | 🔓 |
| 19 | `GET` | `/professional-specialties` | Listar especialidades | 🔓 |
| 20 | `GET` | `/professional-specialties/{specialtyId}/stores` | Lojas por especialidade | 🔓 |
| 21 | `GET` | `/stores/{storeId}/portfolio` | Portfólio da loja | 🔓 |
| 22 | `POST` | `/service-quote-requests` | Criar solicitação de orçamento | 🔒 |
| 23 | `GET` | `/service-quote-requests` | Meus pedidos de orçamento | 🔒 |
| 24 | `GET` | `/service-quote-requests/{id}` | Detalhes do orçamento | 🔒 |
| 25 | `POST` | `/service-quote-requests/{id}/accept` | Aceitar orçamento | 🔒 |
| 26 | `POST` | `/service-quote-requests/{id}/reject` | Recusar orçamento | 🔒 |

---

> **Fluxo típico do Cliente (Serviços):**\n> 1. Ver lojas por especialidade → `GET /professional-specialties` + `/stores/by-specialty/{id}`\n> 2. Ver portfólio da loja → `GET /stores/{storeId}/portfolio`\n> 3. Criar solicitação de orçamento → `POST /service-quote-requests`\n> 4. Aguardar proposta → `GET /service-quote-requests`\n> 5. Aceitar ou recusar orçamento → `POST /service-quote-requests/{id}/accept` ou `/reject`
