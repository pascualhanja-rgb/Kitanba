# 🛒 API 3 — App Cliente

> **Fase 3** — novos serviços a implementar em cima da base da fase 2: catálogo com tipos de produto (físico, aluguer, comida, serviço), variantes, carrinho persistente, alugueres com caução, agendamento de serviços, imóveis, pagamento em prestações e chamadas in-app.
>
> **Tabelas novas / alteradas:** `products` (+ `product_type`, `rental_period_type`, `security_deposit`, `condition_type`, `requires_towing`), `product_variants`, `rentals`, `carts`, `cart_items`, `order_items` (+ `variant_id`, `special_instructions`), `service_details`, `service_bookings`, `store_service_schedules`, `real_estate_details`, `installments`, `call_logs`.
>
> **Convenções gerais**
>
> - Autenticação: `Authorization: Bearer <access_token>` (exceto rotas marcadas como públicas).
> - IDs são UUID v4; valores monetários em **AOA (Kz)**, `DECIMAL(12,2)`, devolvidos como número.
> - Paginação: `?page=1&limit=20` → `{ "data": [...], "meta": { "total", "page", "limit", "totalPages" } }`.
> - Erros: `{ "statusCode": 400, "message": "..." }` (mensagens em português, sem stack trace).

---

## 1. Catálogo por Tipo de Produto

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/products` |
| **Descrição do Contrato** | Lista o catálogo ativo. Passa a aceitar filtros pelo tipo de produto e pelas características de aluguer/estado. Mantém `promotional_price` e `has_active_promotion` da fase 2. |
| **Permissão** | 🌐 Pública |

### Query Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `product_type` | string | ❌ | `physical` \| `rental` \| `food` \| `service` |
| `condition_type` | string | ❌ | `new` \| `used` \| `refurbished` |
| `requires_towing` | boolean | ❌ | Só faz sentido para veículos em aluguer |
| `rental_period_type` | string | ❌ | `hourly` \| `daily` \| `monthly` |
| `category_id` | number | ❌ | Categoria |
| `store_id` | uuid | ❌ | Loja |
| `min_price` / `max_price` | number | ❌ | Faixa de preço |
| `search` | string | ❌ | Título/descrição |
| `page` / `limit` | number | ❌ | Paginação (padrão `1` / `20`) |

### Resposta / Status

#### `200 OK`

```json
{
  "data": [
    {
      "id": "3f8a9c1e-6b7d-4e2f-9a0b-1c2d3e4f5a6b",
      "title": "Gerador Honda 5kVA",
      "product_type": "rental",
      "rental_period_type": "daily",
      "security_deposit": 20000,
      "condition_type": "used",
      "requires_towing": false,
      "price": 15000,
      "stock_quantity": 3,
      "shipping_type": "free",
      "shipping_cost": 0,
      "is_active": true,
      "store": { "id": "44e1f3a2-...", "name": "Loja do João" }
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
}
```

> 💡 `product_type = 'service'` **não** é comprável como item de carrinho — deve ser agendado (§6).

#### `400 Bad Request` — `product_type` fora do enum

---

## 2. Detalhe do Produto (Variantes, Serviço, Imóvel)

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/products/:id` |
| **Descrição do Contrato** | Detalhe do produto. A resposta inclui `variants[]` (quando existirem), `service_details` (tipo `service`) e `real_estate_details` (imóveis), cada um apenas quando aplicável. |
| **Permissão** | 🌐 Pública |

### Resposta / Status

#### `200 OK` — produto de comida com adicionais

```json
{
  "id": "uuid-produto",
  "title": "Frango grelhado",
  "product_type": "food",
  "price": 3500,
  "stock_quantity": 20,
  "variants": [
    { "id": "uuid-variante-1", "name": "Extra: Queijo", "additional_price": 500, "stock_quantity": 50, "is_active": true },
    { "id": "uuid-variante-2", "name": "Tamanho: G", "additional_price": 1000, "stock_quantity": 10, "is_active": true }
  ]
}
```

#### `200 OK` — serviço

```json
{
  "id": "uuid-servico",
  "title": "Limpeza profunda de escritório",
  "product_type": "service",
  "price": 25000,
  "service_details": {
    "pricing_type": "per_sqm",
    "estimated_duration_minutes": 120,
    "requires_site_visit": false
  }
}
```

#### `200 OK` — imóvel

```json
{
  "id": "uuid-imovel",
  "title": "Apartamento T3 no Talatona",
  "product_type": "rental",
  "price": 450000,
  "real_estate_details": {
    "property_type": "apartment",
    "transaction_type": "rent",
    "bedrooms": 3,
    "bathrooms": 2,
    "area_sqm": 120.5,
    "location_address": "Talatona, Luanda",
    "latitude": -8.91500000,
    "longitude": 13.18500000
  }
}
```

#### `404 Not Found` — produto inexistente ou inativo

---

## 3. Carrinho Persistente

> Um carrinho por cliente (`carts.customer_id` é `UNIQUE`). Pode conter produtos de **várias lojas**; o checkout agrupa por loja.

### 3.1 Ver Carrinho

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/cart` |
| **Descrição do Contrato** | Devolve o carrinho do cliente com itens, variantes e totais calculados no servidor. Se não existir, cria um vazio. |
| **Permissão** | 🔒 Bearer Token (role: `customer`) |

```json
{
  "id": "uuid-carrinho",
  "customer_id": "uuid-cliente",
  "updated_at": "2026-11-01T09:00:00.000Z",
  "items": [
    {
      "id": "uuid-item",
      "product_id": "uuid-produto",
      "variant_id": "uuid-variante-2",
      "variant_name": "Tamanho: G",
      "quantity": 2,
      "unit_price": 4500,
      "special_instructions": "Sem cebola",
      "line_total": 9000,
      "product": { "title": "Frango grelhado", "store_id": "uuid-loja" }
    }
  ],
  "subtotal": 9000,
  "shipping_total": 1500,
  "total_amount": 10500
}
```

### 3.2 Adicionar Item

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/cart/items` |
| **Descrição do Contrato** | Adiciona produto/variante ao carrinho. Se o mesmo `product_id` + `variant_id` + `special_instructions` já existir, soma a quantidade. |
| **Permissão** | 🔒 Bearer Token (role: `customer`) |

```json
{
  "product_id": "uuid-produto",
  "variant_id": "uuid-variante-2",
  "quantity": 2,
  "special_instructions": "Sem cebola"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `product_id` | uuid | ✅ | Produto ativo |
| `variant_id` | uuid | ❌ | Variante ativa **do mesmo produto** |
| `quantity` | number | ✅ | Inteiro ≥ 1 |
| `special_instructions` | string | ❌ | Máx. 500 caracteres (ex.: "Sem cebola") |

#### `201 Created` — carrinho atualizado (mesmo formato do §3.1)

#### `400 Bad Request` — `Produto indisponível` / `Estoque insuficiente` / `Variante não pertence a este produto`

#### `400 Bad Request` — `Produtos do tipo service devem ser agendados` (produto de serviço no carrinho)

### 3.3 Atualizar / Remover Item

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `PATCH` | `/cart/items/:itemId` | `{ "quantity": 3, "special_instructions": "..." }` |
| `DELETE` | `/cart/items/:itemId` | Remove o item |
| `DELETE` | `/cart` | Esvazia o carrinho |

#### `403 Forbidden` — item de outro cliente

#### `404 Not Found` — item inexistente

---

## 4. Checkout com Variantes e Instruções

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/orders` |
| **Descrição do Contrato** | Evolui o checkout da fase 2: cada item aceita `variant_id` e `special_instructions`. Preços, frete e total continuam a ser calculados no servidor. `unit_price = preço promocional (se ativo) ou preço base + additional_price da variante`. |
| **Permissão** | 🔒 Bearer Token (role: `customer`) |

### Payload

```json
{
  "store_id": "uuid-loja",
  "delivery_address": "Rua 21 de Janeiro, Casa 45, Luanda",
  "delivery_latitude": -8.839,
  "delivery_longitude": 13.289,
  "delivery_notes": "Casa azul com portão branco",
  "items": [
    {
      "product_id": "uuid-produto",
      "variant_id": "uuid-variante-2",
      "quantity": 2,
      "special_instructions": "Sem cebola"
    }
  ]
}
```

### Resposta / Status

#### `201 Created`

```json
{
  "id": "uuid-pedido",
  "order_number": "PED-2026-0042",
  "store_id": "uuid-loja",
  "subtotal": 9000,
  "shipping_cost": 1500,
  "total_amount": 10500,
  "status": "pending",
  "items": [
    {
      "product_id": "uuid-produto",
      "variant_id": "uuid-variante-2",
      "variant_name": "Tamanho: G",
      "quantity": 2,
      "unit_price": 4500,
      "total_price": 9000,
      "special_instructions": "Sem cebola"
    }
  ]
}
```

#### `400 Bad Request` — `Produto do tipo rental/service não pode ser comprado no checkout. Use /rentals ou /service-bookings`

#### `400 Bad Request` — estoque insuficiente (variante ou produto)

#### `400 Bad Request` — carrinho com produtos de mais de uma loja sem `store_id` explícito

---

## 5. Alugueres

### 5.1 Ver Disponibilidade

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/products/:id/rental-availability` |
| **Descrição do Contrato** | Verifica se o produto está livre no período pedido, descontando alugueres `pending` e `active`. |
| **Permissão** | 🌐 Pública |

| Parâmetro | Tipo | Obrigatório |
|-----------|------|-------------|
| `start_date` | ISO 8601 | ✅ |
| `end_date` | ISO 8601 | ✅ |

```json
{ "available": true, "conflicts": 0, "rental_price": 45000, "security_deposit": 20000 }
```

#### `400 Bad Request` — `Data final deve ser posterior à data inicial`

### 5.2 Solicitar Aluguer

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/rentals` |
| **Descrição do Contrato** | Cria reserva com status `pending`. O servidor calcula `rental_price` conforme `rental_period_type` (hora/dia/mês), copia `security_deposit` do produto e soma: `total_amount = rental_price + security_deposit`. |
| **Permissão** | 🔒 Bearer Token (role: `customer`) |

```json
{
  "product_id": "uuid-produto",
  "start_date": "2026-11-10T08:00:00Z",
  "end_date": "2026-11-13T18:00:00Z",
  "notes": "Preciso de extensão elétrica"
}
```

#### `201 Created`

```json
{
  "id": "uuid-aluguer",
  "customer_id": "uuid-cliente",
  "store_id": "uuid-loja",
  "product_id": "uuid-produto",
  "start_date": "2026-11-10T08:00:00.000Z",
  "end_date": "2026-11-13T18:00:00.000Z",
  "rental_price": 45000,
  "security_deposit": 20000,
  "total_amount": 65000,
  "status": "pending"
}
```

#### `400 Bad Request` — `Produto não está disponível para aluguer` / `Período indisponível`

#### `409 Conflict` — período sobreposto a outro aluguer ativo

### 5.3 Meus Alugueres

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/rentals/my?status=&page=&limit=` | Lista os alugueres do cliente |
| `GET` | `/rentals/:id` | Detalhe (apenas o dono) |
| `PATCH` | `/rentals/:id/cancel` | Cancelar enquanto `pending` |
| `POST` | `/rentals/:id/extend` | Pedir extensão `{ "new_end_date": "..." }` (volta a `pending` de aprovação do vendedor) |

#### `400 Bad Request` — `Só é possível cancelar alugueres pendentes`

#### `403 Forbidden` — aluguer de outro cliente

### 5.4 Estados do Aluguer (visão do cliente)

| Estado | Significado |
|--------|-------------|
| `pending` | Pedido enviado, à espera do vendedor |
| `active` | Equipamento levantado/entregue |
| `returned` | Devolvido e aceite pelo vendedor |
| `overdue` | Prazo terminou sem devolução |
| `damaged` | Devolvido com danos (caução pode ser retida) |
| `cancelled` | Cancelado |

> 💡 A caução (`security_deposit`) é devolvida após a devolução sem danos; em `damaged`, o vendedor regista as notas e a retenção é tratada com o admin.

---

## 6. Serviços — Agendamento

### 6.1 Ver Horários Disponíveis

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/services/:productId/availability` |
| **Descrição do Contrato** | Devolve os blocos de horário da loja (`store_service_schedules`) para os próximos 14 dias, excluindo horários já ocupados por `service_bookings` não cancelados. |
| **Permissão** | 🌐 Pública |

```json
{
  "product_id": "uuid-servico",
  "pricing_type": "fixed",
  "estimated_duration_minutes": 90,
  "requires_site_visit": false,
  "days": [
    {
      "date": "2026-11-03",
      "available": true,
      "slots": ["08:00", "09:30", "11:00", "14:00"]
    }
  ]
}
```

#### `400 Bad Request` — `Loja sem horários de atendimento configurados`

### 6.2 Criar Agendamento

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/service-bookings` |
| **Descrição do Contrato** | Reserva um serviço no horário escolhido. Status inicial `pending`. O valor depende de `pricing_type`: `fixed` (preço do produto), `per_hour` (preço × horas estimadas), `per_sqm` (preço × `area_sqm`), `quote_required` (total `0` até o vendedor enviar orçamento). |
| **Permissão** | 🔒 Bearer Token (role: `customer`) |

```json
{
  "product_id": "uuid-servico",
  "scheduled_date": "2026-11-03",
  "scheduled_time": "09:30",
  "service_address": "Rua 21 de Janeiro, Casa 45, Luanda",
  "service_latitude": -8.839,
  "service_longitude": 13.289,
  "notes_from_customer": "Portão azul. Dois andares.",
  "area_sqm": 120
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `product_id` | uuid | ✅ | Produto `product_type = 'service'` da mesma loja |
| `scheduled_date` | date | ✅ | Data do serviço |
| `scheduled_time` | time | ✅ | Deve cair dentro de um bloco disponível |
| `service_address` | string | ✅ | Endereço onde o serviço é prestado |
| `service_latitude` / `service_longitude` | number | ❌ | Coordenadas do local |
| `notes_from_customer` | string | ❌ | Instruções |
| `area_sqm` | number | ❌ | Obrigatório quando `pricing_type = per_sqm` |

#### `201 Created`

```json
{
  "id": "uuid-agendamento",
  "product_id": "uuid-servico",
  "store_id": "uuid-loja",
  "scheduled_date": "2026-11-03",
  "scheduled_time": "09:30:00",
  "service_address": "Rua 21 de Janeiro, Casa 45, Luanda",
  "status": "pending",
  "total_amount": 25000,
  "requires_quote": false
}
```

#### `400 Bad Request` — `Horário indisponível para esta loja` / `Data no passado`

#### `400 Bad Request` — `Área (m²) é obrigatória para serviços cobrados por metro quadrado`

### 6.3 Gerir Meus Agendamentos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/service-bookings/my?status=&page=&limit=` | Lista agendamentos do cliente |
| `GET` | `/service-bookings/:id` | Detalhe com prestador atribuído |
| `PATCH` | `/service-bookings/:id/cancel` | Cancelar enquanto `pending` ou `confirmed` |
| `PATCH` | `/service-bookings/:id/reschedule` | `{ "scheduled_date": "...", "scheduled_time": "..." }` → status `rescheduled` até confirmação |
| `POST` | `/service-bookings/:id/accept-quote` | Aceita orçamento enviado pelo vendedor |
| `POST` | `/service-bookings/:id/reject-quote` | Recusa orçamento (agendamento fica `cancelled`) |

#### `400 Bad Request` — `Não é possível cancelar um serviço já iniciado`

#### `403 Forbidden` — agendamento de outro cliente

### 6.4 Agendar Visita a Imóvel

> Visitas usam o mesmo fluxo de agendamento. Envie `POST /service-bookings` com o `product_id` do imóvel; a loja confirma a visita como qualquer serviço (`total_amount = 0`).

---

## 7. Imóveis

| Método | Endpoint | Descrição | Permissão |
|--------|----------|-----------|-----------|
| `GET` | `/real-estate` | Lista imóveis com filtros | 🌐 Pública |
| `GET` | `/real-estate/:productId` | Detalhe do imóvel + `real_estate_details` | 🌐 Pública |

### Query Parameters (`GET /real-estate`)

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `transaction_type` | string | `sale` \| `rent` |
| `property_type` | string | `house` \| `apartment` \| `land` \| `commercial` |
| `bedrooms_min` / `bathrooms_min` | number | Mínimo de quartos/casas de banho |
| `area_sqm_min` | number | Área mínima |
| `store_id` / `page` / `limit` | — | Filtros/paginação |

```json
{
  "data": [
    {
      "product_id": "uuid-imovel",
      "title": "Apartamento T3 no Talatona",
      "price": 450000,
      "property_type": "apartment",
      "transaction_type": "rent",
      "bedrooms": 3,
      "bathrooms": 2,
      "area_sqm": 120.5,
      "location_address": "Talatona, Luanda",
      "latitude": -8.915,
      "longitude": 13.185,
      "store": { "id": "uuid-loja", "name": "Imobiliária X" }
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
}
```

> 💡 Para arrendar, use `POST /rentals` (§5.2) com o `product_id` do imóvel. Para comprar/visitar, fale com a loja pelo chat ou agende visita (§6.4).

---

## 8. Pagamento em Prestações

### 8.1 Minhas Parcelas

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/installments/my` |
| **Descrição do Contrato** | Lista as parcelas do cliente (de pedidos e alugueres), com estado e próxima data de vencimento. |
| **Permissão** | 🔒 Bearer Token (role: `customer`) |

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `status` | string | ❌ | `pending` \| `paid` \| `overdue` \| `cancelled` |
| `page` / `limit` | number | ❌ | Paginação |

```json
{
  "data": [
    {
      "id": "uuid-parcela",
      "order_id": "uuid-pedido",
      "rental_id": null,
      "installment_number": 1,
      "total_installments": 3,
      "amount": 3500,
      "due_date": "2026-11-10",
      "status": "pending",
      "paid_at": null,
      "payment_method": null,
      "payment_proof_url": null
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
}
```

### 8.2 Resumo Financeiro

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/installments/my/summary` | `{ "total_pending": 10500, "total_overdue": 0, "next_due_date": "2026-11-10", "paid_this_month": 3500 }` |
| `GET` | `/installments/:id` | Detalhe da parcela (apenas o dono) |

### 8.3 Submeter Comprovativo de Pagamento

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/installments/:id/pay` |
| **Descrição do Contrato** | Anexa o comprovativo (upload presigned → URL) e o método usado. A parcela **continua `pending`** até o vendedor/admin confirmar (§vendedor3.md). |
| **Permissão** | 🔒 Bearer Token (role: `customer`) |

```json
{
  "payment_method": "transferencia",
  "payment_proof_url": "https://cdn.kitanda.ao/proofs/abc123.pdf"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `payment_method` | string | ✅ | `transferencia` \| `multicaixa` \| `dinheiro` \| `express` |
| `payment_proof_url` | string | ❌ | URL do comprovativo (obrigatório para `transferencia`/`multicaixa`) |

#### `200 OK`

```json
{
  "id": "uuid-parcela",
  "status": "pending",
  "payment_proof_url": "https://cdn.kitanda.ao/proofs/abc123.pdf",
  "message": "Comprovativo submetido. Aguarda confirmação do vendedor."
}
```

#### `400 Bad Request` — `Parcela já paga ou cancelada` / `Comprovativo obrigatório para este método`

#### `403 Forbidden` — parcela de outro cliente

---

## 9. Chamadas In-App (Receber)

> 🔐 **Regra crítica de segurança:** o cliente **não pode iniciar chamadas**. Só o **vendedor** ou o **estafeta** iniciam, e apenas durante uma entrega ativa (`deliveries.status = 'out_for_delivery'`). O cliente apenas **recebe**.
>
> Esta regra evita spam e chamadas simultâneas de vários clientes à mesma loja.

### 9.1 Receber Chamada (WebSocket)

| Campo | Valor |
|-------|-------|
| **URL** | `wss://api.kitanda.ao/realtime` (namespace `/realtime`) |
| **Auth** | `{ auth: { token: "<access_token>" } }` no handshake |
| **Descrição do Contrato** | O cliente entra na sala pessoal `user:<id>` (automática) e recebe eventos de chamada. Se o cliente não estiver ligado, a chamada registada fica `missed`. |
| **Permissão** | 🔒 Bearer Token (qualquer utilizador autenticado) |

### Eventos recebidos pelo cliente

```js
socket.on('call:ringing', (payload) => { /* mostrar ecrã de chamada */ });
socket.on('call:offer', async ({ call_id, sdp }) => {
  await pc.setRemoteDescription({ type: 'offer', sdp });
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('call:answer', { call_id, sdp: answer.sdp });
});
socket.on('call:ice-candidate', async ({ candidate }) => {
  await pc.addIceCandidate(candidate);
});
socket.on('call:answered', () => { /* áudio ligado */ });
socket.on('call:ended', () => { /* fechar ecrã */ });
socket.on('call:missed', () => { /* notificação */ });
```

#### `call:ringing`

```json
{
  "call_id": "uuid-chamada",
  "caller_id": "uuid-vendedor",
  "caller_name": "Loja do João",
  "caller_type": "seller",
  "order_id": "uuid-pedido",
  "delivery_id": "uuid-entrega",
  "created_at": "2026-11-01T10:00:00.000Z"
}
```

### 9.2 Responder / Encerrar

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `PATCH` | `/calls/:id/status` | `{ "status": "answered" }` \| `{ "status": "rejected" }` \| `{ "status": "ended" }` |

> Só o destinatário (`receiver_id`) pode responder. O `ended` grava `duration_seconds` a partir de `started_at`.

### 9.3 Histórico de Chamadas

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/calls/my` |
| **Descrição do Contrato** | Chamadas recebidas (e tentativas falhadas) do cliente, com duração e contexto (pedido/entrega). |
| **Permissão** | 🔒 Bearer Token (role: `customer`) |

```json
{
  "data": [
    {
      "id": "uuid-chamada",
      "caller_id": "uuid-vendedor",
      "receiver_id": "uuid-cliente",
      "order_id": "uuid-pedido",
      "delivery_id": "uuid-entrega",
      "status": "ended",
      "duration_seconds": 87,
      "started_at": "2026-11-01T10:00:05.000Z",
      "ended_at": "2026-11-01T10:01:32.000Z"
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
}
```

### 9.4 Tentar Iniciar Chamada (bloqueado)

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/calls` |
| **Descrição do Contrato** | Rota **existe** para o fluxo do vendedor/estafeta. Para `user_type = customer` é **sempre** rejeitada com `403`, mesmo que exista uma entrega ativa. |
| **Permissão** | 🔒 Bearer Token — mas `customer` **nunca** autorizado |

#### `403 Forbidden`

```json
{
  "statusCode": 403,
  "message": "Apenas o vendedor ou o estafeta podem iniciar chamadas."
}
```

> A tentativa é registada no log do servidor para deteção de abuso. Limite global de 20 req/min por IP continua ativo.

### 9.5 Arquitetura WebRTC (Áudio)

> A chamada usa **WebRTC** para o áudio (P2P) e **Socket.IO** apenas para sinalização. O servidor nunca processa nem grava o áudio.

| Camada | Tecnologia | Função |
|--------|-----------|--------|
| Sinalização | Socket.IO (`/realtime`, namespace existente) | Convite, SDP offer/answer, candidatos ICE, estados |
| Media | WebRTC (`RTCPeerConnection`, áudio Opus) | Áudio P2P entre cliente e vendedor/estafeta |
| NAT traversal | STUN público + **TURN (coturn)** | Atravessa NAT/redes móveis (Angola: CGNAT frequente) |
| Auth | JWT no handshake do Socket.IO | Impede sinalização anónima |

#### Configuração ICE no app cliente

```js
const pc = new RTCPeerConnection({
  iceServers: [
    { urls: 'stun:stun.kitanda.ao:3478' },
    {
      urls: 'turn:turn.kitanda.ao:3478',
      username: '<turn_username>',
      credential: '<turn_password>',
    },
  ],
  iceTransportPolicy: 'all', // cair para 'relay' se o P2P falhar
});
```

#### Obter Credenciais ICE

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/calls/ice-config` |
| **Descrição do Contrato** | Devolve `iceServers` com STUN público e TURN efémero (TTL 10 min) para o utilizador autenticado. Usar **antes** de responder à chamada. |
| **Permissão** | 🔒 Bearer Token (role: `customer`) |

#### `200 OK`

```json
{
  "ice_servers": [
    { "urls": "stun:stun.kitanda.ao:3478" },
    {
      "urls": ["turn:turn.kitanda.ao:3478?transport=udp", "turn:turn.kitanda.ao:3478?transport=tcp"],
      "username": "1750000000:uuid-cliente",
      "credential": "base64-hmac-temporario"
    }
  ],
  "ttl_seconds": 600
}
```

> As credenciais TURN são efémeras (HMAC `use-auth-secret` do coturn) para evitar uso abusivo do relay.

#### `401 Unauthorized` — token ausente/inválido

#### Fluxo completo

```text
Vendedor/Estafeta                  Servidor (NestJS)                  Cliente
     │ POST /calls (validação 403)      │                                │
     │─────────────────────────────────▶│ call_logs: initiated           │
     │                                  │─── call:ringing ──────────────▶│
     │◀── call:ringing (eco) ───────────│                                │
     │ getUserMedia({audio:true})       │                                │
     │ createOffer()                    │                                │
     │── call:offer { sdp } ───────────▶│─── call:offer ────────────────▶│
     │                                  │                                │ setRemoteDescription()
     │                                  │                                │ createAnswer()
     │◀── call:answer { sdp } ──────────│◀── call:answer { sdp } ────────│
     │ setRemoteDescription()           │                                │
     │◀──────────── ICE candidates (trickle, ambos os sentidos) ─────────▶│
     │════════════ áudio WebRTC P2P (Opus) / relay TURN se necessário ═══│
     │── call:ended ───────────────────▶│ call_logs: ended (duração)     │
```

#### Permissões e ciclo de vida no app

| Passo | Ação no cliente |
|-------|-----------------|
| 1 | Pedir permissão de microfone (`RECORD_AUDIO` no Android / `NSMicrophoneUsageDescription` no iOS) ao mostrar o ecrã de chamada |
| 2 | Criar `RTCPeerConnection` com `iceServers` de `GET /calls/ice-config` |
| 3 | `pc.onicecandidate` → `socket.emit('call:ice-candidate', { call_id, candidate })` |
| 4 | `pc.onconnectionstatechange` → tratar `connected`, `disconnected`, `failed` |
| 5 | No fim, fechar tracks, `pc.close()` e `PATCH /calls/:id/status` com `ended` |
| 6 | Se ignorar a chamada, `PATCH /calls/:id/status` com `rejected` |

#### Estados de conexão tratados

| Estado | UI / Ação |
|--------|-----------|
| `new` / `connecting` | "A ligar…" (ecrã de chamada) |
| `connected` | Cronómetro da chamada |
| `disconnected` | "A reconectar…" (até 10 s) |
| `failed` | Encerrar, `ended` com `duration_seconds` e mensagem "Chamada indisponível" |
| `closed` | Fechar ecrã e libertar microfone |

> 💡 Se o cliente recusar a permissão do microfone, a chamada fica `rejected` e o vendedor recebe `call:ended`.

---

## 10. Tabela de Erros (Cliente)

| Código | Mensagem | Onde |
|--------|----------|------|
| `400` | `Produto indisponível` | `/cart/items` |
| `400` | `Produtos do tipo rental devem ser alugados via /rentals` | `/cart/items` |
| `400` | `Estoque insuficiente` | `/cart/items`, `/orders` |
| `400` | `Variante não pertence a este produto` | `/cart/items` |
| `400` | `Produtos do tipo rental/service não pode ser comprado no checkout` | `/orders` |
| `400` | `Período indisponível` | `/rentals` |
| `400` | `Horário indisponível para esta loja` | `/service-bookings` |
| `400` | `Área (m²) é obrigatória para serviços cobrados por metro quadrado` | `/service-bookings` |
| `400` | `Parcela já paga ou cancelada` | `/installments/:id/pay` |
| `403` | `Apenas o vendedor ou o estafeta podem iniciar chamadas.` | `POST /calls` |
| `403` | `É necessário um pedido ou entrega em andamento para iniciar a chamada.` | `POST /calls` |
| `403` | `Recurso de outro cliente` | `GET /rentals/:id`, `/service-bookings/:id`, `/installments/:id` |
| `409` | `Período sobreposto a outro aluguer ativo` | `/rentals` |

---

## 11. Regras de Negócio Aplicadas (Resumo)

| # | Regra | Onde |
|---|-------|------|
| 1 | Preços, frete e total calculados no servidor; `additional_price` da variante somado ao preço base | `POST /orders` |
| 2 | Com variantes ativas, o estoque vendável é o da variante (`product_variants.stock_quantity`) | `/cart/items`, `/orders` |
| 3 | Aluguer só para `product_type = 'rental'`, com período válido e sem sobreposição | `POST /rentals` |
| 4 | `total_amount` do aluguer = preço do período + caução; caução retida se `damaged` | `POST /rentals` |
| 5 | Agendamento só em bloco de horário configurado pela loja e dentro dos 14 dias expostos | `POST /service-bookings` |
| 6 | `quote_required` → `total_amount = 0` até orçamento aceite pelo cliente | `POST /service-bookings` |
| 7 | Imóveis expõem `real_estate_details`; visita usa `service-bookings` | `GET /real-estate` |
| 8 | Parcela só fica `paid` após confirmação do vendedor/admin | `/installments/:id/pay` |
| 9 | **Cliente nunca inicia chamada; só recebe** — `403` para `customer` e sem entrega `out_for_delivery` | `POST /calls` |
| 10 | Uma chamada ativa por entrega; novas tentativas após `ended`/`missed` | `POST /calls` |
| 11 | Áudio por **WebRTC P2P** (Opus); servidor só faz sinalização e emissão de credenciais TURN efémeras | `GET /calls/ice-config` |

---

## Anexo A — Modelo de Dados (Fase 3)

> Referência do esquema usado pelos endpoints acima. Migração **aditiva** (novo ficheiro após `1700000000003`), `synchronize` permanece `false`. Valores monetários `DECIMAL(12,2)`; IDs `UUID` com `uuid_generate_v4()`.

| Tabela | Campos principais | Uso no app cliente |
|---------|------------------|--------------------|
| `products` *(ALTER)* | `product_type`, `rental_period_type`, `security_deposit`, `condition_type`, `requires_towing` | Filtros do catálogo (§1) e ficha do produto (§2) |
| `product_variants` | `product_id`, `name`, `additional_price`, `stock_quantity`, `is_active` | Escolha de tamanho/cor/adicionais (§2, §3) |
| `carts` | `customer_id` **UNIQUE**, `updated_at` | Um carrinho por cliente (§3) |
| `cart_items` | `cart_id`, `product_id`, `variant_id`, `quantity`, `special_instructions` | Itens do carrinho (§3) |
| `order_items` *(ALTER)* | `variant_id`, `special_instructions` | Checkout (§4) |
| `rentals` | `customer_id`, `store_id`, `product_id`, `start_date`, `end_date`, `rental_price`, `security_deposit`, `total_amount`, `status`, `notes` | Pedido e acompanhamento de aluguer (§5) |
| `service_details` | `product_id` **UNIQUE**, `pricing_type`, `estimated_duration_minutes`, `requires_site_visit` | Cálculo do serviço (§6) |
| `store_service_schedules` | `store_id`, `day_of_week`, `start_time`, `end_time`, `is_available` | Horários disponíveis (§6.1) |
| `service_bookings` | `product_id`, `scheduled_date`, `scheduled_time`, `service_address`, `service_latitude`, `service_longitude`, `total_amount`, `notes_from_customer`, `status`, `started_at`, `completed_at` | Agendamento e visitas (§6.2) |
| `real_estate_details` | `product_id` **UNIQUE**, `property_type`, `transaction_type`, `bedrooms`, `bathrooms`, `area_sqm`, `location_address`, `latitude`, `longitude` | Listagem de imóveis (§7) |
| `installments` | `order_id`, `rental_id`, `customer_id`, `store_id`, `installment_number`, `total_installments`, `amount`, `due_date`, `status`, `paid_at`, `payment_method`, `payment_proof_url` | Minhas parcelas e comprovativo (§8) |
| `call_logs` | `caller_id`, `receiver_id`, `order_id`, `delivery_id`, `status`, `duration_seconds`, `started_at`, `ended_at` | Histórico de chamadas recebidas (§9) |

### Enums aplicáveis

| Campo | Valores |
|-------|----------|
| `products.product_type` | `physical` \| `rental` \| `food` \| `service` |
| `products.rental_period_type` | `hourly` \| `daily` \| `monthly` |
| `products.condition_type` | `new` \| `used` \| `refurbished` |
| `rentals.status` | `pending` \| `active` \| `returned` \| `overdue` \| `damaged` \| `cancelled` |
| `service_details.pricing_type` | `fixed` \| `per_hour` \| `per_sqm` \| `quote_required` |
| `service_bookings.status` | `pending` \| `confirmed` \| `in_progress` \| `completed` \| `cancelled` \| `rescheduled` |
| `real_estate_details.property_type` | `house` \| `apartment` \| `land` \| `commercial` |
| `real_estate_details.transaction_type` | `sale` \| `rent` |
| `installments.status` | `pending` \| `paid` \| `overdue` \| `cancelled` |
| `call_logs.status` | `initiated` \| `ringing` \| `answered` \| `missed` \| `rejected` \| `ended` |

### Regras de integridade relevantes para o cliente

| Restrição | Efeito |
|-----------|--------|
| `carts.customer_id UNIQUE` | `GET /cart` devolve sempre o mesmo carrinho |
| `product_variants.product_id` `ON DELETE CASCADE` | Variante desaparece com o produto |
| `cart_items.variant_id` `ON DELETE SET NULL` | Item permanece, sem variante |
| `rentals.customer_id` `ON DELETE RESTRICT` | Cliente com aluguer não pode ser eliminado |
| `service_bookings.store_id` `ON DELETE RESTRICT` | Loja com agendamento não pode ser eliminada |
| `installments.order_id`/`rental_id` `ON DELETE CASCADE` | Parcelas acompanham a origem |
| `call_logs.receiver_id` `ON DELETE CASCADE` | Histórico pessoal é removido com a conta |
| Índices | `rentals(customer_id)`, `installments(customer_id)`, `call_logs(receiver_id)`, `service_bookings(customer_id)` mantêm as listagens rápidas |
