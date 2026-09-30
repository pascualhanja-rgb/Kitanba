# 🛠️ API 2 — App Admin

> Endpoints **novos (fase 2)** que o **painel administrativo** usa para supervisionar pedidos, entregas, faturas e o funcionamento dos novos serviços (afiliados, lives, campanhas).

---

## 1. Listar Todos os Pedidos

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/orders` |
| **Descrição do Contrato** | Lista todos os pedidos da plataforma com filtros por status. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Query Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `page` | number | ❌ | Página (padrão: 1) |
| `limit` | number | ❌ | Itens por página (padrão: 20) |
| `status` | string | ❌ | `pending` \| `confirmed` \| `preparing` \| `out_for_delivery` \| `delivered` \| `cancelled` |

### Resposta / Status

#### `200 OK`

```json
{
  "data": [
    {
      "id": "uuid-pedido",
      "order_number": "PED-2026-0001",
      "customer_id": "uuid-cliente",
      "store_id": "uuid-loja",
      "delivery_address": "Rua 21 de Janeiro, Casa 45, Luanda",
      "delivery_latitude": -8.83900000,
      "delivery_longitude": 13.28900000,
      "subtotal": 25000,
      "shipping_cost": 1500,
      "total_amount": 26500,
      "status": "pending",
      "created_at": "2026-09-28T10:00:00.000Z"
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
}
```

---

## 2. Alterar Status de Pedido

| Campo | Valor |
|-------|-------|
| **Método** | `PATCH` |
| **Endpoint** | `/orders/:id/status` |
| **Descrição do Contrato** | Admin pode forçar transição de status de qualquer pedido (`preparing`, `out_for_delivery`, `delivered`, `cancelled`). Se cancelado, a entrega pendente associada também é cancelada. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Payload (Request Body)

```json
{ "status": "cancelled" }
```

### Resposta / Status

#### `200 OK` — objeto do pedido atualizado

#### `404 Not Found` — pedido não existe

---

## 3. Listar Todas as Faturas

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/invoices` |
| **Descrição do Contrato** | Lista todas as faturas emitidas na plataforma, com filtro por status. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Query Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `page` | number | ❌ | Página (padrão: 1) |
| `limit` | number | ❌ | Itens por página (padrão: 20) |
| `status` | string | ❌ | `draft` \| `issued` \| `paid` \| `cancelled` |

### Resposta / Status

#### `200 OK`

```json
{
  "data": [
    {
      "id": "uuid-fatura",
      "invoice_number": "FT 2026/0001",
      "store_id": "uuid-loja",
      "customer_id": "uuid-cliente",
      "issuer_name": "Kitanda Comércio Lda",
      "issuer_nif": "5417890123",
      "entity_type": "company",
      "subtotal": 25000,
      "tax_amount": 0,
      "total_amount": 26500,
      "download_token": "a1b2c3...hex24",
      "status": "issued",
      "issued_at": "2026-09-28T12:00:00.000Z",
      "items": [
        {
          "description": "Arroz Panga 25kg",
          "quantity": 2,
          "unit_price": 12500,
          "total_price": 25000
        }
      ]
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
}
```

---

## 4. Marcar Fatura como Paga / Cancelar Fatura

| Campo | Valor |
|-------|-------|
| **Método** | `PATCH` |
| **Endpoint** | `/invoices/:id/pay` ou `/invoices/:id/cancel` |
| **Descrição do Contrato** | Admin pode marcar uma fatura como paga ou cancelá-la. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Resposta / Status

#### `200 OK` — fatura atualizada

#### `400 Bad Request` — fatura já cancelada

---

## 5. Supervisão de Entregas

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/deliveries/:id` |
| **Descrição do Contrato** | Admin pode ver qualquer entrega, incluindo estafeta atribuído, rota e status. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Resposta / Status

#### `200 OK`

```json
{
  "id": "uuid-entrega",
  "store_id": "uuid-loja",
  "courier_id": "uuid-estafeta",
  "customer_id": "uuid-cliente",
  "order_id": "uuid-pedido",
  "pickup_address": "Endereço da loja",
  "delivery_address": "Endereço do cliente",
  "status": "in_transit",
  "fee": 1500,
  "created_at": "2026-09-28T10:05:00.000Z"
}
```

#### `200 OK` (histórico de rastreamento)

`GET /deliveries/:id/track/history` retorna todas as posições registadas:

```json
{
  "data": [
    {
      "latitude": -8.83900000,
      "longitude": 13.28900000,
      "heading": 45.5,
      "speed": 32.4,
      "created_at": "2026-09-28T10:10:00.000Z"
    }
  ]
}
```

---

## 6. Gestão de Planos (Afiliados e Lives)

> As colunas `max_affiliates` e `allow_live_stream` foram adicionadas a `seller_plans`:
>
> | Plano | max_affiliates | allow_live_stream |
> |-------|----------------|-------------------|
> | normal | 0 | false |
> | black | 3 | false |
> | premium | 999999 (ilimitado) | true |
>
> O admin gere esses valores pelas rotas existentes de planos (`/plans`). As validações abaixo são aplicadas automaticamente pela API:

| Validação | Resposta |
|-----------|----------|
| Loja Black tenta associar 4º afiliado | `403 Forbidden` — `"Limite de afiliados atingido para o plano atual."` |
| Loja Normal/Black tenta iniciar live | `403 Forbidden` — `"O seu plano não permite realizar transmissões ao vivo."` |
| Vendedor tenta usar plano que não lhe pertence (criar loja com outro `plan_id`) | `403 Forbidden` — `"Você não tem permissão para usar este plano. Solicite um upgrade ao administrador."` |
| Upgrade para plano igual/inferior ou plano inativo | `400` / `403 Forbidden` — `"Você não tem permissão para usar este plano..."` |
| Admin tenta aprovar mudança para plano não-superior | `403 Forbidden` — `"Você não tem permissão para usar este plano. A mudança só é permitida para um plano superior."` |

---

## 7. Ver Faturas por Download Token (Auditoria)

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/invoices/download/:token` |
| **Descrição do Contrato** | Rota pública usada pelos clientes para baixar o PDF. O admin pode auditar o mesmo link (retorna PDF com `Content-Type: application/pdf`). |
| **Permissão** | 🌐 Pública (token único de 48 caracteres hex) |

### Resposta / Status

#### `200 OK` — Stream do PDF da fatura

#### `404 Not Found` — token inválido

#### `400 Bad Request` — fatura cancelada

---

## 8. Regras de Negócio Aplicadas (Resumo)

| # | Regra | Onde |
|---|-------|------|
| 1 | Limite de afiliados por plano → `403` "Limite de afiliados atingido para o plano atual." | `POST /affiliates` |
| 1 | Live sem permissão de plano → `403` "O seu plano não permite realizar transmissões ao vivo." | `POST /lives/start` |
| 2 | Aceite do pedido cria entrega com pickup da loja → destino do cliente | `PATCH /orders/:id/confirm` |
| 3 | Posição do estafeta gera log + evento WebSocket `courier:position` | `POST /deliveries/:id/track` |
| 4 | Entrega `delivered` → pedido `delivered` + fatura emitida automaticamente | `PATCH /deliveries/:id/status` |
| 5 | Produto em campanha ativa retorna `promotional_price` + `has_active_promotion: true` | `GET /products` |
