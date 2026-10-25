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
# 📱 API — App Cliente

> Endpoints que a **app de clientes** usa para explorar o marketplace, ver lojas, produtos e conversar com vendedores.

---

## 1. Ver Loja por URL (slug)

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/stores/public/{slug}` |
| **Descrição do Contrato** | Acessa a página pública de uma loja pelo seu "slug" (URL amigável). Retorna dados da loja, plano e dono. |
| **Permissão** | 🔓 Público (sem autenticação) |

### Payload (Request Body)

Nenhum.

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

## 2. Listar Todos os Produtos

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/products` |
| **Descrição do Contrato** | Lista produtos de todas as lojas ativas. Suporta paginação, pesquisa e filtros por categoria/loja. |
| **Permissão** | 🔓 Público |

### Payload (Query Parameters)

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `page` | number | ❌ | Página (padrão: 1) |
| `limit` | number | ❌ | Itens por página (padrão: 20) |
| `search` | string | ❌ | Pesquisar por título do produto |
| `categoryId` | number | ❌ | Filtrar por categoria |
| `storeId` | string | ❌ | Filtrar por loja (UUID) |

### Resposta / Status

#### `200 OK`

```json
{
  "data": [
    {
      "id": "produto-uuid",
      "title": "iPhone 15 Pro Max",
      "description": "O melhor iPhone de todos os tempos",
      "price": 150000,
      "stock_quantity": 10,
      "shipping_type": "paid",
      "shipping_cost": 5000,
      "is_active": true,
      "images": [
        {"url": "https://example.com/product.jpg"}
      ],
      "store": {
        "id": "loja-uuid",
        "name": "Loja do João"
      },
      "category": {
        "id": 1,
        "name": "Eletrónicos"
      },
      "created_at": "2025-01-15T10:00:00.000Z"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

---

## 3. Ver Detalhes de um Produto

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/products/{id}` |
| **Descrição do Contrato** | Retorna todos os dados de um produto específico, incluindo imagens, loja e categoria. |
| **Permissão** | 🔓 Público |

### Payload (Request Body)

Nenhum.

### Resposta / Status

#### `200 OK`

```json
{
  "id": "produto-uuid",
  "title": "iPhone 15 Pro Max",
  "description": "O melhor iPhone de todos os tempos",
  "price": 150000,
  "stock_quantity": 10,
  "shipping_type": "paid",
  "shipping_cost": 5000,
  "is_active": true,
  "images": [
    {"url": "https://example.com/product1.jpg"},
    {"url": "https://example.com/product2.jpg"}
  ],
  "attribute_values": [
    {"attribute_id": 1, "name": "Cor", "value": "Preto"},
    {"attribute_id": 2, "name": "Memória", "value": "256GB"}
  ],
  "store": {
    "id": "loja-uuid",
    "name": "Loja do João",
    "slug": "loja-do-joao"
  },
  "category": {
    "id": 1,
    "name": "Eletrónicos"
  },
  "created_at": "2025-01-15T10:00:00.000Z"
}
```

#### `404 Not Found`

```json
{
  "statusCode": 404,
  "message": "Produto não encontrado",
  "error": "Not Found"
}
```

---

## 4. Listar Categorias (Árvore)

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/categories` |
| **Descrição do Contrato** | Retorna categorias organizadas em hierarquia (mãe → filhas). Ideal para menus e filtros. |
| **Permissão** | 🔓 Público |

### Payload (Request Body)

Nenhum.

### Resposta / Status

#### `200 OK`

```json
[
  {
    "id": 1,
    "name": "Eletrónicos",
    "slug": "eletronicos",
    "children": [
      {
        "id": 2,
        "name": "Smartphones",
        "slug": "smartphones",
        "children": []
      },
      {
        "id": 3,
        "name": "Computadores",
        "slug": "computadores",
        "children": []
      }
    ]
  },
  {
    "id": 4,
    "name": "Roupas",
    "slug": "roupas",
    "children": []
  }
]
```

---

## 5. Listar Categorias (Flat)

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/categories/flat` |
| **Descrição do Contrato** | Retorna categorias numa lista simples (sem hierarquia). Ideal para dropdowns. |
| **Permissão** | 🔓 Público |

