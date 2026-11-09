# 🏪 API — App Vendedor (v4)

> Endpoints que o **painel de vendedores** usa para gerir lojas, produtos, anúncios, portfólios, especialidades e orçamentos de serviços.

---

## .. Lista de Endpoint (resumo)
> Os endpoints ## 1 a ## 19 mantêm-se como em `docs/API-VENDEDOR.md`.
> Os novosEndpoints da v4 estão listados em baixo e no resumo final.

---

## 20. Criar Loja

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/stores` |
| **Descrição do Contrato** | Cria uma nova loja. O vendedor só pode criar lojas com planos ativos. A loja fica `pending_approval` até o admin aprovar. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

### Payload (Request Body)

```json
{
  "name": "Loja do João",
  "description": "A melhor loja de Angola",
  "logo_url": "https://example.com/logo.png",
  "banner_url": "https://example.com/banner.jpg",
  "plan_id": 1
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|\n| `name` | string | ✅ | Nome da loja (até 1000 caracteres) |\n| `description` | string | ❌ | Descrição da loja |\n| `logo_url` | string | ❌ | URL do logo (upload primeiro via `/uploads/image`) |\n| `banner_url` | string | ❌ | URL do banner |\n| `plan_id` | number | ✅ | ID do plano (1=Normal, 2=Black, 3=Premium) |

### Resposta / Status

#### `201 Created`

```json
{
  "id": "loja-uuid",
  "name": "Loja do João",
  "slug": "loja-do-joao",
  "status": "pending_approval",
  "plan_id": 1,
  "created_at": "2025-01-15T10:00:00.000Z"
}
```

> ⚠️ A loja fica com status `pending_approval` até o admin aprovar.

#### `403 Forbidden`

```json
{
  "statusCode": 403,
  "message": "Sem permissão",
  "error": "Forbidden"
}
```

#### `403 Forbidden` — plano que não pertence ao vendedor

> Regra: o vendedor só pode usar o plano que lhe pertence. Se já possui loja ativa,
> só pode reutilizar o **mesmo plano**; plano diferente exige upgrade aprovado pelo admin.

```json
{
  "statusCode": 403,
  "message": "Você não tem permissão para usar este plano. Solicite um upgrade ao administrador."
}
```

| Cenário | Resultado |
|---------|-----------|
| Vendedor com loja Normal tenta criar loja com `plan_id: 2` (Black) ou `3` (Premium) | `403 Forbidden` — "Você não tem permissão para usar este plano..." |
| Vendedor com loja Black tenta criar loja com `plan_id: 3` (Premium) | `403 Forbidden` — "Você não tem permissão para usar este plano..." |
| Plano inexistente ou inativo | `403 Forbidden` — "Você não tem permissão para usar este plano." |

---

## 21. Listar Minhas Lojas

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/stores/my` |
| **Descrição do Contrato** | Lista todas as lojas do vendedor autenticado. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

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
      "plan": {
        "id": 2,
        "name": "Black"
      },
      "subscription_end_date": "2025-02-15T10:00:00.000Z",
      "created_at": "2025-01-15T10:00:00.000Z"
    }
  ]
}
```

---

## 22. Ver Minha Loja (por ID)

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/stores/{id}` |
| **Descrição do Contrato** | Retorna todos os dados de uma loja específica. |
| **Permissão** | 🔒 Bearer Token |

### Resposta / Status

#### `200 OK`

```json
{
  "id": "loja-uuid",
  "name": "Loja do João",
  "slug": "loja-do-joao",
  "logo_url": "https://example.com/logo.png",
  "banner_url": "https://example.com/banner.jpg",
  "description": "A melhor loja de Angola",
  "status": "active",
  "plan": {
    "id": 2,
    "name": "Black",
    "tier": "black"
  },
  "subscription_end_date": "2025-02-15T10:00:00.000Z",
  "created_at": "2025-01-15T10:00:00.000Z"
}
```

---

## 23. Atualizar Loja

| Campo | Valor |
|-------|-------|
| **Método** | `PUT` / `PATCH` |
| **Endpoint** | `/stores/{id}` |
| **Descrição do Contrato** | Atualiza dados da loja. O vendedor só pode atualizar as suas próprias lojas. |
| **Permissão** | 🔒 Bearer Token (role: `seller` ou `admin`) |

### Resposta / Status

#### `200 OK`

```json
{
  "id": "loja-uuid",
  "name": "Loja do João - Atualizado",
  "description": "Nova descrição da loja",
  "logo_url": "https://example.com/novo-logo.png",
  "banner_url": "https://example.com/novo-banner.jpg"
}
```

---

## 24. Cadastrar Especialidades da Minha Loja

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/professional-specialties` |
| **Descrição do Contrato** | Lista as especialidades profissionais cadastradas paraansa escolha na hora de criar/atualizar a oferta da loja. |
| **Permissão** | 🔒 Bearer Token |

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
  }
]
```

---

## 25. Atribuir Especialidades à Minha Loja

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/stores/{storeId}/specialties` |
| **Descrição do Contrato** | Vincula uma ou mais especialidades à loja do vendedor (ex: canalização, elétrica, pedreiro). |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

