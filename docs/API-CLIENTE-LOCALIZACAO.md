# 🗺️ API 2 — Localização do Estafeta (App Cliente)

> Contrato que o **app do cliente** usa para acompanhar o estafeta no mapa **em tempo real**, com comportamento igual ao rastreamento de entrega do Yango: marcador movendo-se suavemente, rota restante encolhendo conforme o progresso e setas apenas no trecho que falta percorrer.
>
> 📄 Doc complementar (lado de quem envia o GPS): [`API-VENDEDOR-LOCALIZACAO.md`](./API-VENDEDOR-LOCALIZACAO.md)

---

## 1. Fontes de Localização Disponíveis

O cliente tem **duas fontes complementares** para saber onde o estafeta está:

| Fonte | Quando usar | Latência |
|-------|-------------|----------|
| **WebSocket** `courier:position` | Durante o acompanhamento no mapa (tempo real, sem recarregar) | ~instantânea |
| **REST** `GET /deliveries/:id/track/latest` | Ao abrir/reidratar a tela do mapa, ou como fallback se o WebSocket cair | 1 chamada |
| **REST** `GET /deliveries/:id/track/history` | Desenhar a rota já percorrida desde o início | 1 chamada |

> O cliente **nunca envia** posição. O envio é responsabilidade do app do estafeta (`POST /deliveries/:id/track`, ver doc complementar). Cada sinal enviado por ele chega automaticamente ao cliente via WebSocket.

---

## 2. Tempo Real via WebSocket

### 2.1 Conexão

| Campo | Valor |
|-------|-------|
| **URL** | `wss://api.kitanda.ao/realtime` |
| **Auth** | Token JWT no handshake: `{ auth: { token: "<access_token>" } }` |

Após conectar, entrar na sala da entrega:

```js
socket.emit('delivery:subscribe', '<uuid-entrega>');
// eventos recebidos:
socket.on('courier:position', (pos) => { /* mover marcador no mapa */ });
socket.on('delivery:update', (d) => { /* status da entrega */ });
```

Ao sair da tela:

```js
socket.emit('delivery:unsubscribe', '<uuid-entrega>');
```

### 2.2 Evento `courier:position` (marcador em movimento)

Disparado **a cada nova posição** enviada pelo estafeta.

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

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `delivery_id` | uuid | Entrega sendo rastreada |
| `latitude` | number | Latitude atual do estafeta (desenhar/mover o marcador) |
| `longitude` | number | Longitude atual do estafeta |
| `heading` | number \| null | Orientação em graus (0–360) — rotaciona a seta do marcador |
| `speed` | number \| null | Velocidade em km/h — útil para ajustar a duração da animação |
| `created_at` | string (ISO 8601, UTC) | Momento da posição (timestamp do servidor, autoritativo) |

### 2.3 Evento `delivery:update` (mudança de status)

```json
{ "id": "uuid-entrega", "status": "in_transit", "courier_id": "uuid-estafeta", "completed_at": null }
```

Quando `status` = `delivered` ou `cancelled`, **parar o rastreamento** (congelar marcador, encerrar loop de polling).

---

## 3. Consulta via REST

### 3.1 Última Posição Conhecida

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/deliveries/:id/track/latest` |
| **Descrição do Contrato** | Retorna a última posição registada do estafeta. Usar ao abrir a tela do mapa para **reidratar** o marcador na posição atual sem esperar o próximo sinal. |
| **Permissão** | 🔒 Bearer Token — cliente da entrega, estafeta, dono da loja ou admin |

#### `200 OK`

```json
{
  "delivery_id": "uuid-entrega",
  "status": "in_transit",
  "courier_id": "uuid-estafeta",
  "position": {
    "id": "uuid-log",
    "delivery_id": "uuid-entrega",
    "latitude": -8.83910000,
    "longitude": 13.28910000,
    "heading": 45.5,
    "speed": 32.4,
    "created_at": "2026-09-28T10:10:00.000Z"
  }
}
```

> `position: null` → o estafeta ainda não enviou nenhuma posição (mostrar "Aguardando estafeta iniciar a entrega").

#### `403 Forbidden` / `404 Not Found`

### 3.2 Histórico Completo (rota percorrida)

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/deliveries/:id/track/history` |
| **Descrição do Contrato** | Todas as posições registadas da entrega, em ordem cronológica (ASC). Usar para desenhar a polyline da rota já percorrida. |
| **Permissão** | 🔒 Bearer Token — cliente da entrega, estafeta, dono da loja ou admin |

#### `200 OK`

