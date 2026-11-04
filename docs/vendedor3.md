# 🏪 API 3 — App Vendedor

> **Fase 3** — novos serviços a implementar no painel do vendedor: publicar catálogo com tipo de produto e variantes, gerir alugueres com caução, configurar serviços e horários, gerir agendamentos, publicar imóveis, criar e acompanhar prestações e iniciar chamadas in-app para o cliente.
>
> **Tabelas novas / alteradas:** `products` (+ tipo, condição, caução, reboque), `product_variants`, `rentals`, `carts`/`cart_items` (uso indireto), `order_items` (+ variante/instruções), `service_details`, `service_bookings`, `store_service_schedules`, `real_estate_details`, `installments`, `call_logs`.
>
> **Convenções**
>
> - Autenticação: `Authorization: Bearer <access_token>`, role `seller`.
> - Escopo de loja: o `store_id` é sempre resolvido do utilizador autenticado (`stores.owner_id`) — nunca vem do payload.
> - Valores em **AOA (Kz)**, `DECIMAL(12,2)`; datas ISO 8601; horas `HH:mm`.
> - Paginação padrão `?page=1&limit=20` → `{ data, meta }`.

---

## 1. Publicar Produto por Tipo

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/products` |
| **Descrição do Contrato** | Evolui a criação de produto da fase 2 com `product_type` e os campos específicos de cada tipo. Se `product_type = 'service'`, cria automaticamente o registo em `service_details`. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

### Payload — físico (boutique)

```json
{
  "title": "Camisa Oxford",
  "description": "Algodão 100%",
  "price": 12000,
  "stock_quantity": 10,
  "category_id": 3,
  "shipping_type": "paid",
  "shipping_cost": 1500,
  "product_type": "physical",
  "condition_type": "new"
}
```

### Payload — aluguer (equipamento/veículo)

```json
{
  "title": "Gerador Honda 5kVA",
  "price": 15000,
  "stock_quantity": 3,
  "category_id": 7,
  "shipping_type": "free",
  "product_type": "rental",
  "rental_period_type": "daily",
  "security_deposit": 20000,
  "condition_type": "used",
  "requires_towing": false
}
```

### Payload — comida (com adicionais)

```json
{
  "title": "Frango grelhado",
  "price": 3500,
  "stock_quantity": 20,
  "category_id": 12,
  "shipping_type": "free",
  "product_type": "food",
  "condition_type": "new",
  "variants": [
    { "name": "Tamanho: G", "additional_price": 1000, "stock_quantity": 10 },
    { "name": "Extra: Queijo", "additional_price": 500, "stock_quantity": 50 }
  ]
}
```

### Payload — serviço

```json
{
  "title": "Limpeza profunda de escritório",
  "price": 25000,
  "stock_quantity": 0,
  "category_id": 20,
  "shipping_type": "free",
  "product_type": "service",
  "service_details": {
    "pricing_type": "per_sqm",
    "estimated_duration_minutes": 120,
    "requires_site_visit": false
  }
}
```

### Validação por Tipo

| Tipo | Campos obrigatórios | Regras |
|------|---------------------|--------|
| `physical` | `condition_type` | Estoque ≥ 1 |
| `rental` | `rental_period_type`, `security_deposit`, `condition_type` | `security_deposit` ≥ 0; `requires_towing` só para veículos |
| `food` | — | Variantes tratadas como adicionais (preço somado) |
| `service` | `service_details.pricing_type` | `stock_quantity` ignorado; agendamento obrigatório |

#### `201 Created` — objeto do produto com os campos da fase 3

#### `400 Bad Request` — `Produto do tipo rental exige rental_period_type e security_deposit`

#### `400 Bad Request` — `Produto do tipo service exige service_details`

#### `403 Forbidden` — limite `max_products` do plano atingido (mantém regra da fase 2)

### Atualizar Produto

| Método | Endpoint | Observação |
|--------|----------|------------|
| `PUT/PATCH` | `/products/:id` | `product_type` **não pode** ser alterado após existirem pedidos/alugueres |
| `PATCH` | `/products/:id/toggle-active` | Mantém-se |

#### `400 Bad Request` — `Tipo de produto não pode ser alterado depois de vendido ou alugado`

---

## 2. Variantes do Produto

### 2.1 Listar

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/products/:id/variants` |
| **Descrição do Contrato** | Lista variantes (ativas e inativas) do produto da minha loja. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

