# 🛒 API 2 — App Cliente

> Endpoints **novos (fase 2)** que o **app do cliente** usa para fazer pedidos com entrega em casa, acompanhar o estafeta no mapa em tempo real, baixar faturas, participar de lives e ver promoções.

---

## 1. Criar Pedido (Checkout para Entrega em Casa)

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/orders` |
| **Descrição do Contrato** | Cria pedido com endereço residencial + coordenadas. Preços, subtotal, frete e total são **calculados no servidor**. Aplica preço promocional se o produto estiver em campanha ativa. Baixa estoque. |
| **Permissão** | 🔒 Bearer Token (role: `customer`) |

### Payload (Request Body)

```json
{
  "store_id": "44e1f3a2-9b0c-4d5e-8f7a-6b5c4d3e2f1a",
  "delivery_address": "Rua 21 de Janeiro, Casa 45, Luanda",
  "delivery_latitude": -8.839,
  "delivery_longitude": 13.289,
  "delivery_notes": "Casa azul com portão branco",
  "items": [
    { "product_id": "3f8a9c1e-6b7d-4e2f-9a0b-1c2d3e4f5a6b", "quantity": 2 }
  ]
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `store_id` | uuid | ✅ | Loja do pedido |
| `delivery_address` | string | ✅ | Endereço residencial do cliente |
| `delivery_latitude` | number | ✅ | Latitude (validada -90 a 90) |
| `delivery_longitude` | number | ✅ | Longitude (validada -180 a 180) |
| `delivery_notes` | string | ❌ | Referências de entrega |
| `items` | array | ✅ | Produtos e quantidades |

### Resposta / Status

#### `201 Created`

```json
{
  "id": "uuid-pedido",
  "order_number": "PED-2026-0001",
  "customer_id": "uuid-cliente",
  "store_id": "uuid-loja",
  "delivery_address": "Rua 21 de Janeiro, Casa 45, Luanda",
  "delivery_latitude": -8.83900000,
  "delivery_longitude": 13.28900000,
  "subtotal": 9000,
  "shipping_cost": 1500,
  "total_amount": 10500,
  "status": "pending",
  "created_at": "2026-09-28T10:00:00.000Z",
  "items": [
    {
      "product_id": "3f8a9c1e-6b7d-4e2f-9a0b-1c2d3e4f5a6b",
      "quantity": 2,
      "unit_price": 4500,
      "total_price": 9000
    }
  ]
}
```

> 💡 Se o produto estava em campanha ativa ("Sextou"), o `unit_price` já é o promocional.

#### `400 Bad Request` — estoque insuficiente ou produto inválido

```json
{ "statusCode": 400, "message": ["Estoque insuficiente para o produto: Arroz Panga 25kg"] }
```

#### `404 Not Found` — loja não encontrada ou inativa

---

## 2. Acompanhar Meus Pedidos

- `GET /orders/my` → lista paginada dos pedidos do cliente
- `GET /orders/:id` → detalhe de um pedido (apenas se for o dono)

### Cancelar pedido

| Campo | Valor |
|-------|-------|
| **Método** | `PATCH` |
| **Endpoint** | `/orders/:id/status` |
| **Descrição do Contrato** | O cliente só pode cancelar, e apenas enquanto o pedido está `pending`. |
| **Permissão** | 🔒 Bearer Token (role: `customer`) |

```json
{ "status": "cancelled" }
```

#### `400 Bad Request` — `Pedido só pode ser cancelado pelo cliente enquanto estiver pendente`

---

## 3. Rastreamento em Tempo Real (Mapa / OpenStreetMap)

### 3.1 Conexão WebSocket

| Campo | Valor |
|-------|-------|
| **URL** | `wss://api.kitanda.ao/realtime` |
| **Auth** | Token JWT no handshake: `{ auth: { token: "<access_token>" } }` |

Após conectar, entrar na sala da entrega:

```js
socket.emit('delivery:subscribe', '<uuid-entrega>');
// eventos recebidos:
socket.on('courier:position', (pos) => { /* seta no mapa */ });
socket.on('delivery:update', (d) => { /* status da entrega */ });
```

### Evento `courier:position` (seta em movimento)

```json
{
  "delivery_id": "uuid-entrega",
  "latitude": -8.83910000,
  "longitude": 13.28910000,
  "heading": 45.5,
  "speed": 32.4,
  "created_at": "2026-09-28T10:10:00.000Z"
}
```

| Campo | Descrição |
|-------|-----------|
| `latitude` / `longitude` | Posição atual (desenhar/mover a seta no OpenStreetMap) |
| `heading` | Ângulo de rotação da seta (0 a 360°) |
| `speed` | Velocidade atual (km/h) |

### Evento `delivery:update`

```json
{ "id": "uuid-entrega", "status": "in_transit", "courier_id": "uuid-estafeta" }
```

### 3.2 Endpoints REST de Apoio

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/deliveries/my` | Minhas entregas (paginado) |
| `GET` | `/deliveries/:id` | Detalhe da entrega |
| `GET` | `/deliveries/:id/track/latest` | Última posição conhecida (reidratar mapa) |
| `GET` | `/deliveries/:id/track/history` | Rota completa percorrida |

---

## 4. Download da Fatura (PDF)

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/invoices/download/:token` |
| **Descrição do Contrato** | Gera e baixa o PDF da fatura diretamente no telemóvel. O `token` vem no objeto da fatura (`download_token`) após a entrega ficar `delivered`. |
| **Permissão** | 🌐 Pública via token único (48 caracteres hex) |

### Resposta / Status

#### `200 OK`

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="FT-2026-0001.pdf"
```

#### `404 Not Found` — token inválido

#### `400 Bad Request` — fatura cancelada

### Listar minhas faturas

- `GET /invoices/my` → faturas do cliente autenticado (com `download_token` de cada uma)

---

## 5. Ver Produtos com Preço Promocional ("Sextou")

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/products` |
| **Descrição do Contrato** | Quando um produto está numa campanha ativa (dentro da janela `starts_at`–`ends_at`), a resposta inclui `promotional_price` e `has_active_promotion: true`. |
| **Permissão** | 🌐 Pública |

### Resposta (exemplo)

```json
{
  "data": [
    {
      "id": "3f8a9c1e-...",
      "title": "Arroz Panga 25kg",
      "price": 12500,
      "promotional_price": 9900,
      "has_active_promotion": true,
      "...": "..."
    }
  ]
}
```

### Campanhas ativas agora

- `GET /campaigns/active` → campanhas dentro da janela de datas (home "Sextou")
- `GET /campaigns/:id` → detalhe de uma campanha

---

## 6. Lives (Comprar ao Vivo)

### 6.1 Ver Lives ao Vivo

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/lives/live-now` |
| **Descrição do Contrato** | Lista as transmissões ao vivo agora, com dados da loja e `playback_url` (HLS/WebRTC). |
| **Permissão** | 🌐 Pública |

```json
{
  "data": [
    {
      "id": "uuid-live",
      "title": "Sextou com promoções ao vivo!",
      "playback_url": "https://cdn.stream.com/live/abc.m3u8",
      "status": "live",
      "store": { "id": "uuid-loja", "name": "Loja do João" }
    }
  ]
}
```

### 6.2 Chat da Live

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/lives/:id/comments` |
| **Descrição do Contrato** | Envia comentário ou pergunta. Perguntas (`is_question: true`) aparecem destacadas no painel do vendedor. |
| **Permissão** | 🔒 Bearer Token (qualquer utilizador autenticado) |

```json
{ "message": "Esse produto tem tamanho M?", "is_question": true }
```

### Receber comentários em tempo real

```js
socket.emit('live:subscribe', '<uuid-live>');
socket.on('live:comment', (comment) => { /* renderizar no chat */ });
```

### 6.3 Histórico

- `GET /lives/:id/comments` → comentários anteriores (paginado)
- `GET /lives/:id` → detalhe da transmissão

---

## 7. Entregas Disponíveis (Cliente Estafeta/Afiliado)

> Clientes podem ser afiliados/estafetas de uma loja. Nessas rotas o role `customer` é aceito.

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/deliveries/available` | Entregas pendentes das lojas onde sou estafeta/manager |
| `POST` | `/deliveries/:id/accept` | Aceitar entrega (fica `accepted`, com meu ID como courier) |
| `PATCH` | `/deliveries/:id/status` | `picking_up` → `in_transit` → `delivered` (ao terminar, pedido fica `delivered` e fatura é emitida) |
| `POST` | `/deliveries/:id/track` | Enviar posição GPS |

### Payload de posição GPS

```json
{
  "latitude": -8.8391,
  "longitude": 13.2891,
  "heading": 45.5,
  "speed": 32.4
}
```

> Envie a cada 3–5 segundos durante a entrega. Cada sinal é gravado em `delivery_tracking_logs` e transmitido ao cliente via WebSocket.

---

## 8. Regras de Negócio Aplicadas (Resumo)

| # | Regra | Onde |
|---|-------|------|
| 2 | Checkout grava endereço + coordenadas do cliente no pedido | `POST /orders` |
| 2 | Confirmação do vendedor cria entrega automaticamente | (transparente ao cliente) |
| 3 | Posição do estafeta via REST → WebSocket `courier:position` | `POST /deliveries/:id/track` |
| 4 | Entrega `delivered` emite fatura; PDF via `download_token` | `GET /invoices/download/:token` |
| 5 | Preço promocional aparece no catálogo quando campanha ativa | `GET /products` |