```json
{
  "data": [
    { "id": "uuid-log-1", "latitude": -8.81000000, "longitude": 13.23000000, "heading": null, "speed": null, "created_at": "2026-09-28T10:05:00.000Z" },
    { "id": "uuid-log-2", "latitude": -8.82350000, "longitude": 13.24510000, "heading": 128.0, "speed": 24.0, "created_at": "2026-09-28T10:07:30.000Z" },
    { "id": "uuid-log-3", "latitude": -8.83910000, "longitude": 13.28910000, "heading": 45.5, "speed": 32.4, "created_at": "2026-09-28T10:10:00.000Z" }
  ]
}
```

### 3.3 Apoio

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/deliveries/my` | Descobrir a entrega ativa do cliente (paginado) |
| `GET` | `/deliveries/:id` | Detalhe da entrega: `pickup_latitude/longitude` (loja) e `delivery_latitude/longitude` (destino) — âncoras da rota |

---

## 4. Comportamento no Mapa (padrão Yango)

O backend fornece tudo que o frontend precisa; os itens abaixo são **responsabilidade do frontend** (React Native/Flutter/Web com OpenStreetMap/Leaflet/Mapbox):

### 4.1 Ciclo de vida

```text
Abrir tela de rastreamento
 1. GET /deliveries/:id                     → coordenadas loja (origem) e cliente (destino)
 2. GET /deliveries/:id/track/latest        → posição atual do estafeta (position pode ser null)
 3. GET /deliveries/:id/track/history       → polyline da rota já percorrida
 4. socket.emit('delivery:subscribe', id)   → entra em modo tempo real
 5. A cada 'courier:position'               → animar marcador + encolher rota restante
 6. 'delivery:update' com delivered/cancelled → congelar e encerrar
```

### 4.2 Requisitos de comportamento

| # | Requisito | Como implementar |
|---|-----------|------------------|
| 1 | **Marcador move-se suavemente (sem saltos)** | Ao receber `courier:position`, **interpolar** da posição anterior para a nova em ~1–2 s (lerp de coordenadas ou animação ao longo da linha da rota). Com `speed` alta, encurtar a animação; com `speed` baixa, prolongar. Nunca reposicionar instantaneamente. |
| 2 | **Mapa atualiza continuamente sem recarregar** | WebSocket empurra cada posição; a tela nunca recarrega. Se o socket desconectar, fazer polling de `GET /track/latest` a cada **5 s** e voltar ao socket na reconexão. |
| 3 | **Rota percorrida desaparece; rota restante encolhe** | A cada posição, **projetar** o ponto do estafeta sobre a polyline da rota (ponto mais próximo). A parte da polyline **antes** desse ponto vira "percorrida" (cinza/transparente ou removida); a parte **depois** permanece como rota restante. Recalcular a rota restante no serviço de rotas (OSRM/Valhalla) apenas quando o desvio do estafeta para a rota anterior for > ~30–50 m. |
| 4 | **Setas apenas no trecho restante** | Renderizar as setas sobre a polyline **recortada** do item 3 (do ponto projetado até o destino). Ao avançar, as setas atrás do estafeta somem naturalmente porque a polyline percorrida não é mais renderizada. |
| 5 | **Seta rotacionada na direção do movimento** | Usar `heading` do evento. Se `heading` vier `null`, calcular o bearing entre a posição anterior e a nova. |
| 6 | **Câmera acompanha** | Manter o estafeta visível: recentrar com animação quando ele sai de uma margem (~25%) da tela; nunca "teleportar" a câmera. |

### 4.3 Estados da tela

| Estado | Detecção | Renderização |
|--------|----------|--------------|
| Aguardando estafeta | `position: null` em `/track/latest` e nenhum evento recebido | Marcador fixo só no destino; texto "Estafeta iniciará a entrega em breve" |
| Em rota | Eventos `courier:position` chegando | Marcador animado + rota restante + setas |
| Entregue / Cancelado | `delivery:update` com `status` final | Congelar marcador na última posição; encerrar polling/socket |

---

## 5. Resumo de Endpoints e Campos

| Método | Endpoint / Evento | Descrição |
|--------|-------------------|-----------|
| `WS` | `delivery:subscribe` / `delivery:unsubscribe` | Entrar/sair da sala da entrega |
| `WS ⬇` | `courier:position` | Nova posição do estafeta (`latitude`, `longitude`, `heading`, `speed`, `created_at`) |
| `WS ⬇` | `delivery:update` | Status da entrega (`in_transit`, `delivered`, …) |
| `GET` | `/deliveries/:id/track/latest` | Última posição (reidratação/fallback de polling) |
| `GET` | `/deliveries/:id/track/history` | Rota completa percorrida |
| `GET` | `/deliveries/:id` | Âncoras da rota (loja → destino) |

> ✅ **Já implementado no backend (API v2):** persistência em `delivery_tracking_logs`, eventos WebSocket em tempo real, endpoints REST de consulta e permissões por papel (cliente/estafeta/loja/admin). O comportamento visual (animação suave, recorte da rota, setas) é implementado no frontend conforme a seção 4.
