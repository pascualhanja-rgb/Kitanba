# 🛠️ API 3 — App Admin

> **Fase 3** — supervisão dos novos serviços: alugueres e cauções, agendamentos de serviço, prestações e cobrança, imóveis, variantes de catálogo e **auditoria de chamadas in-app** (incluindo tentativas bloqueadas).
>
> **Tabelas envolvidas:** `product_variants`, `rentals`, `service_details`, `service_bookings`, `store_service_schedules`, `real_estate_details`, `installments`, `call_logs` (+ campos novos em `products` e `order_items`).
>
> **Convenções**
>
> - Autenticação: `Authorization: Bearer <access_token>`, role `admin`.
> - Paginação `?page=1&limit=20` → `{ data, meta: { total, page, limit, totalPages } }`.
> - Valores em **AOA (Kz)**; datas ISO 8601.

---

## 1. Alugueres — Supervisão

### 1.1 Listar Todos os Alugueres

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/rentals` |
| **Descrição do Contrato** | Lista alugueres de todas as lojas, com cliente, loja, produto, período e caução. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `status` | string | `pending` \| `active` \| `returned` \| `overdue` \| `damaged` \| `cancelled` |
| `store_id` | uuid | Filtrar por loja |
| `customer_id` | uuid | Filtrar por cliente |
| `from` / `to` | date | Intervalo de `start_date` |
| `page` / `limit` | number | Paginação |

```json
{
  "data": [
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
      "status": "active",
      "store": { "id": "uuid-loja", "name": "Loja do João" },
      "customer": { "id": "uuid-cliente", "name": "Ana Silva" }
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
}
```

### 1.2 Detalhe

- `GET /rentals/:id` → inclui notas, histórico de estados e loja/cliente.

### 1.3 Forçar Estado

| Campo | Valor |
|-------|-------|
| **Método** | `PATCH` |
| **Endpoint** | `/rentals/:id/status` |
| **Descrição do Contrato** | Admin pode forçar transições para resolução de disputas (`active`, `returned`, `damaged`, `cancelled`), com justificação obrigatória. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

```json
{ "status": "damaged", "notes": "Disputa resolvida a favor do vendedor. Caução retida." }
```

#### `200 OK` — aluguer atualizado

#### `400 Bad Request` — `Justificação obrigatória para alteração pelo admin` / `Transição inválida`

### 1.4 Disputas de Caução

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/rentals/disputes?page=&limit=` | Alugueres `damaged`/`overdue` com caução retida |
| `POST` | `/rentals/:id/resolve-deposit` | `{ "refund_amount": 10000, "notes": "50% devolvido ao cliente." }` — registo de resolução |

#### `400 Bad Request` — `Valor de reembolso superior à caução`

### 1.5 Resumo de Alugueres

- `GET /rentals/summary` → `{ "active": 12, "overdue": 3, "damaged": 1, "deposits_held": 240000, "revenue_this_month": 980000 }`

---

## 2. Agendamentos de Serviço — Supervisão

### 2.1 Listar

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/service-bookings` |
| **Descrição do Contrato** | Lista agendamentos de todas as lojas, com morada, prestador e estado. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `status` | string | `pending` \| `confirmed` \| `in_progress` \| `completed` \| `cancelled` \| `rescheduled` |
| `store_id` / `customer_id` / `provider_id` | uuid | Filtros |
| `date` | date | Dia do serviço |
| `page` / `limit` | number | Paginação |

### 2.2 Forçar Reagendamento / Cancelamento

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `PATCH` | `/service-bookings/:id/reschedule` | `{ "scheduled_date", "scheduled_time", "notes" }` com justificação |
| `PATCH` | `/service-bookings/:id/cancel` | `{ "reason": "..." }` — permitido até `in_progress` |

#### `400 Bad Request` — `Serviço já iniciado não pode ser cancelado pelo admin`

### 2.3 Reatribuir Prestador

- `PATCH /service-bookings/:id/assign-provider` → `{ "provider_id": "uuid", "force": true }`
- Admin pode atribuir prestador de **qualquer** loja apenas em incidentes; caso contrário `400` — `Prestador deve pertencer à equipe da loja`.

### 2.4 Indicadores

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/service-bookings/stats` | `{ "today": 18, "pending": 7, "in_progress": 4, "avg_completion_minutes": 96, "cancellation_rate": 0.06 }` |
| `GET` | `/service-bookings/:id` | Detalhe com histórico de estados |

---

## 3. Prestações e Cobrança

### 3.1 Listar Parcelas

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/installments` |
| **Descrição do Contrato** | Todas as parcelas da plataforma, com comprovativo, estado e origem (pedido/aluguer). |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `status` | string | `pending` \| `paid` \| `overdue` \| `cancelled` |
| `store_id` / `customer_id` | uuid | Filtros |
| `due_from` / `due_to` | date | Vencimento |
| `page` / `limit` | number | Paginação |

```json
{
  "data": [
    {
      "id": "uuid-parcela",
      "order_id": "uuid-pedido",
      "rental_id": null,
      "customer_id": "uuid-cliente",
      "store_id": "uuid-loja",
      "installment_number": 2,
      "total_installments": 3,
      "amount": 3500,
      "due_date": "2026-12-10",
      "status": "overdue",
      "payment_method": null,
      "payment_proof_url": null,
      "paid_at": null
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
}
```

### 3.2 Confirmar ou Cancelar Pagamento

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `PATCH` | `/installments/:id/paid` | Confirma com `payment_method` e `paid_at` |
| `PATCH` | `/installments/:id/cancel` | `{ "reason": "..." }` |

#### `400 Bad Request` — `Parcela já paga` / `Parcela cancelada`

### 3.3 Relatório de Inadimplência

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/installments/overdue-report` |
| **Descrição do Contrato** | Agrega parcelas vencidas por loja e por cliente, com dias de atraso, para ação de cobrança. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `min_days_overdue` | number | Padrão `1` |
| `group_by` | string | `store` (padrão) \| `customer` |

```json
{
  "generated_at": "2026-11-01T12:00:00.000Z",
  "total_overdue": 9,
  "total_amount": 31500,
  "groups": [
    {
      "store_id": "uuid-loja",
      "store_name": "Loja do João",
      "overdue_count": 4,
      "overdue_amount": 14000,
      "max_days_overdue": 21
    }
  ]
}
```

### 3.4 Exportação

- `GET /installments/export?format=csv&status=overdue` → `text/csv` (mesmos filtros da listagem)

#### `400 Bad Request` — `Formato não suportado` (apenas `csv`)

### 3.5 Resumo Financeiro

- `GET /installments/summary` → `{ "pending": 42, "overdue": 9, "paid": 310, "total_pending_amount": 147000, "total_overdue_amount": 31500 }`

---

## 4. Chamadas In-App — Auditoria

> 🔐 **Regra crítica de segurança implementada:** apenas **vendedor** ou **estafeta** iniciam chamadas e **apenas** com `deliveries.status = 'out_for_delivery'`. O cliente **nunca** inicia. Tentativas fora desta regra devolvem `403` e ficam registadas para auditoria.

### 4.1 Listar Chamadas

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/calls` |
| **Descrição do Contrato** | Todas as chamadas da plataforma com contexto (pedido/entrega), duração e estado. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `status` | string | `initiated` \| `ringing` \| `answered` \| `missed` \| `rejected` \| `ended` |
| `caller_id` / `receiver_id` | uuid | Filtros |
| `order_id` / `delivery_id` | uuid | Contexto |
| `from` / `to` | datetime | Intervalo de `created_at` |
| `page` / `limit` | number | Paginação |

```json
{
  "data": [
    {
      "id": "uuid-chamada",
      "caller_id": "uuid-vendedor",
      "caller_type": "seller",
      "receiver_id": "uuid-cliente",
      "order_id": "uuid-pedido",
      "delivery_id": "uuid-entrega",
      "status": "ended",
      "duration_seconds": 87,
      "started_at": "2026-11-01T10:00:05.000Z",
      "ended_at": "2026-11-01T10:01:32.000Z",
      "created_at": "2026-11-01T10:00:00.000Z"
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
}
```

### 4.2 Detalhe

- `GET /calls/:id` → chamada + entrega + pedido + participantes.

### 4.3 Estatísticas de Chamadas

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/calls/stats` |
| **Descrição do Contrato** | Indicadores de uso e de abuso (tentativas por entrega, taxa de chamadas atendidas, chamadas bloqueadas). |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

```json
{
  "total_calls": 1240,
  "answered_rate": 0.82,
  "avg_duration_seconds": 74,
  "missed": 168,
  "rejected": 55,
  "blocked_attempts": 37,
  "blocked_by_customer": 29,
  "blocked_without_active_delivery": 8,
  "calls_per_delivery_avg": 1.3,
  "avg_setup_seconds": 2.4,
  "ice_failure_rate": 0.018,
  "relay_share": 0.22,
  "period": { "from": "2026-10-01", "to": "2026-11-01" }
}
```

> `ice_failure_rate` e `relay_share` vêm das estatísticas WebRTC reportadas pelos clientes (`pc.getStats()` → `POST /calls/:id/metrics`), não do servidor: o áudio é P2P e não passa pela API.

### 4.4 Tentativas Bloqueadas (Abuso)

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/calls/blocked` |
| **Descrição do Contrato** | Lista tentativas rejeitadas por violação da regra (cliente a tentar ligar, chamada sem entrega `out_for_delivery`, chamada duplicada). Alimentado por `audit_logs`/logger estruturado do módulo de chamadas. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

```json
{
  "data": [
    {
      "id": "uuid-evento",
      "user_id": "uuid-cliente",
      "user_type": "customer",
      "action": "call_initiate",
      "reason": "customer_not_allowed",
      "delivery_id": null,
      "order_id": "uuid-pedido",
      "ip": "102.68.x.x",
      "created_at": "2026-11-01T09:58:12.000Z"
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
}
```

#### `400 Bad Request` — `Intervalo de datas inválido`

### 4.5 Suspender Chamadas de um Utilizador

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/calls/restrictions` |
| **Descrição do Contrato** | Aplica bloqueio temporário a um vendedor/estafeta que abuse das chamadas. Enquanto ativo, `POST /calls` devolve `403`. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

```json
{ "user_id": "uuid-vendedor", "blocked_until": "2026-11-08T00:00:00Z", "reason": "Spam de chamadas ao mesmo cliente." }
```

#### `201 Created`

```json
{ "id": "uuid-restricao", "user_id": "uuid-vendedor", "blocked_until": "2026-11-08T00:00:00.000Z", "reason": "Spam de chamadas ao mesmo cliente." }
```

#### `403` no fluxo do vendedor — `As suas chamadas estão temporariamente suspensas.`

### 4.6 Encerrar Chamada Ativa

- `PATCH /calls/:id/status` com `{ "status": "ended" }` — usado em incidentes; grava `duration_seconds`.

### 4.7 Qualidade e Infraestrutura WebRTC

> As chamadas usam **WebRTC** (áudio P2P, Opus) com sinalização Socket.IO e **TURN/coturn** para NAT traversal. O áudio não passa pela API nem é gravado — não há conteúdo para auditar, apenas metadados.

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/calls/:id/metrics` | Cliente/vendedor envia `{ "ice_state": "connected", "used_relay": true, "rtt_ms": 84, "jitter_ms": 12, "packets_lost": 3, "setup_seconds": 2.1 }` (autenticado, só participantes) |
| `GET` | `/calls/metrics/quality?from=&to=` | Agrega por loja: taxa de falha ICE, % de chamadas por relay, RTT médio, perda de pacotes |
| `GET` | `/calls/metrics/turn` | Consumo do TURN (minutos relay, pico de sessões) a partir dos logs do coturn |

```json
{
  "ice_failure_rate": 0.018,
  "relay_share": 0.22,
  "avg_rtt_ms": 96,
  "avg_jitter_ms": 14,
  "avg_packet_loss": 0.008,
  "turn_minutes_month": 4210,
  "worst_stores": [
    { "store_id": "uuid-loja", "ice_failure_rate": 0.07, "relay_share": 0.61 }
  ]
}
```

#### Checklist operacional

| Item | Verificação |
|------|-------------|
| STUN/TURN acessível | `turnutils_uclient` com credenciais efémeras → teste de relay OK |
| Certificado TLS do TURN (`5349`) | Renovação automática (Let's Encrypt) |
| Relay UDP `49152-65535` | Aberto no firewall/security group |
| Credenciais efémeras | TTL 10 min (`use-auth-secret`), emitidas em `GET /calls/ice-config` |
| Fallback | App cai para `iceTransportPolicy: 'relay'` após falha de P2P |

#### Alertas sugeridos

| Condição | Ação |
|----------|------|
| `ice_failure_rate > 0.05` por 1 h | Verificar TURN/firewall; notificar admin |
| `relay_share > 0.6` | Rever capacity do coturn / custo de banda |
| `blocked_attempts` sobe > 50% num dia | Investigar abuso; aplicar `POST /calls/restrictions` |
| TURN sem sessões ativas com chamadas em curso | Alerta de indisponibilidade |

---

## 5. Imóveis — Moderação

### 5.1 Listar Anúncios

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/real-estate` |
| **Descrição do Contrato** | Todos os imóveis publicados, com loja e estado do anúncio. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `transaction_type` | string | `sale` \| `rent` |
| `property_type` | string | `house` \| `apartment` \| `land` \| `commercial` |
| `store_id` | uuid | Filtrar por loja |
| `is_active` | boolean | Estado do anúncio |
| `page` / `limit` | number | Paginação |

### 5.2 Suspender Anúncio

| Campo | Valor |
|-------|-------|
| **Método** | `PATCH` |
| **Endpoint** | `/real-estate/:productId/suspend` |
| **Descrição do Contrato** | Desativa o anúncio (produto `is_active = false`) com justificação, mantendo o histórico. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

```json
{ "reason": "Coordenadas fora de Angola / anúncio duplicado." }
```

#### `200 OK`

```json
{ "product_id": "uuid-imovel", "is_active": false, "reason": "Coordenadas fora de Angola / anúncio duplicado." }
```

#### `400 Bad Request` — `Imóvel com aluguer ativo não pode ser suspenso`

### 5.3 Reativar

- `PATCH /real-estate/:productId/activate` → reativa o anúncio

### 5.4 Estatísticas

- `GET /real-estate/stats` → `{ "total": 84, "sale": 51, "rent": 33, "suspect_listings": 2 }`

---

## 6. Catálogo — Tipos e Variantes

### 6.1 Visão por Tipo de Produto

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/products/admin/summary` |
| **Descrição do Contrato** | Distribuição de produtos por `product_type`, condição e estado, para governança do catálogo. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

```json
{
  "by_type": { "physical": 1280, "rental": 96, "food": 145, "service": 42 },
  "by_condition": { "new": 990, "used": 310, "refurbished": 63 },
  "with_variants": 212,
  "inactive": 74,
  "without_store": 0
}
```

### 6.2 Produtos com Variantes

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/products/admin/variants?store_id=&page=&limit=` | Variantes com estoque e preço adicional |
| `PATCH` | `/product-variants/:id` | Corrigir estoque/preço adicional em incidentes |

#### `400 Bad Request` — `Estoque não pode ser negativo` / `Preço adicional não pode ser negativo`

### 6.3 Alterar Tipo de Produto (casos excecionais)

- `PATCH /products/:id/type` → `{ "product_type": "rental", "reason": "..." }`
- Permitido **apenas** se o produto não tiver pedidos, alugueres ou agendamentos.

#### `400 Bad Request` — `Produto já transacionado não pode mudar de tipo`

---

## 7. Métricas dos Novos Serviços

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/admin/metrics` (extensão do endpoint existente) |
| **Descrição do Contrato** | Acrescenta ao resumo executivo da fase 2 um bloco `phase3` com alugueres, serviços, imóveis, prestações e chamadas. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

```json
{
  "phase3": {
    "rentals": {
      "active": 12,
      "overdue": 3,
      "revenue_month": 980000,
      "deposits_held": 240000,
      "avg_duration_days": 4.2
    },
    "services": {
      "bookings_month": 87,
      "completed": 71,
      "cancelled": 9,
      "no_show": 7,
      "avg_ticket": 26500
    },
    "real_estate": { "listings": 84, "sale": 51, "rent": 33, "suspended": 2 },
    "installments": {
      "overdue_count": 9,
      "overdue_amount": 31500,
      "collection_rate": 0.93
    },
    "calls": {
      "total": 1240,
      "answered_rate": 0.82,
      "blocked_attempts": 37,
      "avg_duration_seconds": 74
    }
  }
}
```

### Série Mensal

- `GET /admin/metrics/phase3/series?months=12` → série com alugueres, agendamentos e receita de prestações por mês.

#### `400 Bad Request` — `months deve estar entre 1 e 24`

---

## 8. Tabela de Erros (Admin)

| Código | Mensagem | Onde |
|--------|----------|------|
| `400` | `Justificação obrigatória para alteração pelo admin` | `PATCH /rentals/:id/status` |
| `400` | `Valor de reembolso superior à caução` | `POST /rentals/:id/resolve-deposit` |
| `400` | `Serviço já iniciado não pode ser cancelado pelo admin` | `PATCH /service-bookings/:id/cancel` |
| `400` | `Parcela já paga` | `PATCH /installments/:id/paid` |
| `400` | `Intervalo de datas inválido` | `GET /calls/blocked` |
| `400` | `Imóvel com aluguer ativo não pode ser suspenso` | `PATCH /real-estate/:productId/suspend` |
| `400` | `Produto já transacionado não pode mudar de tipo` | `PATCH /products/:id/type` |
| `404` | `Recurso não encontrado` | Todas as rotas `/:id` |

---

## 9. Regras de Negócio Aplicadas (Resumo)

| # | Regra | Onde |
|---|-------|------|
| 1 | Admin só altera estado com justificação registada | `PATCH /rentals/:id/status`, `/service-bookings/:id/cancel` |
| 2 | Cauções retidas são conciliadas; reembolso nunca excede a caução | `/rentals/:id/resolve-deposit` |
| 3 | Job diário marca alugueres e parcelas vencidas como `overdue`; admin audita | `/rentals`, `/installments` |
| 4 | Prestações somam o total da origem, máximo 12 parcelas | `POST /installments` (vendedor), visível ao admin |
| 5 | Prestador deve pertencer à equipe da loja, exceto atribuição forçada do admin | `/service-bookings/:id/assign-provider` |
| 6 | Imóveis exigem `transaction_type`, `property_type`, morada e coordenadas válidas | `POST /products` com `real_estate_details` |
| 7 | **Chamadas: cliente nunca inicia; só vendedor/estafeta com entrega `out_for_delivery`; duplicadas e excessos bloqueados** | `POST /calls` (403/409/429) |
| 7a | Áudio por **WebRTC P2P** (Opus); servidor só sinaliza e emite credenciais TURN efémeras; sem gravação | `GET /calls/ice-config`, `POST /calls/:id/metrics` |
| 8 | Tentativas bloqueadas ficam auditáveis; admin pode suspender chamadas de um utilizador | `GET /calls/blocked`, `POST /calls/restrictions` |
| 9 | Produto já transacionado não muda de tipo | `PATCH /products/:id/type` |
| 10 | Gate por plano (proposto): alugueres/serviços/prestações → Black+; imóveis → Premium | Validação interna no service |

---

## 10. Ordem de Implementação Sugerida

| Fase | Módulos | Depende de |
|------|---------|------------|
| 3.1 | Migração SQL + campos de `products`, `product_variants` | — |
| 3.2 | Carrinho (`carts`, `cart_items`) + checkout com variantes | 3.1 |
| 3.3 | Alugueres (`rentals`) | 3.1 |
| 3.4 | Serviços (`service_details`, `store_service_schedules`, `service_bookings`) | 3.1 |
| 3.5 | Imóveis (`real_estate_details`) | 3.1 |
| 3.6 | Prestações (`installments`) — depende de pedidos/alugueres | 3.2, 3.3 |
| 3.7 | Chamadas (`call_logs` + gateway de sinalização + WebRTC/coturn) — depende de entregas da fase 2 | 3.3, 3.4 |
| 3.8 | Supervisão admin + `/admin/metrics` (`phase3`) | 3.2–3.7 |

> A migração deve ser aditiva (`ALTER TABLE ... ADD COLUMN` com defaults) para não quebrar as fases 1 e 2. `synchronize` permanece `false`.

---

## Anexo A — Modelo de Dados (Fase 3)

> Referência do esquema completo. Migração **aditiva**, numerada após `1700000000003`; `synchronize` permanece `false`. Valores monetários `DECIMAL(12,2)`; IDs `UUID` com `uuid_generate_v4()`.

| Tabela | Campos principais | Uso no painel admin |
|---------|------------------|---------------------|
| `products` *(ALTER)* | `product_type`, `rental_period_type`, `security_deposit`, `condition_type`, `requires_towing` | Distribuição do catálogo e mudança de tipo excecional (§6) |
| `product_variants` | `product_id`, `name`, `additional_price`, `stock_quantity`, `is_active` | Auditoria de estoque/preço adicional (§6.2) |
| `carts` | `customer_id` **UNIQUE**, `updated_at` | Sem rotas de admin (dados do cliente) |
| `cart_items` | `cart_id`, `product_id`, `variant_id`, `quantity`, `special_instructions` | Sem rotas de admin (dados do cliente) |
| `order_items` *(ALTER)* | `variant_id`, `special_instructions` | Detalhe de pedidos na moderação |
| `rentals` | `customer_id`, `store_id`, `product_id`, `start_date`, `end_date`, `rental_price`, `security_deposit`, `total_amount`, `status`, `notes` | Supervisão, disputas de caução (§1) |
| `service_details` | `product_id` **UNIQUE**, `pricing_type`, `estimated_duration_minutes`, `requires_site_visit` | Validação de preços de serviço (§6) |
| `store_service_schedules` | `store_id`, `day_of_week`, `start_time`, `end_time`, `is_available` — `UNIQUE (store_id, day_of_week)` | Conferência de cobertura de horários (§2) |
| `service_bookings` | `order_id`, `customer_id`, `store_id`, `product_id`, `provider_id`, `scheduled_date`, `scheduled_time`, `service_address`, `service_latitude`, `service_longitude`, `status`, `total_amount`, `notes_from_customer`, `started_at`, `completed_at` | Supervisão e reatribuição (§2) |
| `real_estate_details` | `product_id` **UNIQUE**, `property_type`, `transaction_type`, `bedrooms`, `bathrooms`, `area_sqm`, `location_address`, `latitude`, `longitude` | Moderação de anúncios (§5) |
| `installments` | `order_id`, `rental_id`, `customer_id`, `store_id`, `installment_number`, `total_installments`, `amount`, `due_date`, `status`, `paid_at`, `payment_method`, `payment_proof_url` | Cobrança e inadimplência (§3) |
| `call_logs` | `caller_id`, `receiver_id`, `order_id`, `delivery_id`, `status`, `duration_seconds`, `started_at`, `ended_at` | Auditoria e abuso de chamadas (§4) |

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

### Regras de integridade relevantes para o admin

| Restrição | Efeito |
|-----------|--------|
| `carts.customer_id UNIQUE` | Nunca há carrinhos duplicados por cliente |
| `service_details.product_id` **UNIQUE** | Impede dois preços para o mesmo serviço |
| `store_service_schedules UNIQUE (store_id, day_of_week)` | Impede horários sobrepostos no mesmo dia |
| `rentals.customer_id` / `store_id` `ON DELETE RESTRICT` | Preserva histórico de alugueres |
| `service_bookings.customer_id` / `store_id` `ON DELETE RESTRICT` | Preserva histórico de serviços |
| `service_bookings.provider_id` `ON DELETE SET NULL` | Reatribuível sem perder o agendamento |
| `installments.order_id`/`rental_id` `ON DELETE CASCADE` | Eliminação da origem remove parcelas |
| `call_logs` `ON DELETE CASCADE` (caller/receiver) | Sem órfãos; `delivery_id`/`order_id` `ON DELETE SET NULL` |
| Índices | `rentals(status)`, `service_bookings(status, scheduled_date)`, `installments(status, due_date)`, `call_logs(caller_id, receiver_id)` suportam relatórios e jobs diários |

---

## Anexo B — Estado da Implementação (Backend)

> Migração: `src/database/migrations/1700000000004-AddPhase3CatalogCartRentalsServicesInstallmentsCalls.ts` (aditiva; `synchronize` continua `false`). Executar com o runner de migrations do projeto antes de subir a API.

### Implementado

| Módulo | Rotas |
|--------|-------|
| Produtos / variantes | `GET /products` (filtros de tipo/condição/preço), `GET /products/:id` (com `variants`, `service_details`, `real_estate_details`), `POST/PUT /products`, `GET /products/:id/variants`, `POST /products/:id/variants`, `PATCH|DELETE /product-variants/:id`, `GET /products/admin/summary` |
| Carrinho | `GET /cart`, `POST /cart/items`, `PATCH/DELETE /cart/items/:id`, `DELETE /cart` |
| Alugueres | `GET /products/:id/rental-availability`, `POST /rentals`, `GET /rentals/my`, `GET /rentals/store`, `GET /rentals/calendar`, `GET /rentals/summary`, `PATCH /:id/activate|return|cancel|status`, `POST|PATCH /:id/extend` |
| Serviços | `GET/PUT /services/schedule`, `GET /services/schedule/slots`, `GET /services/:id/availability`, `GET/PUT /services/:id/details` |
| Agendamentos | `POST /service-bookings`, `GET /my|store/:id|stats`, `PATCH /:id/confirm|reschedule|quote|assign-provider|start|complete|cancel`, `POST /:id/accept-quote|reject-quote` |
| Imóveis | `GET /real-estate`, `GET /real-estate/:productId`, `GET /real-estate/my`, `PUT/PATCH/DELETE`, `PATCH /:id/suspend|activate`, `GET /real-estate/stats` |
| Prestações | `POST /installments`, `GET /installments/my|store|summary|overdue-report`, `POST /:id/pay`, `PATCH /:id/paid|cancel`, job diário `@Cron` de `overdue` |
| Chamadas | `POST /calls` (403/409/429), `GET /calls/eligibility|ice-config|my|store|stats|blocked-attempts`, `PATCH /:id/status`; gateway `/realtime` (`call:subscribe|offer|answer|ice-candidate|end-signal`); job de `missed` aos 45s |

### Ainda não implementado (previsto nos contratos acima)

| Item | Nota |
|------|------|
| `POST /rentals/:id/resolve-deposit` | Requer coluna de reembolso de caução (não existe no SQL base) |
| `GET /installments/export` | Exportação CSV |
| `POST /calls/restrictions` | Suspensão de chamadas por utilizador (requer tabela de restrições) |
| `POST /calls/:id/metrics`, `GET /calls/metrics/*` | Telemetria WebRTC reportada pelo cliente |
| `GET /admin/metrics` bloco `phase3` | Extensão do `MetricsService` |
| `PATCH /products/:id/type` | Mudança de tipo pelo admin (a regra de bloqueio já existe no update do vendedor) |

### Notas de contrato

- Entrega "ativa" para chamadas: `out_for_delivery` (contrato) **ou** `picking_up`/`in_transit` (estados reais da fase 2).
- `GET /calls/blocked` foi implementado como `GET /calls/blocked-attempts` (contadores por motivo em Redis, sem tabela extra).
- O carrinho bloqueia `rental` e `service`; aluguer usa `/rentals` e serviço usa `/service-bookings`.
