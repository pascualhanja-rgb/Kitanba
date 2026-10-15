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