### Payload (Request Body)

```json
{
  "specialty_ids": [1, 2]
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

## 26. Remover Especialidade da Minha Loja

| Campo | Valor |
|-------|-------|
| **Método** | `DELETE` |
| **Endpoint** | `/stores/{storeId}/specialties/{specialtyId}` |
| **Descrição do Contrato** | Remove a vinculação de uma especialidade da loja do vendedor. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

### Resposta / Status

#### `200 OK`

```json
{
  "message": "Especialidade removida da loja"
}
```

---

## 27. Listar Especialidades da Minha Loja

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/stores/{storeId}/specialties` |
| **Descrição do Contrato** | Retorna as especialidades atuais da loja do vendedor. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

### Resposta / Status

#### `200 OK`

```json
[
  {
    "specialty_id": 1,
    "specialty_name": "Canalizador",
    "icon_url": "https://example.com/icons/canalizador.png",
    "description": "Reparação de fugas de água, montagem de tubos, desentupimentos e instalação de loiça sanitária",
    "is_active": true
  },
  {
    "specialty_id": 3,
    "specialty_name": "Eletricista",
    "icon_url": "https://example.com/icons/eletricista.png",
    "description": "Instalações elétricas, quadros elétricos, reparação de curto-circuitos e geradores",
    "is_active": true
  }
]
```

---

## 28. Gerenciar Portfólio da Minha Loja

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/stores/{storeId}/portfolio` |
| **Descrição do Contrato** | Lista os trabalhos/photos de obras apresentadas na loja do vendedor. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

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
  }
]
```

---