### 2.2 Criar

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/products/:id/variants` |
| **Descrição do Contrato** | Cria variação (tamanho/cor) ou adicional (comida). Preço final no checkout = preço do produto + `additional_price`. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

```json
{ "name": "Tamanho: G / Cor: Vermelho", "additional_price": 1500, "stock_quantity": 8 }
```

#### `201 Created`

```json
{
  "id": "uuid-variante",
  "product_id": "uuid-produto",
  "name": "Tamanho: G / Cor: Vermelho",
  "additional_price": 1500,
  "stock_quantity": 8,
  "is_active": true
}
```

#### `403 Forbidden` — produto de outra loja

### 2.3 Atualizar / Desativar

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `PATCH` | `/product-variants/:id` | `{ "name", "additional_price", "stock_quantity", "is_active" }` |
| `DELETE` | `/product-variants/:id` | Desativa (`is_active = false`) — histórico preservado |

> ⚠️ Se o produto tiver variantes ativas, o estoque vendável passa a ser **o de cada variante**. O `stock_quantity` do produto deixa de ser usado no checkout.

---

## 3. Alugueres (Gestão)

### 3.1 Listar Alugueres da Loja

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/rentals/store` |
| **Descrição do Contrato** | Lista alugueres da loja com cliente, produto e período. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `status` | string | `pending` \| `active` \| `returned` \| `overdue` \| `damaged` \| `cancelled` |
| `from` / `to` | date | Filtro por `start_date` |
| `page` / `limit` | number | Paginação |

