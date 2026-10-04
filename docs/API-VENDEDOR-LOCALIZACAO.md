# 🛵 API 2 — Localização do Estafeta (App Vendedor/Estafeta)

> Contrato que o **app do estafeta** usa para enviar a posição GPS continuamente durante a entrega.
> Cada sinal enviado é gravado em `delivery_tracking_logs` e propagado automaticamente ao cliente via WebSocket (`courier:position`).
>
> 📄 Doc complementar (lado de quem consome): [`API-CLIENTE-LOCALIZACAO.md`](./API-CLIENTE-LOCALIZACAO.md)

---

## 1. Enviar Posição Atual (GPS)

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/deliveries/:id/track` |
| **Descrição do Contrato** | O estafeta atribuído à entrega envia `latitude` e `longitude` atuais. O backend grava um novo log de rastreamento (com `created_at` do servidor) e emite o evento `courier:position` para todos na sala da entrega — cliente e loja veem a seta mover no mapa em tempo real. |
| **Permissão** | 🔒 Bearer Token — apenas o **estafeta atribuído** (`deliveries.courier_id === user.id`) |

### Payload (Request Body)

```json
{
  "latitude": -8.8391,
  "longitude": 13.2891,
  "heading": 45.5,
  "speed": 32.4
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `latitude` | number | ✅ | Latitude atual (validada −90 a 90) |
| `longitude` | number | ✅ | Longitude atual (validada −180 a 180) |
| `heading` | number | ❌ | Ângulo de orientação do estafeta em graus (0–360). Rotaciona a seta no mapa do cliente |
| `speed` | number | ❌ | Velocidade atual em km/h. Permite ao cliente estimar ETA e suavizar a animação |

### Resposta / Status

#### `201 Created`

```json
{
  "message": "Posição registada",
  "delivery_id": "uuid-entrega",
  "latitude": -8.8391,
  "longitude": 13.2891
}
```

#### `400 Bad Request` — payload inválido (ex.: latitude fora do intervalo)

```json
{ "statusCode": 400, "message": ["latitude must be a latitude string or number"] }
```

#### `404 Not Found` — entrega não encontrada

#### `403 Forbidden` — utilizador não é o estafeta atribuído à entrega

---

## 2. Campo `updated_at` (timestamp da posição)

O app **não precisa enviar** `updated_at`:

- O backend grava um registo novo a cada `POST /deliveries/:id/track` e carimba `created_at` (UTC, `timestamptz`) **no servidor**.
- Esse `created_at` é o valor que o frontend recebe como "momento da posição" (equivalente ao `updated_at` pretendido), tanto no REST (`/track/latest`, `/track/history`) como no evento WebSocket `courier:position`.
- Usar o relógio do servidor evita problemas de relógios dessincronizados nos telemóveis.

> 💡 Se o app quiser guardar o seu próprio `updated_at` local para telemetria, pode — o backend simplesmente ignora campos extras.

---

## 3. Quando Enviar a Posição

O app deve manter um **loop de GPS em segundo plano** enquanto a entrega está em curso:

| Status da entrega | Enviar posição? |
|-------------------|-----------------|
| `pending` | ❌ Ainda não aceite |
| `accepted` | ❌ Aguardando deslocamento até a loja (opcional enviar, não bloqueia) |
| `picking_up` | ✅ Sim — a caminho da loja |
| `in_transit` | ✅ **Sim — rastreamento principal (caminho da loja ao cliente)** |
| `delivered` / `cancelled` | ❌ Parar o loop e limpar o rastreamento |

### Frequência recomendada (comportamento tipo Yango)

| Estratégia | Regra |
|-----------|-------|
| **Por tempo** | Enviar a cada **3–5 segundos** enquanto se move |
| **Por distância** | Ou a cada **10–20 metros** de deslocamento (o que ocorrer primeiro) |
| **Parado** | Se o estafeta estiver parado > 30 s, reduzir para 1 sinal a cada 15–30 s (economiza bateria/dados) |
| **Sem sinal** | Se ficar offline, acumular posições e reenviar em lote ao reconectar (cada POST é independente; o histórico fica completo) |

> Cada POST cria um registo em `delivery_tracking_logs` (latitude, longitude, heading, speed, created_at). O histórico completo fica disponível em `GET /deliveries/:id/track/history`.

---

## 4. Fluxo Completo do Estafeta

```text
1. POST /deliveries/:id/accept        → fica courier da entrega
2. PATCH /deliveries/:id/status       → status = picking_up
3. Iniciar loop de GPS (3–5 s)
   └─ POST /deliveries/:id/track      → cada chamada atualiza o mapa do cliente em tempo real
4. PATCH /deliveries/:id/status       → status = in_transit (a caminho do cliente)
5. Chegou ao destino
   └─ PATCH /deliveries/:id/status    → status = delivered
6. Parar loop de GPS
```

> ⚠️ Não é necessário emitir nada por WebSocket: o backend faz o reencaminhamento.
> O estafeta **só envia REST** (`POST /track`); o cliente **só consome** (WebSocket + REST de consulta).

---

## 5. Resumo de Endpoints e Campos

| Método | Endpoint | Quem usa | Descrição |
|--------|----------|----------|-----------|
| `POST` | `/deliveries/:id/track` | Estafeta | Envia posição GPS (gravada + propagada em tempo real) |
| `GET` | `/deliveries/:id/track/latest` | Estafeta/Cliente/Loja/Admin | Última posição conhecida |
| `GET` | `/deliveries/:id/track/history` | Estafeta/Cliente/Loja/Admin | Rota completa percorrida |

### Campos expostos por posição (log de rastreamento)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | ID do registo |
| `delivery_id` | uuid | Entrega associada |
| `latitude` | number | Latitude (−90 a 90, precisão 8 casas) |
| `longitude` | number | Longitude (−180 a 180, precisão 8 casas) |
| `heading` | number \| null | Orientação da seta (0–360°) |
| `speed` | number \| null | Velocidade (km/h) |
| `created_at` | string (ISO 8601, UTC) | Momento da posição — **timestamp autoritativo** (equivalente ao `updated_at`) |