## 29. Adicionar Item ao Portfólio

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/stores/{storeId}/portfolio` |
| **Descrição do Contrato** | Adiciona um novo item (obra/foto) ao portfólio da loja do vendedor. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

### Payload (Request Body)

```json
{
  "title": "Instalação de Rede de Água na Talatona",
  "description": "Projeto completo de encanamento residencial",
  "image_url": "https://example.com/portfolio/talaton-novo.jpg"
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
  "id": "portfolio-uuid-novo",
  "store_id": "loja-uuid",
  "title": "Instalação de Rede de Água na Talatona",
  "description": "Projeto completo de encanamento residencial",
  "image_url": "https://example.com/portfolio/talaton-novo.jpg",
  "created_at": "2026-11-04T12:00:00.000Z"
}
```

---

## 30. Atualizar Item do Portfólio

| Campo | Valor |
|-------|-------|
| **Método** | `PUT` / `PATCH` |
| **Endpoint** | `/stores/{storeId}/portfolio/{portfolioId}` |
| **Descrição do Contrato** | Atualiza os dados de um item do portfólio da loja. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

### Payload (Request Body)

```json
{
  "title": "Instalação de Rede de Água e Esgoto na Talatona",
  "description": "Projeto completo de encanamento residencial com videira e vedações",
  "image_url": "https://example.com/portfolio/talaton-atualizado.jpg"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|\n| `title` | string | ❌ | Novo título |
| `description` | string | ❌ | Nova descrição |
| `image_url` | string | ❌ | Nova URL da imagem |

### Resposta / Status

#### `200 OK`

```json
{
  "id": "portfolio-uuid-novo",
  "store_id": "loja-uuid",
  "title": "Instalação de Rede de Água e Esgoto na Talatona",
  "description": "Projeto completo de encanamento residencial com videira e vedações",
  "image_url": "https://example.com/portfolio/talaton-atualizado.jpg",
  "updated_at": "2026-11-04T12:30:00.000Z"
}
```

---

## 31. Remover Item do Portfólio

| Campo | Valor |
|-------|-------|
| **Método** | `DELETE` |
| **Endpoint** | `/stores/{storeId}/portfolio/{portfolioId}` |
| **Descrição do Contrato** | Remove um item do portfólio da loja. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

### Resposta / Status

#### `200 OK`

```json
{
  "message": "Item do portfólio eliminado"
}
```

---

## 32. Listar Solicitações de Orçamento Recebidas

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/service-quote-requests/store/{storeId}` |
| **Descrição do Contrato** | Lista os pedidos de orçamento/endereço técnica recebidos pela loja do vendedor. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

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
      "customer": {
        "id": "customer-uuid",
        "name": "Maria Silva",
        "email": "maria@email.com",
        "phone": "+244 923 456 789"
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
  "total": 3,
  "page": 1,
  "limit": 20
}
```

---

## 33. Ver Detalhes do Orçamento Recebido

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/service-quote-requests/{id}` |
| **Descrição do Contrato** | Retorna os detalhes completos de um pedido de orçamento específico recebido pela loja. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

### Resposta / Status

#### `200 OK`

```json
{
  "id": "quote-uuid",
  "customer": {
    "id": "customer-uuid",
    "name": "Maria Silva",
    "email": "maria@email.com",
    "phone": "+244 923 456 789"
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
  "status": "pending",
  "proposed_price": null,
  "admin_or_provider_notes": null,
  "scheduled_date": null,
  "scheduled_time": null,
  "created_at": "2026-11-04T10:00:00.000Z"
}
```

---

## 34. Enviar Orçamento Proposto

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/service-quote-requests/{id}/quote` |
| **Descrição do Contrato** | Vendedor envia uma proposta de preço para o pedido de orçamento e (opcionalmente) agenda a visita técnica. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

### Payload (Request Body)

```json
{
  "proposed_price": 85000,
  "admin_or_provider_notes": "Visita técnica necessária. Preço contem prismas de materiais e mão de obra.",
  "scheduled_date": "2026-11-10",
  "scheduled_time": "09:00"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|\n| `proposed_price` | number | ✅ | Preço proposto em Kz (ex: 85000) |\n| `admin_or_provider_notes` | string | ❌ | Notas do profissional para o cliente |\n| `scheduled_date` | string | ❌ | Data agendada para a visita (ex: `2026-11-10`) |\n| `scheduled_time` | string | ❌ | Hora agendada (ex: `09:00`) |

### Resposta / Status

#### `200 OK`

```json
{
  "id": "quote-uuid",
  "status": "quoted",
  "proposed_price": 85000,
  "admin_or_provider_notes": "Visita técnica necessária. Preço contem prismas de materiais e mão de obra.",
  "scheduled_date": "2026-11-10",
  "scheduled_time": "09:00:00",
  "updated_at": "2026-11-04T14:00:00.000Z"
}
```

---

## 35. Atualizar Orçamento / Visita Técnica

| Campo | Valor |
|-------|-------|
| **Método** | `PATCH` |
| **Endpoint** | `/service-quote-requests/{id}` |
| **Descrição do Contrato** | Atualiza o estado, preço proposto, notas e/ou agendamento de um pedido de orçamento. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

### Payload (Request Body)

```json
{
  "status": "in_progress",
  "admin_or_provider_notes": "Obra iniciada. Instalação em andamento.",
  "scheduled_date": "2026-11-11",
  "scheduled_time": "10:00"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|\n| `status` | string | ❌ | Novo estado (`pending`, `quoted`, `accepted`, `rejected`, `in_progress`, `completed`, `cancelled`) |
| `proposed_price` | number | ❌ | Preço proposto (se aplicável) |\n| `admin_or_provider_notes` | string | ❌ | Notas do profissional/admin |
| `scheduled_date` | string | ❌ | Data agendada (ex: `2026-11-11`) |\n| `scheduled_time` | string | ❌ | Hora agendada (ex: `10:00`) |

### Resposta / Status

#### `200 OK`

```json
{
  "id": "quote-uuid",
  "status": "in_progress",
  "admin_or_provider_notes": "Obra iniciada. Instalação em andamento.",
  "scheduled_date": "2026-11-11",
  "scheduled_time": "10:00:00",
  "updated_at": "2026-11-04T15:00:00.000Z"
}
```

---

## 36. Iniciar/Completar Orçamento (Estado)

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/service-quote-requests/{id}/state` |
| **Descrição do Contrato** | Alterna o estado do pedido de orçamento para `in_progress` ou `completed`. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

### Payload (Request Body)

```json
{
  "status": "in_progress"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|\n| `status` | string | ✅ | `in_progress` ou `completed` |

### Resposta / Status

#### `200 OK`

```json
{
  "id": "quote-uuid",
  "status": "in_progress",
  "message": "Estado atualizado para 'in_progress'"
}
```

---

## 37. Upload de Imagem para Orçamento

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/uploads/image` |
| **Descrição do Contrato** | Upload de imagem para Cloudinary. Máximo 5MB. Formatos: JPG, PNG, GIF, WebP. |
| **Permissão** | 🔒 Bearer Token |

### Payload (Request Body)

Content-Type: `multipart/form-data`

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|\n| `file` | file | ✅ | Ficheiro de imagem (max 5MB) |

### Resposta / Status

#### `200 OK`

```json
{
  "message": "Imagem enviada com sucesso",
  "url": "https://res.cloudinary.com/xxx/image/upload/xxx.jpg",
  "file_key": "images/1700000000000-a1b2c3d4.jpg"
}
```

---

## Resumo — App Vendedor (v4)

### Endpoints existentes (mantidos)

| # | Método | Endpoint | Descrição | Permissão |
|---|--------|----------|-----------|-----------|
| 1 | `GET` | `/stores/public/{slug}` | Ver loja por URL | 🔓 |\n| ... | . | . | . | . |\n| 19 | `POST` | `/uploads/confirm` | Confirmar upload | 🔒 |

### Novos Endpoints (v4)

| # | Método | Endpoint | Descrição | Permissão |
|---|--------|----------|-----------|-----------|
| 20 | `POST` | `/stores` | Criar loja | 🔒 seller |
| 21 | `GET` | `/stores/my` | Minhas lojas | 🔒 seller |
| 22 | `GET` | `/stores/{id}` | Ver loja | 🔒 |
| 23 | `PUT` | `/stores/{id}` | Atualizar loja | 🔒 seller |
| 24 | `GET` | `/professional-specialties` | Listar especialidades | 🔒 |
| 25 | `POST` | `/stores/{storeId}/specialties` | Atribuir especialidades | 🔒 seller |
| 26 | `DELETE` | `/stores/{storeId}/specialties/{specialtyId}` | Remover especialidade | 🔒 seller |
| 27 | `GET` | `/stores/{storeId}/specialties` | Especialidades da loja | 🔒 seller |
| 28 | `GET` | `/stores/{storeId}/portfolio` | Portfólio da loja | 🔒 seller |
| 29 | `POST` | `/stores/{storeId}/portfolio` | Adicionar item ao portfólio | 🔒 seller |
| 30 | `PUT` | `/stores/{storeId}/portfolio/{portfolioId}` | Atualizar item do portfólio | 🔒 seller |
| 31 | `DELETE` | `/stores/{storeId}/portfolio/{portfolioId}` | Remover item do portfólio | 🔒 seller |
| 32 | `GET` | `/service-quote-requests/store/{storeId}` | Orçamentos recebidos | 🔒 seller |
| 33 | `GET` | `/service-quote-requests/{id}` | Detalhes do orçamento | 🔒 seller |
| 34 | `POST` | `/service-quote-requests/{id}/quote` | Enviar proposta de orçamento | 🔒 seller |
| 35 | `PATCH` | `/service-quote-requests/{id}` | Atualizar orçamento/visita | 🔒 seller |
| 36 | `POST` | `/service-quote-requests/{id}/state` | Iniciar/Completar orçamento | 🔒 seller |
| 37 | `POST` | `/uploads/image` | Upload imagem | 🔒 |

---

> **Fluxo típico do Vendedor (Serviços):**\n> 1. Criar loja → `POST /stores`\n> 2. Atribuir especialidades → `POST /stores/{id}/specialties`\n> 3. Gerenciar portfólio → `GET/POST/PUT/DELETE /stores/{id}/portfolio`\n> 4. Receber solicitações de orçamento → `GET /service-quote-requests/store/{storeId}`\n> 5. Enviar proposta → `POST /service-quote-requests/{id}/quote`\n> 6. Atualizar estado/agendamento → `PATCH /service-quote-requests/{id}`\n> 7. Iniciar/Completar serviço → `POST /service-quote-requests/{id}/state`