### 3.2 Agenda de Ocupação

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/rentals/calendar?month=2026-11` | Alugueres do mês agrupados por produto (evita sobreposição) |
| `GET` | `/rentals/:id` | Detalhe (cliente, caução, notas) |

### 3.3 Ativar Aluguer (entrega/levantamento)

| Campo | Valor |
|-------|-------|
| **Método** | `PATCH` |
| **Endpoint** | `/rentals/:id/activate` |
| **Descrição do Contrato** | `pending` → `active`. Regista o início efetivo e valida que o produto está disponível no período. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

#### `200 OK`

```json
{ "id": "uuid-aluguer", "status": "active", "total_amount": 65000 }
```

#### `400 Bad Request` — `Aluguer não está pendente` / `Produto indisponível no período`

#### `403 Forbidden` — aluguer de outra loja

### 3.4 Registar Devolução

| Campo | Valor |
|-------|-------|
| **Método** | `PATCH` |
| **Endpoint** | `/rentals/:id/return` |
| **Descrição do Contrato** | Fecha o aluguer. Sem danos → `returned` (caução devolvida). Com danos → `damaged` e a caução pode ser retida, com notas registadas. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

```json
{ "condition_on_return": "damaged", "notes": "Ecrã riscado; retenção de 50% da caução." }
```

#### `200 OK`

```json
{ "id": "uuid-aluguer", "status": "damaged", "security_deposit": 20000, "notes": "Ecrã riscado; retenção de 50% da caução." }
```

#### `400 Bad Request` — `Só é possível devolver alugueres ativos ou em atraso`

### 3.5 Cancelar / Extensão

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `PATCH` | `/rentals/:id/cancel` | Cancelar `pending`; se `active`, apenas com justificação |
| `PATCH` | `/rentals/:id/extend` | Aprovar extensão pedida pelo cliente `{ "new_end_date": "..." }` (recalcula preço) |

> Alugueres `active` com `end_date` ultrapassada passam a `overdue` por job diário (`@nestjs/schedule`).

---

## 4. Serviços — Detalhes e Horários

### 4.1 Definir Detalhes do Serviço

| Campo | Valor |
|-------|-------|
| **Método** | `PUT` |
| **Endpoint** | `/services/:productId/details` |
| **Descrição do Contrato** | Cria/atualiza `service_details` do produto (`product_type = 'service'`). |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

```json
{
  "pricing_type": "per_hour",
  "estimated_duration_minutes": 90,
  "requires_site_visit": true
}
```

| `pricing_type` | Cálculo do valor |
|----------------|------------------|
| `fixed` | Preço do produto |
| `per_hour` | Preço × horas estimadas (`estimated_duration_minutes / 60`) |
| `per_sqm` | Preço × `area_sqm` informada pelo cliente |
| `quote_required` | `0` até o vendedor enviar orçamento |

#### `400 Bad Request` — `Produto não é do tipo service` / `pricing_type inválido`

#### `403 Forbidden` — produto de outra loja

### 4.2 Configurar Horários de Atendimento

| Campo | Valor |
|-------|-------|
| **Método** | `PUT` |
| **Endpoint** | `/services/schedule` |
| **Descrição do Contrato** | Substitui a semana de disponibilidade da loja (`store_service_schedules`). Um registo por dia (`UNIQUE store_id + day_of_week`). |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

```json
{
  "days": [
    { "day_of_week": 1, "start_time": "08:00", "end_time": "17:00", "is_available": true },
    { "day_of_week": 2, "start_time": "08:00", "end_time": "17:00", "is_available": true },
    { "day_of_week": 6, "start_time": "09:00", "end_time": "13:00", "is_available": true },
    { "day_of_week": 0, "start_time": "00:00", "end_time": "00:00", "is_available": false },
    { "day_of_week": 3, "start_time": "00:00", "end_time": "00:00", "is_available": false },
    { "day_of_week": 4, "start_time": "00:00", "end_time": "00:00", "is_available": false },
    { "day_of_week": 5, "start_time": "00:00", "end_time": "00:00", "is_available": false }
  ]
}
```

#### `200 OK` — `{ "store_id": "uuid-loja", "days": [ ... ] }`

#### `400 Bad Request` — `start_time deve ser anterior a end_time` / `day_of_week fora do intervalo 0-6`

> ⚠️ Sem horários configurados, `GET /services/:productId/availability` devolve `400` e o cliente não consegue agendar.

### 4.3 Consultar Horários

- `GET /services/schedule` → semana configurada
- `GET /services/schedule/slots?date=2026-11-03&product_id=uuid` → blocos livres nesse dia

---

## 5. Agendamentos (Gestão)

### 5.1 Listar Agendamentos da Loja

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/service-bookings/store` |
| **Descrição do Contrato** | Agenda de serviços da loja com cliente, morada e prestador atribuído. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `date` | date | Dia específico (padrão: hoje) |
| `status` | string | `pending` \| `confirmed` \| `in_progress` \| `completed` \| `cancelled` \| `rescheduled` |
| `page` / `limit` | number | Paginação |

### 5.2 Confirmar

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `PATCH` | `/service-bookings/:id/confirm` | `pending` → `confirmed`. Valida que o horário ainda está livre. |

#### `400 Bad Request` — `Horário já não está disponível`

### 5.3 Reagendar (pelo vendedor)

| Campo | Valor |
|-------|-------|
| **Método** | `PATCH` |
| **Endpoint** | `/service-bookings/:id/reschedule` |
| **Descrição do Contrato** | Altera data/hora e mantém o agendamento `rescheduled` até o cliente aceitar ou até nova confirmação. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

```json
{ "scheduled_date": "2026-11-04", "scheduled_time": "14:00", "notes": "Equipa indisponível no dia anterior." }
```

### 5.4 Enviar Orçamento

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `PATCH` | `/service-bookings/:id/quote` | `{ "total_amount": 42000, "notes": "Inclui material." }` — obrigatório para `pricing_type = quote_required`. O cliente aceita em `POST /service-bookings/:id/accept-quote`. |

#### `400 Bad Request` — `Orçamento não é aplicável a este tipo de preço`

### 5.5 Atribuir Prestador

| Campo | Valor |
|-------|-------|
| **Método** | `PATCH` |
| **Endpoint** | `/service-bookings/:id/assign-provider` |
| **Descrição do Contrato** | Atribui `provider_id`. O prestador deve pertencer à equipe da loja (`store_affiliates` com role `manager` ou `affiliate`). |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

