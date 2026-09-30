# 🏪 API 2 — App Vendedor

> Endpoints **novos (fase 2)** que o **painel de vendedores** usa para gerir pedidos, entregas, faturação, equipe, lives e campanhas promocionais.

---

## 1. Ver Pedidos da Loja

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/orders/store` |
| **Descrição do Contrato** | Lista os pedidos feitos pelos clientes na loja do vendedor autenticado. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

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
      "delivery_address": "Rua 21 de Janeiro, Casa 45, Luanda",
      "delivery_latitude": -8.83900000,
      "delivery_longitude": 13.28900000,
      "delivery_notes": "Casa azul com portão branco",
      "subtotal": 25000,
      "shipping_cost": 1500,
      "total_amount": 26500,
      "status": "pending",
      "items": [
        { "product_id": "uuid-produto", "quantity": 2, "unit_price": 12500, "total_price": 25000 }
      ]
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
}
```

---

## 2. Confirmar Pedido (Despacho para Entrega)

| Campo | Valor |
|-------|-------|
| **Método** | `PATCH` |
| **Endpoint** | `/orders/:id/confirm` |
| **Descrição do Contrato** | Vendedor aceita o pedido. **Cria automaticamente** um registo em `deliveries` com pickup = endereço/coordenadas da loja, destino = endereço/coordenadas do pedido, e `order_id` associado. |
| **Permissão** | 🔒 Bearer Token (role: `seller`, `admin`) |

> ⚠️ A loja precisa ter `address`, `latitude` e `longitude` preenchidos (via `PUT /stores/:id`). Sem isso, a confirmação falha.

### Resposta / Status

#### `200 OK`

```json
{
  "message": "Pedido confirmado. Entrega criada com sucesso.",
  "order": { "id": "uuid-pedido", "status": "confirmed", "...": "..." },
  "delivery": {
    "id": "uuid-entrega",
    "pickup_address": "Endereço da loja",
    "pickup_latitude": -8.81000000,
    "pickup_longitude": 13.23000000,
    "delivery_address": "Rua 21 de Janeiro, Casa 45, Luanda",
    "status": "pending",
    "fee": 1500
  }
}
```

#### `400 Bad Request` — loja sem coordenadas de pickup ou status inválido

#### `403 Forbidden` — pedido não pertence à loja do vendedor

---

## 3. Atualizar Status do Pedido

| Campo | Valor |
|-------|-------|
| **Método** | `PATCH` |
| **Endpoint** | `/orders/:id/status` |
| **Descrição do Contrato** | Transições de `preparing`, `out_for_delivery`, `delivered`, `cancelled`. Cancelar também cancela a entrega pendente. |
| **Permissão** | 🔒 Bearer Token (role: `seller`, `admin`) |

### Payload

```json
{ "status": "preparing" }
```

---

## 4. Gerir Perfil Fiscal da Loja (Faturação)

### 4.1 Criar

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/billing-profile` |
| **Descrição do Contrato** | Cria o perfil fiscal (dados empresariais ou individuais) usado na emissão de faturas. Sem perfil, a fatura usa os dados do vendedor individual. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

```json
{
  "entity_type": "company",
  "company_name": "Kitanda Comércio Lda",
  "nif": "5417890123",
  "tax_address": "Rua Amílcar Cabral, 123, Luanda",
  "bank_name": "Banco BAI",
  "iban": "AO06004000000000000000000",
  "swift": "BAIPAOLU"
}
```

### 4.2 Consultar / Atualizar

- `GET /billing-profile` → perfil da loja
- `PUT /billing-profile` → atualiza campos (mesmo payload parcial)

#### `400 Bad Request` — `Loja já possui perfil fiscal`

---

## 5. Ver Faturas Emitidas

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/invoices/store` |
| **Descrição do Contrato** | Faturas emitidas pela loja. Faturas são criadas automaticamente quando a entrega fica `delivered`. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

### Marcar como paga / cancelar

- `PATCH /invoices/:id/pay`
- `PATCH /invoices/:id/cancel`

---

## 6. Gerir Equipe / Afiliados

### 6.1 Associar Membro

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/affiliates` |
| **Descrição do Contrato** | Associa um utilizador (por email) à equipe da loja com role `affiliate`, `courier` ou `manager`. Valida o limite do plano antes de criar. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

```json
{ "email": "estafeta@email.com", "role": "courier" }
```

### Resposta / Status

#### `201 Created`

```json
{
  "id": "uuid-afiliado",
  "store_id": "uuid-loja",
  "user_id": "uuid-estafeta",
  "role": "courier",
  "is_active": true
}
```

#### `403 Forbidden`

```json
{ "statusCode": 403, "message": "Limite de afiliados atingido para o plano atual." }
```

> Limites: Normal = 0, Black = 3, Premium = ilimitado.

### 6.2 Gerir Membros

- `GET /affiliates/my` → lista equipe da loja
- `PATCH /affiliates/:id` → alterar role / `is_active`
- `DELETE /affiliates/:id` → remover membro

---

## 7. Transmissões ao Vivo (Lives)

### 7.1 Iniciar

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/lives/start` |
| **Descrição do Contrato** | Inicia live. Valida `seller_plans.allow_live_stream` (apenas Premium). Gera `stream_key` único e fica `live`. Uma única live por vez por loja. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