### Payload (Request Body)

Nenhum.

### Resposta / Status

#### `200 OK`

```json
[
  {"id": 1, "name": "Eletrónicos", "slug": "eletronicos", "parent_id": null},
  {"id": 2, "name": "Smartphones", "slug": "smartphones", "parent_id": 1},
  {"id": 3, "name": "Computadores", "slug": "computadores", "parent_id": 1},
  {"id": 4, "name": "Roupas", "slug": "roupas", "parent_id": null}
]
```

---

## 6. Ver Atributos de uma Categoria

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/categories/{id}/attributes` |
| **Descrição do Contrato** | Retorna os atributos de uma categoria (ex: Cor, Tamanho). Usado para filtrar produtos. |
| **Permissão** | 🔓 Público |

### Payload (Request Body)

Nenhum.

### Resposta / Status

#### `200 OK`

```json
[
  {"id": 1, "name": "Cor", "type": "text"},
  {"id": 2, "name": "Tamanho", "type": "select"}
]
```

---

## 7. Listar Planos Disponíveis

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/plans` |
| **Descrição do Contrato** | Lista os planos de assinatura para vendedores. Útil para clientes verem os planos antes de se tornarem vendedores. |
| **Permissão** | 🔓 Público |

### Payload (Request Body)

Nenhum.

### Resposta / Status

#### `200 OK`

```json
[
  {
    "id": 1,
    "name": "Normal",
    "tier": "normal",
    "monthly_price": 10000,
    "max_products": 50,
    "allow_flyer_ads": false,
    "allow_banner_ads": false,
    "allow_video_ads": false
  },
  {
    "id": 2,
    "name": "Black",
    "tier": "black",
    "monthly_price": 25000,
    "max_products": 200,
    "allow_flyer_ads": true,
    "allow_banner_ads": false,
    "allow_video_ads": false
  },
  {
    "id": 3,
    "name": "Premium",
    "tier": "premium",
    "monthly_price": 50000,
    "max_products": 0,
    "allow_flyer_ads": true,
    "allow_banner_ads": true,
    "allow_video_ads": true
  }
]
```

> `max_products: 0` = ilimitado

---

## 8. Ver Anúncios Ativos

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/advertisements/active` |
| **Descrição do Contrato** | Lista todos os anúncios aprovados e dentro do período de 14 dias. Visível a TODOS os utilizadores (clientes e vendedores). |
| **Permissão** | 🔓 Público |

### Payload (Request Body)

Nenhum.

### Resposta / Status

#### `200 OK`

```json
[
  {
    "id": "anuncio-uuid",
    "title": "Promoção de Verão - 50% OFF",
    "media_url": "https://example.com/ad-banner.jpg",
    "target_url": "https://example.com/promocao",
    "start_date": "2025-01-15T10:00:00.000Z",
    "end_date": "2025-01-29T10:00:00.000Z",
    "impressions_count": 1500,
    "clicks_count": 200,
    "store": {
      "id": "loja-uuid",
      "name": "Loja do João"
    },
    "ad_plan": {
      "id": 1,
      "name": "Flyer",
      "duration_days": 14
    }
  }
]
```

---

## 9. Ver Planos de Publicidade

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/advertisements/plans` |
| **Descrição do Contrato** | Lista os tipos de anúncio disponíveis (flyer, banner, vídeo). |
| **Permissão** | 🔓 Público |

### Payload (Request Body)

Nenhum.

### Resposta / Status

#### `200 OK`

```json
[
  {
    "id": 1,
    "name": "Flyer",
    "ad_type": "image",
    "placement": "feed",
    "duration_days": 14,
    "price": 5000,
    "is_active": true
  },
  {
    "id": 2,
    "name": "Banner",
    "ad_type": "image",
    "placement": "store_page",
    "duration_days": 14,
    "price": 15000,
    "is_active": true
  }
]
```

---