```json
{ "provider_id": "uuid-prestador" }
```

#### `400 Bad Request` — `Prestador não pertence à equipe desta loja`

### 5.6 Execução

| Método | Endpoint | Transição |
|--------|----------|-----------|
| `PATCH` | `/service-bookings/:id/start` | `confirmed` → `in_progress` (grava `started_at`) |
| `PATCH` | `/service-bookings/:id/complete` | `in_progress` → `completed` (grava `completed_at`) |
| `PATCH` | `/service-bookings/:id/cancel` | Antes de `in_progress`, com justificação |

#### `400 Bad Request` — `Transição de estado inválida`

#### `403 Forbidden` — agendamento de outra loja

> Ao concluir, o pedido associado (`order_id`, se existir) passa a `delivered` e a fatura é emitida como na fase 2.

---

## 6. Imóveis

### 6.1 Publicar Imóvel

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/products` com `real_estate_details` |
| **Descrição do Contrato** | Cria o produto (imóvel) e o registo `real_estate_details`. Para arrendamento usar `product_type = 'rental'`; para venda, `product_type = 'physical'`. `transaction_type` define a finalidade. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

```json
{
  "title": "Apartamento T3 no Talatona",
  "description": "Condomínio fechado, 2 lugares de garagem",
  "price": 450000,
  "stock_quantity": 1,
  "category_id": 30,
  "shipping_type": "free",
  "product_type": "rental",
  "rental_period_type": "monthly",
  "security_deposit": 900000,
  "condition_type": "used",
  "real_estate_details": {
    "property_type": "apartment",
    "transaction_type": "rent",
    "bedrooms": 3,
    "bathrooms": 2,
    "area_sqm": 120.5,
    "location_address": "Talatona, Luanda",
    "latitude": -8.915,
    "longitude": 13.185
  }
}
```

#### `201 Created` — produto + `real_estate_details`

#### `400 Bad Request` — `Imóvel exige property_type, transaction_type e location_address`

#### `400 Bad Request` — `Coordenadas inválidas` (lat -90..90, lon -180..180)

### 6.2 Gerir Imóveis

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/real-estate/my?transaction_type=&page=&limit=` | Meus imóveis |
| `PUT` | `/real-estate/:productId` | Atualiza quartos, área, morada, coordenadas |
| `PATCH` | `/real-estate/:productId/toggle-active` | Pausar/retomar anúncio |
| `DELETE` | `/real-estate/:productId` | Remover anúncio (bloqueado se houver aluguer ativo) |

#### `400 Bad Request` — `Imóvel com aluguer ativo não pode ser removido`

---

## 7. Parcelas / Prestações