```json
{ "title": "Sextou com promoções ao vivo!", "description": "Descontos exclusivos" }
```

### Resposta / Status

#### `201 Created`

```json
{
  "id": "uuid-live",
  "store_id": "uuid-loja",
  "title": "Sextou com promoções ao vivo!",
  "stream_key": "uuid-gerado",
  "status": "live",
  "started_at": "2026-09-28T20:00:00.000Z"
}
```

#### `403 Forbidden`

```json
{ "statusCode": 403, "message": "O seu plano não permite realizar transmissões ao vivo." }
```

### 7.2 Outras Rotas

- `PATCH /lives/:id/playback` → `{ "playback_url": "https://cdn.stream.com/live/abc.m3u8" }`
- `POST /lives/:id/end` → finaliza
- `GET /lives/my` → histórico da loja
- `GET /lives/:id/questions` → perguntas destacadas dos espectadores (painel)

---

## 8. Campanhas Promocionais ("Sextou")

### 8.1 Criar Campanha

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/campaigns` |
| **Descrição do Contrato** | Cria campanha com janela de datas e produtos com preço promocional. Quando ativa e dentro da janela, o catálogo público mostra o `promotional_price`. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

```json
{
  "title": "Sextou da Kitanda",
  "campaign_type": "sextou",
  "starts_at": "2026-10-02T18:00:00Z",
  "ends_at": "2026-10-03T23:59:59Z",
  "is_active": true,
  "products": [
    { "product_id": "uuid-produto-1", "promotional_price": 4500 },
    { "product_id": "uuid-produto-2", "promotional_price": 9900 }
  ]
}
```

#### `400 Bad Request` — produto fora da loja ou datas inválidas

### 8.2 Gerir Campanhas

- `GET /campaigns` → campanhas da loja
- `PUT|PATCH /campaigns/:id` → atualizar (pode substituir `products`)
- `PATCH /campaigns/:id/toggle-active` → ativar/desativar
- `DELETE /campaigns/:id` → eliminar

---

## 9. Entregas da Loja

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/deliveries/store` |
| **Descrição do Contrato** | Lista entregas geradas pelos pedidos confirmados da loja, com estafeta atribuído. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

---

## 10. Regras de Negócio Aplicadas (Resumo)

| # | Regra | Onde |
|---|-------|------|
| 1 | Associar afiliado valida `max_affiliates` do plano → `403` "Limite de afiliados atingido para o plano atual." | `POST /affiliates` |
| 1 | Iniciar live valida `allow_live_stream` → `403` "O seu plano não permite realizar transmissões ao vivo." | `POST /lives/start` |
| 2 | Confirmar pedido cria entrega (pickup = loja, destino = cliente) | `PATCH /orders/:id/confirm` |
| 3 | Criar produto valida `max_products` do plano → `403` "Limite de N produtos atingido para o plano atual..." (`0` = ilimitado, apenas Premium) | `POST /products` |
| 3 | Criar anúncio valida o tipo contra `allow_flyer_ads` / `allow_banner_ads` / `allow_video_ads` do plano → `403` "O seu plano não permite anúncios do tipo..." | `POST /advertisements` |
| 4 | Perfil fiscal usado na fatura; fallback para vendedor individual | `POST /billing-profile` |
| 5 | Campanha ativa altera preço retornado no catálogo | `POST /campaigns` |

### Matriz de Permissões por Plano (aplicada no backend)

> Regra rigorosa: hierarquia **Normal < Black < Premium**. Um plano só tem acesso ao que está na sua linha —
> plano Normal **não** acede a recursos Black/Premium; plano Black **não** acede a recursos Premium.

| Recurso | Normal | Black | Premium |
|---------|--------|-------|----------|
| Produtos (`max_products`, `0` = ilimitado) | 50 | 200 | Ilimitado (0) |
| Anúncios flyer (`allow_flyer_ads`) | ❌ | ✅ | ✅ |
| Anúncios banner (`allow_banner_ads`) | ❌ | ❌ | ✅ |
| Anúncios vídeo (`allow_video_ads`) | ❌ | ❌ | ✅ |
| Afiliados/equipe (`max_affiliates`) | 0 | 3 | Ilimitado (999999) |
| Lives (`allow_live_stream`) | ❌ | ❌ | ✅ |

> Contratos (Método/Endpoint/payload/resposta) permanecem inalterados — a validação é interna no service.