## 10. Criar Chat com Vendedor

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/chat/rooms` |
| **Descrição do Contrato** | Cliente inicia conversa com uma loja. Se já existir sala, retorna a existente (não cria duplicada). |
| **Permissão** | 🔒 Bearer Token |

### Payload (Request Body)

```json
{
  "store_id": "loja-uuid",
  "product_id": "produto-uuid"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `store_id` | string (UUID) | ✅ | ID da loja para conversar |
| `product_id` | string (UUID) | ❌ | ID do produto (opcional) |

### Resposta / Status

#### `200 OK`

```json
{
  "id": "sala-uuid",
  "customer": {
    "id": "cliente-uuid",
    "name": "Maria"
  },
  "store": {
    "id": "loja-uuid",
    "name": "Loja do João"
  },
  "created_at": "2025-01-15T10:00:00.000Z"
}
```

#### `403 Forbidden`

```json
{
  "statusCode": 403,
  "message": "Não pode criar chat consigo mesmo",
  "error": "Forbidden"
}
```

---

## 11. Listar Minhas Salas de Chat

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/chat/rooms` |
| **Descrição do Contrato** | Lista todas as salas de chat do utilizador com contagem de não lidas. |
| **Permissão** | 🔒 Bearer Token |

### Payload (Request Body)

Nenhum.

### Resposta / Status

#### `200 OK`

```json
[
  {
    "id": "sala-uuid",
    "store": {
      "id": "loja-uuid",
      "name": "Loja do João"
    },
    "last_message": {
      "content": "Olá! Tem este produto?",
      "created_at": "2025-01-15T10:30:00.000Z"
    },
    "unread_count": 2
  }
]
```

---

## 12. Ver Mensagens de uma Sala

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/chat/rooms/{roomId}/messages` |
| **Descrição do Contrato** | Lista mensagens de uma sala com paginação. |
| **Permissão** | 🔒 Bearer Token |

### Payload (Query Parameters)

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `page` | number | ❌ | Página (padrão: 1) |
| `limit` | number | ❌ | Mensagens por página (padrão: 50) |

### Resposta / Status

#### `200 OK`

```json
{
  "data": [
    {
      "id": "msg-uuid",
      "sender_id": "cliente-uuid",
      "content": "Olá! Tem este produto?",
      "media_url": null,
      "document_url": null,
      "is_read": true,
      "created_at": "2025-01-15T10:00:00.000Z"
    },
    {
      "id": "msg-uuid-2",
      "sender_id": "vendedor-uuid",
      "content": "Sim, temos disponível!",
      "is_read": false,
      "created_at": "2025-01-15T10:05:00.000Z"
    }
  ],
  "total": 25,
  "page": 1,
  "limit": 50
}
```

---

## 13. Enviar Mensagem

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/chat/rooms/{roomId}/messages` |
| **Descrição do Contrato** | Envia mensagem numa sala de chat. Suporta texto, imagens e documentos. |
| **Permissão** | 🔒 Bearer Token |

### Payload (Request Body)

```json
{
  "content": "Quanto custa?",
  "media_url": null,
  "document_url": null
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `content` | string | ✅ | Texto da mensagem |
| `media_url` | string | ❌ | URL de imagem/vídeo |
| `document_url` | string | ❌ | URL de documento |

### Resposta / Status

#### `201 Created`

```json
{
  "id": "msg-uuid",
  "sender_id": "cliente-uuid",
  "content": "Quanto custa?",
  "media_url": null,
  "document_url": null,
  "is_read": false,
  "created_at": "2025-01-15T10:30:00.000Z"
}
```

---

## 14. Marcar Mensagens como Lidas

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/chat/rooms/{roomId}/read` |
| **Descrição do Contrato** | Marca todas as mensagens não lidas de uma sala como lidas. |
| **Permissão** | 🔒 Bearer Token |

### Payload (Request Body)

Nenhum.

### Resposta / Status

#### `200 OK`

```json
{
  "message": "Mensagens marcadas como lidas"
}
```

---

## 15. Upload de Imagem

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/uploads/image` |
| **Descrição do Contrato** | Upload de imagem para Cloudinary. Máximo 5MB. Formatos: JPG, PNG, GIF, WebP. |
| **Permissão** | 🔒 Bearer Token |

### Payload (Request Body)

Content-Type: `multipart/form-data`

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `file` | file | ✅ | Ficheiro de imagem (max 5MB) |

### Resposta / Status

#### `200 OK`

```json
{
  "message": "Imagem enviada com sucesso",
  "url": "https://res.cloudinary.com/xxx/image/upload/xxx.jpg",
  "file_key": "images/1700000000000-a1b2c3d4.jpg"
}
```

#### `400 Bad Request`

```json
{
  "statusCode": 400,
  "message": "Nenhum ficheiro fornecido",
  "error": "Bad Request"
}
```

---

## 16. Ver Meu Perfil

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/auth/profile` |
| **Descrição do Contrato** | Retorna os dados do utilizador autenticado. |
| **Permissão** | 🔒 Bearer Token |

### Payload (Request Body)

Nenhum.

### Resposta / Status

#### `200 OK`

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Maria Silva",
  "email": "maria@email.com",
  "phone": "+244 923 456 789",
  "avatar_url": "https://example.com/avatar.jpg",
  "user_type": "customer",
  "is_email_verified": true,
  "created_at": "2025-01-01T10:00:00.000Z"
}
```

---

## 17. Atualizar Meu Perfil

| Campo | Valor |
|-------|-------|
| **Método** | `PUT` |
| **Endpoint** | `/users/{id}` |
| **Descrição do Contrato** | Atualiza dados do perfil. O utilizador só pode atualizar o seu próprio perfil. |
| **Permissão** | 🔒 Bearer Token |

### Payload (Request Body)

```json
{
  "name": "Maria Silva",
  "phone": "+244 923 456 789",
  "avatar_url": "https://example.com/novo-avatar.jpg"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `name` | string | ❌ | Nome completo |
| `phone` | string | ❌ | Telefone |
| `avatar_url` | string | ❌ | URL do avatar |

### Resposta / Status

#### `200 OK`

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Maria Silva",
  "email": "maria@email.com",
  "phone": "+244 923 456 789",
  "avatar_url": "https://example.com/novo-avatar.jpg",
  "user_type": "customer",
  "updated_at": "2025-01-15T10:00:00.000Z"
}
```

---

## Resumo — App Cliente

| # | Método | Endpoint | Descrição | Permissão |
|---|--------|----------|-----------|-----------|
| 1 | `GET` | `/stores/public/{slug}` | Ver loja por URL | 🔓 |
| 2 | `GET` | `/products` | Listar produtos | 🔓 |
| 3 | `GET` | `/products/{id}` | Ver produto | 🔓 |
| 4 | `GET` | `/categories` | Categorias (árvore) | 🔓 |
| 5 | `GET` | `/categories/flat` | Categorias (lista) | 🔓 |
| 6 | `GET` | `/categories/{id}/attributes` | Atributos da categoria | 🔓 |
| 7 | `GET` | `/plans` | Planos disponíveis | 🔓 |
| 8 | `GET` | `/advertisements/active` | Anúncios ativos (14 dias) | 🔓 |
| 9 | `GET` | `/advertisements/plans` | Planos de publicidade | 🔓 |
| 10 | `POST` | `/chat/rooms` | Criar chat com loja | 🔒 |
| 11 | `GET` | `/chat/rooms` | Minhas salas de chat | 🔒 |
| 12 | `GET` | `/chat/rooms/{id}/messages` | Mensagens da sala | 🔒 |
| 13 | `POST` | `/chat/rooms/{id}/messages` | Enviar mensagem | 🔒 |
| 14 | `POST` | `/chat/rooms/{id}/read` | Marcar como lidas | 🔒 |
| 15 | `POST` | `/uploads/image` | Upload de imagem | 🔒 |
| 16 | `GET` | `/auth/profile` | Ver perfil | 🔒 |
| 17 | `PUT` | `/users/{id}` | Atualizar perfil | 🔒 |

---

> **Fluxo típico do Cliente:**
> 1. Registar/Login → `POST /auth/register` ou `/auth/login`
> 2. Explorar lojas → `GET /stores/public/{slug}`
> 3. Ver produtos → `GET /products?search=...`
> 4. Iniciar chat → `POST /chat/rooms`
> 5. Enviar mensagem → `POST /chat/rooms/{id}/messages`
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
# 🆕 API — Novas Funcionalidades (v2)

> Documento **separado** dos anteriores (`API-ADMIN.md`, `API-VENDEDOR.md`, `API-CLIENTE.md`).
> Cobre as novas tabelas/colunas: **WhatsApp + redes sociais nas lojas**, **Reels estilo TikTok nos anúncios**, **seguidores no chat** e **mensagens ligadas a Reels**.
> Organizado por perfil: **1 admin, 1 vendedor, 1 cliente**.

---

## 🔐 Perfis

| Perfil | Role | Token |
|--------|------|-------|
| Admin | `admin` | 🔒 Bearer Token |
| Vendedor | `seller` | 🔒 Bearer Token |
| Cliente | `customer` | 🔒 Bearer Token (algumas rotas públicas) |

> ⚠️ Temporário: o rate limit global (20 req/min por IP) está **desativado** durante os testes de carga (`ThrottlerGuardImpl` retorna `true`). Reverter após os testes.

---

## 1. 💬 WhatsApp e Redes Sociais da Loja (Vendedor)

| Campo | Valor |
|-------|-------|
| **Método** | `PUT` / `PATCH` |
| **Endpoint** | `/stores/:id` |
| **Descrição do Contrato** | Atualiza dados de contacto e redes sociais da loja. O **número WhatsApp é normalizado automaticamente por trigger no PostgreSQL**: o sistema adiciona o prefixo `244` e gera o link `https://wa.me/244XXXXXXXXX`. |
| **Permissão** | 🔒 Bearer Token (role: `seller`, dono da loja) |

### Payload (Request Body)

```json
{
  "whatsapp_number": "923000000",
  "instagram_url": "https://instagram.com/lojadojoao",
  "facebook_url": "https://facebook.com/lojadojoao",
  "tiktok_url": "https://tiktok.com/@lojadojoao",
  "youtube_url": "https://youtube.com/@lojadojoao"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `whatsapp_number` | string | ❌ | Número local (ex: `923000000`) ou já com `244`. Normalizado para `244923000000` |
| `whatsapp_link` | string | ❌ | Gerado automaticamente — **não enviar** |
| `instagram_url` | string | ❌ | URL do perfil no Instagram |
| `facebook_url` | string | ❌ | URL da página no Facebook |
| `tiktok_url` | string | ❌ | URL do perfil no TikTok |
| `youtube_url` | string | ❌ | URL do canal no YouTube |

### Comportamento do trigger (`format_angola_whatsapp_link`)

| Input | Valores gravados |
|-------|------------------|
| `923000000` | `whatsapp_number = 244923000000`, `whatsapp_link = https://wa.me/244923000000` |
| `+244 923 000 000` | `whatsapp_number = 244923000000`, `whatsapp_link = https://wa.me/244923000000` |
| `NULL` / `''` | `whatsapp_link = NULL` |

### Resposta / Status

#### `200 OK` — todos os perfis (admin pode verpublicamente a loja)

```json
{
  "id": "loja-uuid",
  "whatsapp_number": "244923000000",
  "whatsapp_link": "https://wa.me/244923000000",
  "instagram_url": "https://instagram.com/lojadojoao",
  "facebook_url": null,
  "tiktok_url": null,
  "youtube_url": null
}
```

#### `403 Forbidden` — outro vendedor tenta atualizar loja que não é sua

```json
{ "statusCode": 403, "message": "Sem permissão" }
```

---

## 2. 📄 Ver Dados de Contacto da Loja (Cliente)

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/stores/public/:slug` |
| **Descrição do Contrato** | Endpoint público da loja. Inclui agora `whatsapp_link` e redes sociais para o cliente contactar o vendedor ou seguir a loja. |
| **Permissão** | 🌐 Pública |

### Resposta / Status

#### `200 OK`

```json
{
  "id": "loja-uuid",
  "name": "Loja do João",
  "slug": "loja-do-joao",
  "whatsapp_number": "244923000000",
  "whatsapp_link": "https://wa.me/244923000000",
  "instagram_url": "https://instagram.com/lojadojoao",
  "facebook_url": "https://facebook.com/lojadojoao",
  "tiktok_url": "https://tiktok.com/@lojadojoao",
  "youtube_url": null
}
```

---

## 3. 🎬 Criar Anúncio/Reels (Vendedor)

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/advertisements` |
| **Descrição do Contrato** | Cria anúncio com opção de vídeo vertical tipo Reels estilo TikTok. Contadores de engagement começam em 0 e crescem com interações dos clientes. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

### Payload (Request Body)

```json
{
  "title": "Promoção de Fim de Ano",
  "media_url": "https://cdn.exemplo.com/video-vertical.mp4",
  "is_reels": true,
  "product_id": "produto-uuid",
  "ad_plan_id": 1,
  "start_date": "2026-10-10T00:00:00.000Z",
  "end_date": "2026-11-10T00:00:00.000Z"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `title` | string | ✅ | Título (até 1500 caracteres) |
| `media_url` | string | ✅ | URL do vídeo/imagem |
| `is_reels` | boolean | ❌ | `true` se for vídeo vertical estilo TikTok/Reels (padrão: `false`) |
| `product_id` | uuid | ❌ | Produto associado |
| `ad_plan_id` | number | ✅ | Plano do anúncio |
| `start_date` / `end_date` | date | ✅ | Período de exibição |

### Resposta / Status

#### `201 Created` — todos os perfis

```json
{
  "id": "anuncio-uuid",
  "title": "Promoção de Fim de Ano",
  "is_reels": true,
  "likes_count": 0,
  "comments_count": 0,
  "saves_count": 0,
  "shares_count": 0,
  "status": "pending_approval"
}
```

> ⚠️ Anúncios novos ficam `pending_approval` até o admin aprovar.

---

## 4. 📱 Feed de Reels (Cliente)

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/advertisements/active?is_reels=true` |
| **Descrição do Contrato** | Lista anúncios ativos approvedos para o feed estilo TikTok. Cada item traz os contadores de engagement para os ícones do coração, comentários, guardar e partilha. |
| **Permissão** | 🌐 Pública |

### Query Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `is_reels` | boolean | ❌ | Filtrar só vídeos verticais/Reels |

### Resposta / Status

#### `200 OK`

```json
{
  "data": [
    {
      "id": "anuncio-uuid",
      "title": "Promoção de Fim de Ano",
      "media_url": "https://cdn.exemplo.com/video-vertical.mp4",
      "is_reels": true,
      "likes_count": 276600,
      "comments_count": 3501,
      "saves_count": 13000,
      "shares_count": 4586,
      "store": {
        "name": "Loja do João",
        "whatsapp_link": "https://wa.me/244923000000"
      }
    }
  ]
}
```

### Formatação dos contadores no frontend

| Valor bruto | Exibição |
|-------------|----------|
| `276600` | `276.6K` (coração ❤️) |
| `3501` | `3.5K` (balão 💬) |
| `13000` | `13K` (guardar 🔖) |
| `4586` | `4.5K` (partilha 📤) |

---

## 5. 👤 Mensagem Ligada a um Reels (Cliente)

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/chat/rooms/:roomId/messages` |
| **Descrição do Contrato** | Envia mensagem dentro da sala de chat, com opção de anexar o Reels (`advertisement_id`). Mensagens podem ser enviadas diretamente sobre um vídeo, sem produto — neste caso `room_id` pode ser `NULL` no banco. |
| **Permissão** | 🔒 Bearer Token (role: `customer`) |

### Payload (Request Body)

```json
{
  "content": "Vi este vídeo e gostei! Ainda está disponível?",
  "advertisement_id": "anuncio-uuid"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `content` | string | ❌ | Texto da mensagem |
| `media_url` | string | ❌ | URL de imagem/vídeo |
| `advertisement_id` | uuid | ❌ | Reels ao qual a mensagem se refere |

### Resposta / Status

#### `201 Created`

```json
{
  "id": "mensagem-uuid",
  "room_id": "sala-uuid",
  "sender_id": "cliente-uuid",
  "content": "Vi este vídeo e gostei! Ainda está disponível?",
  "advertisement_id": "anuncio-uuid",
  "is_read": false,
  "expires_at": "2026-10-13T10:00:00.000Z"
}
```

> ℹ️ Mensagens expiram 72h após envio (ver `expires_at`).

---

## 6. ❤️ Marcar-se como Seguidor da Loja (Cliente)

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/chat/rooms` |
| **Descrição do Contrato** | Ao criar/juntar-se à sala de chat cliente↔loja, informa-se `is_following: true` se o cliente marca que segue a loja. Isto alimenta a lista "lojas que sigo". |
| **Permissão** | 🔒 Bearer Token (role: `customer`) |

### Payload (Request Body)

```json
{
  "store_id": "loja-uuid",
  "product_id": "produto-uuid",
  "is_following": true
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `store_id` | uuid | ✅ | Loja a seguir |
| `product_id` | uuid | ❌ | Produto em questão |
| `is_following` | boolean | ❌ | `true` indica que o cliente é seguidor (padrão: `false`) |

### Resposta / Status

#### `201 Created`

```json
{
  "id": "sala-uuid",
  "customer_id": "cliente-uuid",
  "store_id": "loja-uuid",
  "is_following": true,
  "created_at": "2026-10-10T10:00:00.000Z"
}
```

#### `409 Conflict` — sala já existe

```json
{ "statusCode": 409, "message": "Sala de chat já existe" }
```

---

## 7. 🛠️ Manutenção — Admin

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/advertisements/:id/approve` e `/advertisements/:id/reject` |
| **Descrição do Contrato** | Admin aprova ou rejeita Reels submetidos pelos vendedores antes de entrarem no feed público. |
| **Permissão** | 🔒 Bearer Token (role: `admin`) |

### Resposta / Status

#### `200 OK`

```json
{
  "id": "anuncio-uuid",
  "status": "approved"
}
```

---
---

## 🗄️ Alterações de Banco (resumo para os desenvolvedores)

> Migração completa: `database/migrations/2026-10-10-whatsapp-reels-follow.sql`

| Tabela | Colunas novas | Observação |
|--------|---------------|------------|
| `stores` | `whatsapp_number`, `whatsapp_link`, `instagram_url`, `facebook_url`, `tiktok_url`, `youtube_url` | Trigger normaliza número com prefixo `244` e gera link `wa.me` |
| `advertisements` | `is_reels`, `likes_count`, `comments_count`, `saves_count`, `shares_count` | Contadores de engagement do Reels, padrão `0` |
| `chat_rooms` | `is_following` | Indica se o cliente é seguidor da loja, padrão `false` |
| `messages` | `advertisement_id` (FK → `advertisements.id`), `room_id` agora nullable | Liga mensagem diretamente a um Reels |
# 🛒 API — Login Social (Clerk) — App Cliente

> Autenticação social com **Google** e **Apple** via Clerk. O frontend usa os componentes do Clerk (`<SignIn />`, botões Google/Apple) e envia o **token de sessão** para esta API, que valida, syncroniza o utilizador e devolve os tokens da aplicação (mesmo formato do `POST /auth/login`).

---

## Como funciona (fluxo geral)

```
Frontend (App Cliente)
  └─ Usuário toca "Entrar com Google" (ou Apple)
      └─ Clerk abre popup do Google/Apple e faz o login
          └─ useAuth().getToken() → clerk_token
              └─ Frontend envia POST /auth/social { clerk_token }
                  └─ API valida o token no servidor, cria/liga o utilizador
                      └─ API devolve access_token + refresh_token do Kitanda
```

> ⚠️ O Google/Apple **não fala diretamente com esta API**. Tudo é mediado pelo Clerk no frontend; o backend só valida o token.

---

## 1. Login / Registro Social (Google ou Apple)

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/auth/social` |
| **Descrição do Contrato** | Valida o token de sessão do Clerk, cria o utilizador na primeira vez (ou liga à conta existente com o mesmo email) e devolve os tokens da aplicação. Para o **App Cliente**, enviar `user_type: "customer"` ou omitir (default). |
| **Permissão** | 🌐 Pública (rate limit aplicado) |

### Payload (Request Body)

```json
{
  "clerk_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6Imlu...",
  "user_type": "customer"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `clerk_token` | string | ✅ | Token de sessão do Clerk (`useAuth().getToken()`) |
| `user_type` | string | ❌ | `customer` (default) ou `seller`. Não existe por aqui `admin` |

### Resposta / Status

#### `200 OK`

```json
{
  "user": {
    "id": "uuid-do-utilizador",
    "name": "Maria Domingos",
    "email": "maria@gmail.com",
    "user_type": "customer",
    "avatar_url": "https://img.clerk.com/..."
  },
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

> ✅ Na primeira vez o utilizador é criado com `is_email_verified: true` (confiado ao Clerk) e sem senha (`password_hash` nulo) — só entra por Google/Apple.

#### `401 Unauthorized`

```json
{
  "statusCode": 401,
  "message": "Token do Clerk inválido ou expirado",
  "error": "Unauthorized"
}
```

#### `409 Conflict`

```json
{
  "statusCode": 409,
  "message": "Este email já está ligado a outra conta social. Faça login normalmente.",
  "error": "Conflict"
}
```

---

## 2. Ligar Google/Apple a uma Conta Existente

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/auth/social/link` |
| **Descrição do Contrato** | Liga a conta social (Google/Apple) do token do Clerk à conta já autenticada. Depois disso, dá para entrar das duas formas (senha **ou** social). |
| **Permissão** | 🔒 Bearer Token |

### Payload (Request Body)

```json
{
  "clerk_token": "eyJhbGciOiJSUzI1NiIs..."
}
```

### Resposta / Status

#### `200 OK`

```json
{
  "message": "Conta social ligada com sucesso",
  "clerk_provider_email": "maria@gmail.com"
}
```

#### `409 Conflict` — conta social já está noutro utilizador:

```json
{
  "statusCode": 409,
  "message": "Esta conta social já está ligada a outro utilizador",
  "error": "Conflict"
}
```

---

## 3. Desligar Conta Social

| Campo | Valor |
|-------|-------|
| **Método** | `DELETE` |
| **Endpoint** | `/auth/social/unlink` |
| **Descrição do Contrato** | Remove a ligação com o Google/Apple. Só funciona se a conta tiver senha definida (senão ficaria sem forma de entrar). |
| **Permissão** | 🔒 Bearer Token |

### Resposta / Status

#### `200 OK`

```json
{ "message": "Conta social desligada com sucesso" }
```

#### `400 Bad Request`

```json
{
  "statusCode": 400,
  "message": "Defina uma senha antes de desligar a conta social, caso contrário perde o acesso",
  "error": "Bad Request"
}
```

> Use `POST /auth/change-password` (já documentado em [API-AUTH.md](API-AUTH.md)) para definir a primeira senha da conta criada por social.

---

## Regras Aplicadas (Resumo)

- O email do Google/Apple é único: se já houver conta com o mesmo email (criada por senha), a conta social é **ligada** a ela — não se cria duplicado.
- Utilizadores criados por social não têm senha: `POST /auth/login` (email/senha) devolve `401` até definirem uma senha.
- `access_token` expira em 15 min; renovar com `POST /auth/refresh` (ver [API-AUTH.md](API-AUTH.md)).
- Logout com `POST /auth/logout` revoga os tokens normalmente.
- Utilizadores do social entram direto como `customer`; upgrade para `seller` segue o fluxo normal do app.

## Resumo — App Cliente

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/auth/social` | POST | Entrar/criar conta com Google ou Apple |
| `/auth/social/link` | POST | Ligar social à conta atual (autenticado) |
| `/auth/social/unlink` | DELETE | Desligar conta social (autenticado) |