### 7.1 Criar Plano de Prestações

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/installments` |
| **Descrição do Contrato** | Divide o total de um pedido **ou** de um aluguer em N parcelas iguais (a última absorve o arredondamento). Soma das parcelas = total da origem. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

```json
{
  "order_id": "uuid-pedido",
  "total_installments": 3,
  "first_due_date": "2026-11-10",
  "interval_days": 30
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `order_id` | uuid | ⚠️ | Pedido da loja (exclusivo com `rental_id`) |
| `rental_id` | uuid | ⚠️ | Aluguer da loja (exclusivo com `order_id`) |
| `total_installments` | number | ✅ | 1 a 12 |
| `first_due_date` | date | ✅ | Vencimento da 1.ª parcela |
| `interval_days` | number | ❌ | Intervalo entre vencimentos (padrão `30`) |

#### `201 Created`

```json
{
  "order_id": "uuid-pedido",
  "total_amount": 10500,
  "installments": [
    { "installment_number": 1, "total_installments": 3, "amount": 3500, "due_date": "2026-11-10", "status": "pending" },
    { "installment_number": 2, "total_installments": 3, "amount": 3500, "due_date": "2026-12-10", "status": "pending" },
    { "installment_number": 3, "total_installments": 3, "amount": 3500, "due_date": "2027-01-09", "status": "pending" }
  ]
}
```

#### `400 Bad Request` — `Informe order_id ou rental_id (não ambos)` / `Total de parcelas deve estar entre 1 e 12`

#### `400 Bad Request` — `Já existe plano de prestações para este pedido`

#### `403 Forbidden` — pedido/aluguer de outra loja

### 7.2 Acompanhar Parcelas

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/installments/store?status=&due_from=&due_to=&page=&limit=` | Parcelas da loja |
| `GET` | `/installments/store/summary` | `{ "pending": 7, "overdue": 2, "total_pending_amount": 24500, "total_overdue_amount": 7000 }` |
| `GET` | `/installments/:id` | Detalhe com comprovativo |

### 7.3 Confirmar Pagamento

| Campo | Valor |
|-------|-------|
| **Método** | `PATCH` |
| **Endpoint** | `/installments/:id/paid` |
| **Descrição do Contrato** | Confirma o pagamento após validar o comprovativo submetido pelo cliente. Grava `paid_at` e `payment_method`. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

```json
{ "payment_method": "transferencia", "paid_at": "2026-11-09T15:30:00Z" }
```

#### `200 OK`

```json
{ "id": "uuid-parcela", "status": "paid", "paid_at": "2026-11-09T15:30:00.000Z" }
```

#### `400 Bad Request` — `Parcela já paga` / `Parcela cancelada` / `Comprovativo em falta`

### 7.4 Cancelar Parcela

- `PATCH /installments/:id/cancel` → apenas `pending`/`overdue`; justificação em `{ "reason": "..." }`

> Job diário marca `pending` vencidas como `overdue` e notifica o cliente (email + notificação in-app).

---

## 8. Chamadas In-App (Iniciar)

> 🔐 **Regra crítica de segurança:** **só o vendedor ou o estafeta podem iniciar chamadas**, e **apenas se existir uma entrega ativa** (`deliveries.status = 'out_for_delivery'`). O cliente nunca inicia. Fora desse cenário a API responde `403`.
>
> Objetivo: impedir spam e chamadas simultâneas de vários clientes à loja.

### 8.1 Verificar Elegibilidade

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/calls/eligibility?delivery_id=uuid` |
| **Descrição do Contrato** | O botão "Ligar" do app só fica ativo se a resposta for elegível. Evita mostrar UI de chamada quando a entrega já terminou. |
| **Permissão** | 🔒 Bearer Token (role: `seller`, `customer` estafeta) |

```json
{
  "can_call": true,
  "delivery_id": "uuid-entrega",
  "delivery_status": "out_for_delivery",
  "receiver": { "id": "uuid-cliente", "name": "Ana Silva" },
  "active_call_id": null,
  "reason": null
}
```

#### `200 OK` — não elegível (não é erro de leitura)

```json
{
  "can_call": false,
  "delivery_status": "delivered",
  "active_call_id": null,
  "reason": "Só é possível ligar durante uma entrega ativa (out_for_delivery)."
}
```

### 8.2 Iniciar Chamada

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/calls` |
| **Descrição do Contrato** | Cria `call_logs` com status `initiated` e emite `call:ringing` para a sala `user:<receiver_id>`. Validações em cascata abaixo. |
| **Permissão** | 🔒 Bearer Token (role: `seller`; `customer` **apenas** se for estafeta da entrega) |

```json
{ "delivery_id": "uuid-entrega", "order_id": "uuid-pedido" }
```

### Validações (ordem de execução)

| # | Verificação | Falha |
|---|-------------|-------|
| 1 | `user_type = 'customer'` **sem** ser estafeta atribuído da entrega | `403` — `Apenas o vendedor ou o estafeta podem iniciar chamadas.` |
| 2 | Vendedor não é dono da loja da entrega | `403` — `Sem permissão para ligar nesta entrega.` |
| 3 | `delivery.status !== 'out_for_delivery'` | `403` — `Só é possível ligar durante uma entrega ativa (out_for_delivery).` |
| 4 | Não existe `delivery_id` **nem** `order_id` válido | `403` — `É necessário um pedido ou entrega em andamento para iniciar a chamada.` |
| 5 | Já existe chamada `initiated`/`ringing`/`answered` para a mesma entrega | `409` — `Já existe uma chamada ativa para esta entrega.` |
| 6 | Mais de 3 tentativas nos últimos 10 minutos para a mesma entrega | `429` — `Limite de tentativas de chamada atingido.` |

#### `201 Created`

```json
{
  "id": "uuid-chamada",
  "caller_id": "uuid-vendedor",
  "receiver_id": "uuid-cliente",
  "order_id": "uuid-pedido",
  "delivery_id": "uuid-entrega",
  "status": "initiated",
  "created_at": "2026-11-01T10:00:00.000Z"
}
```

### 8.3 Arquitetura WebRTC (Áudio)

> O áudio da chamada vai por **WebRTC** (P2P, codec Opus). O servidor NestJS faz apenas **sinalização** via Socket.IO e emite credenciais TURN efémeras — nunca recebe, processa ou grava áudio.

| Camada | Tecnologia | Função |
|--------|-----------|--------|
| Sinalização | Socket.IO namespace `/realtime` (JWT no handshake) | Convite, SDP, ICE, estados |
| Media | WebRTC `RTCPeerConnection` (áudio Opus, 1 pista) | Áudio P2P vendedor/estafeta ↔ cliente |
| NAT traversal | STUN + **TURN (coturn self-hosted** ou TURN externo) | Redes móveis/CGNAT — comum em Angola |
| Segurança | JWT + sala por chamada `call:<id>` + validação de entrega | Só os 2 participantes trocam SDP |

#### Credenciais ICE

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/calls/ice-config` |
| **Descrição do Contrato** | Devolve `iceServers` com credenciais TURN efémeras (TTL 10 min, HMAC do coturn) para o utilizador autenticado. |
| **Permissão** | 🔒 Bearer Token (role: `seller` ou estafeta) |

```json
{
  "ice_servers": [
    { "urls": "stun:stun.kitanda.ao:3478" },
    {
      "urls": ["turn:turn.kitanda.ao:3478?transport=udp", "turn:turn.kitanda.ao:3478?transport=tcp"],
      "username": "1750000000:uuid-vendedor",
      "credential": "base64-hmac-temporario"
    }
  ],
  "ttl_seconds": 600
}
```

#### Fluxo de Sinalização

| Evento | Direção | Payload | Descrição |
|--------|---------|---------|-----------|
| `call:ringing` | servidor → ambos | `{ call_id, caller_id, ... }` | Convite entregue ao cliente |
| `call:offer` | vendedor → cliente | `{ call_id, sdp }` | Oferta SDP (`audio: true`, `video: false`) |
| `call:answer` | cliente → vendedor | `{ call_id, sdp }` | Resposta SDP |
| `call:ice-candidate` | ambos | `{ call_id, candidate }` | Trickle ICE contínuo |
| `call:rejected` | cliente → vendedor | `{ call_id }` | Chamada recusada |
| `call:ended` | ambos | `{ call_id, duration_seconds }` | Fim, com duração |

#### Sequência no app vendedor

```js
const pc = new RTCPeerConnection({ iceServers });
const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
stream.getTracks().forEach((t) => pc.addTrack(t, stream));

pc.onicecandidate = ({ candidate }) =>
  socket.emit('call:ice-candidate', { call_id, candidate });

const offer = await pc.createOffer({ offerToReceiveAudio: true });
await pc.setLocalDescription(offer);
socket.emit('call:offer', { call_id, sdp: offer.sdp });

socket.on('call:answer', async ({ sdp }) =>
  pc.setRemoteDescription({ type: 'answer', sdp }));
```

#### Requisitos de infraestrutura

| Item | Configuração recomendada |
|------|--------------------------|
| STUN | `coturn` no mesmo host do TURN, porta `3478/udp` |
| TURN | `coturn` com `use-auth-secret`, range `49152-65535/udp`, TLS `5349` |
| Largura de banda | ~32 kbps por chamada (Opus mono) — adequado a 3G |
| Fallback | `iceTransportPolicy: 'relay'` quando o P2P falhar (rede móvel restritiva) |
| Firewall | UDP aberto para 3478 e range de relay; TCP 443 como fallback |

> Monitorização: `pc.onconnectionstatechange` alimenta o estado da chamada; `failed` encerra com `PATCH /calls/:id/status` `ended`. Estatísticas agregadas (taxa de falha ICE, % relay) ficam disponíveis ao admin em `/calls/stats`.

### 8.4 Estados e Encerramento

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `PATCH` | `/calls/:id/status` | `ringing`, `answered`, `missed`, `rejected`, `ended` |
| `GET` | `/calls/my` | Histórico do vendedor/estafeta (chamadas feitas) |
| `GET` | `/calls/store?page=&limit=` | Todas as chamadas da loja (equipe) |

#### `400 Bad Request` — `Transição de estado inválida`

#### `403 Forbidden` — chamada de outro utilizador/loja

> Chamada em `ringing` há mais de 45 s sem resposta → `missed` automaticamente (job de tempo real), com notificação ao cliente.

---

## 9. Tabela de Erros (Vendedor)

| Código | Mensagem | Onde |
|--------|----------|------|
| `400` | `Produto do tipo rental exige rental_period_type e security_deposit` | `POST /products` |
| `400` | `Tipo de produto não pode ser alterado depois de vendido ou alugado` | `PATCH /products/:id` |
| `400` | `Aluguer não está pendente` | `PATCH /rentals/:id/activate` |
| `400` | `Só é possível devolver alugueres ativos ou em atraso` | `PATCH /rentals/:id/return` |
| `400` | `Produto não é do tipo service` | `PUT /services/:productId/details` |
| `400` | `start_time deve ser anterior a end_time` | `PUT /services/schedule` |
| `400` | `Prestador não pertence à equipe desta loja` | `PATCH /service-bookings/:id/assign-provider` |
| `400` | `Já existe plano de prestações para este pedido` | `POST /installments` |
| `403` | `Apenas o vendedor ou o estafeta podem iniciar chamadas.` | `POST /calls` |
| `403` | `Só é possível ligar durante uma entrega ativa (out_for_delivery).` | `POST /calls` |
| `409` | `Já existe uma chamada ativa para esta entrega.` | `POST /calls` |
| `429` | `Limite de tentativas de chamada atingido.` | `POST /calls` |

---

## 10. Regras de Negócio Aplicadas (Resumo)

| # | Regra | Onde |
|---|-------|------|
| 1 | `store_id` sempre derivado do token, nunca do payload | Todas as rotas |
| 2 | Cada tipo de produto tem campos obrigatórios próprios; `service` cria `service_details` | `POST /products` |
| 3 | Com variantes ativas, o estoque vendável é o de cada variante | `POST /product-variants` |
| 4 | Aluguer exige período válido, sem sobreposição; `overdue` por job diário | `/rentals` |
| 5 | Caução devolvida em `returned`; retida total/parcial em `damaged` com notas | `PATCH /rentals/:id/return` |
| 6 | Agendamento só dentro dos horários configurados; reagendamento mantém histórico | `/service-bookings` |
| 7 | `quote_required` só define valor após orçamento aceite pelo cliente | `PATCH /service-bookings/:id/quote` |
| 8 | Prestações somam exatamente o total da origem; máx. 12 parcelas | `POST /installments` |
| 9 | Parcela só fica `paid` após confirmação do vendedor, com comprovativo | `PATCH /installments/:id/paid` |
| 10 | **Chamadas: só vendedor/estafeta, apenas com entrega `out_for_delivery`, uma ativa por entrega** | `POST /calls` |
| 11 | Áudio por WebRTC P2P (Opus) com STUN/TURN coturn; servidor só sinaliza e emite credenciais efémeras | `GET /calls/ice-config` |

### Gate por Plano (proposta a validar antes de implementar)

> Mantém a hierarquia rigorosa **Normal < Black < Premium** da fase 2. Sugestão de enquadramento dos novos serviços:

| Recurso | Normal | Black | Premium |
|---------|--------|-------|----------|
| Variantes de produto | ✅ | ✅ | ✅ |
| Alugueres (`product_type = rental`) | ❌ | ✅ | ✅ |
| Serviços e agendamentos | ❌ | ✅ | ✅ |
| Imóveis | ❌ | ❌ | ✅ |
| Prestações (`installments`) | ❌ | ✅ | ✅ |
| Chamadas in-app | ✅ | ✅ | ✅ |

> Se o plano não permitir o recurso, a resposta é `403` com mensagem específica (ex.: `O seu plano não permite gerir alugueres.`). O contrato dos endpoints não muda — a validação é interna no service, como na fase 2.

---

## Anexo A — Modelo de Dados (Fase 3)

> Referência do esquema usado pelos endpoints acima. Migração **aditiva** (novo ficheiro após `1700000000003`), `synchronize` permanece `false`. Valores monetários `DECIMAL(12,2)`; IDs `UUID` com `uuid_generate_v4()`.

| Tabela | Campos principais | Uso no painel vendedor |
|---------|------------------|------------------------|
| `products` *(ALTER)* | `product_type`, `rental_period_type`, `security_deposit`, `condition_type`, `requires_towing` | Publicação por tipo (§1) |
| `product_variants` | `product_id`, `name`, `additional_price`, `stock_quantity`, `is_active` | Gestão de variantes/adicionais (§2) |
| `carts` | `customer_id` **UNIQUE**, `updated_at` | Só leitura indireta (itens convertidos em pedido) |
| `cart_items` | `cart_id`, `product_id`, `variant_id`, `quantity`, `special_instructions` | Origem das instruções especiais no pedido |
| `order_items` *(ALTER)* | `variant_id`, `special_instructions` | Detalhe do pedido na loja (fase 2 + fase 3) |
| `rentals` | `customer_id`, `store_id`, `product_id`, `start_date`, `end_date`, `rental_price`, `security_deposit`, `total_amount`, `status`, `notes` | Ativar, devolver, cancelar, extensão (§3) |
| `service_details` | `product_id` **UNIQUE**, `pricing_type`, `estimated_duration_minutes`, `requires_site_visit` | Definir regras de preço (§4.1) |
| `store_service_schedules` | `store_id`, `day_of_week`, `start_time`, `end_time`, `is_available` — `UNIQUE (store_id, day_of_week)` | Semana de atendimento (§4.2) |
| `service_bookings` | `order_id`, `customer_id`, `store_id`, `product_id`, `provider_id`, `scheduled_date`, `scheduled_time`, `service_address`, `service_latitude`, `service_longitude`, `status`, `total_amount`, `notes_from_customer`, `started_at`, `completed_at` | Agenda e execução (§5) |
| `real_estate_details` | `product_id` **UNIQUE**, `property_type`, `transaction_type`, `bedrooms`, `bathrooms`, `area_sqm`, `location_address`, `latitude`, `longitude` | Publicar e gerir imóveis (§6) |
| `installments` | `order_id`, `rental_id`, `customer_id`, `store_id`, `installment_number`, `total_installments`, `amount`, `due_date`, `status`, `paid_at`, `payment_method`, `payment_proof_url` | Criar plano e confirmar pagamento (§7) |
| `call_logs` | `caller_id`, `receiver_id`, `order_id`, `delivery_id`, `status`, `duration_seconds`, `started_at`, `ended_at` | Chamadas iniciadas (§8) |

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

### Regras de integridade relevantes para o vendedor

| Restrição | Efeito |
|-----------|--------|
| `product_variants.product_id` `ON DELETE CASCADE` | Apagar produto remove variantes |
| `service_details.product_id` **UNIQUE** | Um detalhe de serviço por produto |
| `store_service_schedules UNIQUE (store_id, day_of_week)` | `PUT /services/schedule` substitui o dia (upsert) |
| `service_bookings.provider_id` `ON DELETE SET NULL` | Prestador removido não apaga o agendamento |
| `rentals.store_id` `ON DELETE RESTRICT` | Loja com aluguer não pode ser eliminada |
| `installments.order_id`/`rental_id` `ON DELETE CASCADE` | Parcelas acompanham a origem |
| `call_logs.delivery_id` `ON DELETE SET NULL` | Chamada mantém histórico mesmo sem entrega |
| Índices | `rentals(store_id, status)`, `installments(store_id, status, due_date)`, `service_bookings(store_id, scheduled_date)` suportam as listagens e o job de `overdue` |
