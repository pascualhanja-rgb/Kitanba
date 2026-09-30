# 🏪 API — App Vendedor

> Endpoints que o **painel de vendedores** usa para gerir lojas, produtos, anúncios e comunicar com clientes.

---

## 1. Criar Loja

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/stores` |
| **Descrição do Contrato** | Cria uma nova loja. O vendedor só pode criar lojas com planos ativos. A loja fica `pending_approval` até o admin aprovar. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

### Payload (Request Body)

```json
{
  "name": "Loja do João",
  "description": "A melhor loja de Angola",
  "logo_url": "https://example.com/logo.png",
  "banner_url": "https://example.com/banner.jpg",
  "plan_id": 1
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `name` | string | ✅ | Nome da loja (até 1000 caracteres) |
| `description` | string | ❌ | Descrição da loja |
| `logo_url` | string | ❌ | URL do logo (upload primeiro via `/uploads/image`) |
| `banner_url` | string | ❌ | URL do banner |
| `plan_id` | number | ✅ | ID do plano (1=Normal, 2=Black, 3=Premium) |

### Resposta / Status

#### `201 Created`

```json
{
  "id": "loja-uuid",
  "name": "Loja do João",
  "slug": "loja-do-joao",
  "status": "pending_approval",
  "plan_id": 1,
  "created_at": "2025-01-15T10:00:00.000Z"
}
```

> ⚠️ A loja fica com status `pending_approval` até o admin aprovar.

#### `403 Forbidden`

```json
{
  "statusCode": 403,
  "message": "Sem permissão",
  "error": "Forbidden"
}
```

#### `403 Forbidden` — plano que não pertence ao vendedor

> Regra: o vendedor só pode usar o plano que lhe pertence. Se já possui loja ativa,
> só pode reutilizar o **mesmo plano**; plano diferente exige upgrade aprovado pelo admin.

```json
{
  "statusCode": 403,
  "message": "Você não tem permissão para usar este plano. Solicite um upgrade ao administrador."
}
```

| Cenário | Resultado |
|---------|-----------|
| Vendedor com loja Normal tenta criar loja com `plan_id: 2` (Black) ou `3` (Premium) | `403 Forbidden` — "Você não tem permissão para usar este plano..." |
| Vendedor com loja Black tenta criar loja com `plan_id: 3` (Premium) | `403 Forbidden` — "Você não tem permissão para usar este plano..." |
| Plano inexistente ou inativo | `403 Forbidden` — "Você não tem permissão para usar este plano." |

---

## 2. Listar Minhas Lojas

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/stores/my` |
| **Descrição do Contrato** | Lista todas as lojas do vendedor autenticado. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

### Payload (Query Parameters)

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `page` | number | ❌ | Página (padrão: 1) |
| `limit` | number | ❌ | Itens por página (padrão: 20) |

### Resposta / Status

#### `200 OK`

```json
{
  "data": [
    {
      "id": "loja-uuid",
      "name": "Loja do João",
      "slug": "loja-do-joao",
      "status": "active",
      "plan": {
        "id": 2,
        "name": "Black"
      },
      "subscription_end_date": "2025-02-15T10:00:00.000Z",
      "created_at": "2025-01-15T10:00:00.000Z"
    }
  ]
}
```

---

## 3. Ver Minha Loja (por ID)

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/stores/{id}` |
| **Descrição do Contrato** | Retorna todos os dados de uma loja específica. |
| **Permissão** | 🔒 Bearer Token |

### Payload (Request Body)

Nenhum.

### Resposta / Status

#### `200 OK`

```json
{
  "id": "loja-uuid",
  "name": "Loja do João",
  "slug": "loja-do-joao",
  "logo_url": "https://example.com/logo.png",
  "banner_url": "https://example.com/banner.jpg",
  "description": "A melhor loja de Angola",
  "status": "active",
  "plan": {
    "id": 2,
    "name": "Black",
    "tier": "black"
  },
  "subscription_end_date": "2025-02-15T10:00:00.000Z",
  "created_at": "2025-01-15T10:00:00.000Z"
}
```

---

## 4. Atualizar Loja

| Campo | Valor |
|-------|-------|
| **Método** | `PUT` / `PATCH` |
| **Endpoint** | `/stores/{id}` |
| **Descrição do Contrato** | Atualiza dados da loja. O vendedor só pode atualizar as suas próprias lojas. |
| **Permissão** | 🔒 Bearer Token (role: `seller` ou `admin`) |

### Payload (Request Body)

```json
{
  "name": "Loja do João - Atualizado",
  "description": "Nova descrição da loja",
  "logo_url": "https://example.com/novo-logo.png",
  "banner_url": "https://example.com/novo-banner.jpg"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `name` | string | ❌ | Nome da loja |
| `description` | string | ❌ | Descrição |
| `logo_url` | string | ❌ | URL do logo |
| `banner_url` | string | ❌ | URL do banner |

### Resposta / Status

#### `200 OK`

```json
{
  "id": "loja-uuid",
  "name": "Loja do João - Atualizado",
  "description": "Nova descrição da loja",
  "logo_url": "https://example.com/novo-logo.png",
  "banner_url": "https://example.com/novo-banner.jpg"
}
```

---

## 5. Criar Produto

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/products` |
| **Descrição do Contrato** | Cria um novo produto na loja do vendedor. O `store_id` é resolvido **automaticamente** a partir do token JWT. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

### Payload (Request Body)

```json
{
  "title": "iPhone 15 Pro Max",
  "description": "O melhor iPhone de todos os tempos",
  "price": 150000,
  "stock_quantity": 10,
  "category_id": 1,
  "shipping_type": "paid",
  "shipping_cost": 5000,
  "images": [
    {"url": "https://example.com/product1.jpg"},
    {"url": "https://example.com/product2.jpg"}
  ],
  "attribute_values": [
    {"attribute_id": 1, "value": "Preto"},
    {"attribute_id": 2, "value": "256GB"}
  ]
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `title` | string | ✅ | Nome do produto (até 1500 caracteres) |
| `description` | string | ❌ | Descrição detalhada |
| `price` | number | ✅ | Preço em Kz (ex: 150000) |
| `stock_quantity` | number | ✅ | Quantidade em estoque |
| `category_id` | number | ✅ | ID da categoria |
| `shipping_type` | string | ✅ | `"free"` ou `"paid"` |
| `shipping_cost` | number | ❌ | Custo de envio (se shipping_type=paid) |
| `images` | array | ❌ | Lista de URLs de imagens |
| `attribute_values` | array | ❌ | Valores dos atributos da categoria |

### Resposta / Status

#### `201 Created`

```json
{
  "id": "produto-uuid",
  "title": "iPhone 15 Pro Max",
  "price": 150000,
  "stock_quantity": 10,
  "is_active": true,
  "store_id": "loja-uuid",
  "category_id": 1,
  "shipping_type": "paid",
  "shipping_cost": 5000,
  "created_at": "2025-01-15T10:00:00.000Z"
}
```

---

## 6. Listar Produtos de uma Loja

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/products/store/{storeId}` |
| **Descrição do Contrato** | Lista todos os produtos de uma loja específica. |
| **Permissão** | 🔓 Público |

### Payload (Query Parameters)

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `page` | number | ❌ | Página (padrão: 1) |
| `limit` | number | ❌ | Itens por página (padrão: 20) |

### Resposta / Status

#### `200 OK`

```json
{
  "data": [
    {
      "id": "produto-uuid",
      "title": "iPhone 15 Pro Max",
      "price": 150000,
      "stock_quantity": 10,
      "is_active": true,
      "images": [{"url": "https://example.com/product.jpg"}],
      "created_at": "2025-01-15T10:00:00.000Z"
    }
  ],
  "total": 50,
  "page": 1,
  "limit": 20
}
```

---

## 7. Atualizar Produto

| Campo | Valor |
|-------|-------|
| **Método** | `PUT` / `PATCH` |
| **Endpoint** | `/products/{id}` |
| **Descrição do Contrato** | Atualiza dados de um produto. O vendedor só pode atualizar produtos da sua loja. |
| **Permissão** | 🔒 Bearer Token (role: `seller` ou `admin`) |

### Payload (Request Body)

```json
{
  "title": "iPhone 15 Pro Max - Atualizado",
  "price": 140000,
  "stock_quantity": 15
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `title` | string | ❌ | Nome do produto |
| `price` | number | ❌ | Preço |
| `stock_quantity` | number | ❌ | Estoque |
| `is_active` | boolean | ❌ | Ativar/desativar |

### Resposta / Status

#### `200 OK`

```json
{
  "id": "produto-uuid",
  "title": "iPhone 15 Pro Max - Atualizado",
  "price": 140000,
  "stock_quantity": 15,
  "updated_at": "2025-01-15T10:00:00.000Z"
}
```

---

## 8. Ativar/Desativar Produto

| Campo | Valor |
|-------|-------|
| **Método** | `PATCH` |
| **Endpoint** | `/products/{id}/toggle-active` |
| **Descrição do Contrato** | Alterna o estado de ativação de um produto (ativo ↔ inativo). |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

### Payload (Request Body)

Nenhum.

### Resposta / Status

#### `200 OK`

```json
{
  "id": "produto-uuid",
  "is_active": false,
  "message": "Produto desativado"
}
```

---

## 9. Eliminar Produto

| Campo | Valor |
|-------|-------|
| **Método** | `DELETE` |
| **Endpoint** | `/products/{id}` |
| **Descrição do Contrato** | Elimina um produto permanentemente. O vendedor só pode eliminar produtos da sua loja. |
| **Permissão** | 🔒 Bearer Token (role: `seller` ou `admin`) |

### Payload (Request Body)

Nenhum.

### Resposta / Status

#### `200 OK`

```json
{
  "message": "Produto eliminado com sucesso"
}
```

---

## 10. Criar Anúncio

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/advertisements` |
| **Descrição do Contrato** | Cria um novo anúncio (flyer, banner, vídeo). O `store_id` é resolvido automaticamente. O anúncio fica `pending_approval` até o admin aprovar. Após aprovação, fica visível por **14 dias**. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

### Payload (Request Body)

```json
{
  "title": "Promoção de Verão",
  "description": "Desconto de 20% em todos os produtos",
  "media_url": "https://example.com/ad-flyer.jpg",
  "ad_plan_id": 1,
  "product_id": "produto-uuid",
  "target_url": "https://example.com/promocao",
  "start_date": "2025-01-15T00:00:00Z"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `title` | string | ✅ | Título do anúncio (até 150 caracteres) |
| `ad_plan_id` | number | ✅ | ID do plano de publicidade |
| `media_url` | string | ❌ | URL da mídia (imagem/vídeo) |
| `product_id` | string (UUID) | ❌ | ID do produto associado |
| `target_url` | string | ❌ | URL ao clicar no anúncio |
| `start_date` | string | ✅ | Data de início (ISO 8601) |

### Resposta / Status

#### `201 Created`

```json
{
  "id": "anuncio-uuid",
  "title": "Promoção de Verão",
  "status": "pending_approval",
  "start_date": "2025-01-15T00:00:00.000Z",
  "end_date": "2025-01-29T00:00:00.000Z",
  "store_id": "loja-uuid",
  "ad_plan_id": 1,
  "created_at": "2025-01-15T10:00:00.000Z"
}
```

> Após aprovação do admin, o anúncio fica visível por **14 dias** para TODOS os utilizadores.

---

## 11. Listar Meus Anúncios

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/advertisements/my/{storeId}` |
| **Descrição do Contrato** | Lista todos os anúncios de uma loja do vendedor (pendentes, ativos, rejeitados). |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

### Payload (Request Body)

Nenhum.

### Resposta / Status

#### `200 OK`

```json
[
  {
    "id": "anuncio-uuid",
    "title": "Promoção de Verão",
    "status": "active",
    "media_url": "https://example.com/ad-flyer.jpg",
    "start_date": "2025-01-15T10:00:00.000Z",
    "end_date": "2025-01-29T10:00:00.000Z",
    "impressions_count": 1500,
    "clicks_count": 200,
    "ad_plan": {
      "id": 1,
      "name": "Flyer"
    }
  }
]
```

---

## 12. Listar Minhas Salas de Chat

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/chat/rooms` |
| **Descrição do Contrato** | Lista todas as salas de chat onde o vendedor participa. Mostra última mensagem e contagem de não lidas. |
| **Permissão** | 🔒 Bearer Token |

### Payload (Request Body)

Nenhum.

### Resposta / Status

#### `200 OK`

```json
[
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
    "last_message": {
      "content": "Quando chega?",
      "created_at": "2025-01-15T11:00:00.000Z"
    },
    "unread_count": 1
  }
]
```

---

## 13. Ver Mensagens

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
      "is_read": true,
      "created_at": "2025-01-15T10:00:00.000Z"
    }
  ],
  "total": 25,
  "page": 1,
  "limit": 50
}
```

---

## 14. Responder Mensagem

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/chat/rooms/{roomId}/messages` |
| **Descrição do Contrato** | Envia mensagem numa sala de chat. Suporta texto, imagens e documentos. |
| **Permissão** | 🔒 Bearer Token |

### Payload (Request Body)

```json
{
  "content": "Olá! Sim, temos disponível. Pode passar na loja!",
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
  "sender_id": "vendedor-uuid",
  "content": "Olá! Sim, temos disponível. Pode passar na loja!",
  "is_read": false,
  "created_at": "2025-01-15T10:05:00.000Z"
}
```

---

## 15. Marcar Mensagens como Lidas

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

## 16. Ver Pagamentos da Minha Loja

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **Endpoint** | `/subscriptions/my/{storeId}` |
| **Descrição do Contrato** | Lista todos os pagamentos de assinatura de uma loja. O vendedor só pode ver pagamentos das suas lojas. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

### Payload (Request Body)

Nenhum.

### Resposta / Status

#### `200 OK`

```json
[
  {
    "id": "pagamento-uuid",
    "amount": 25000,
    "status": "approved",
    "payment_proof_url": "https://example.com/comprovativo.pdf",
    "created_at": "2025-01-15T10:00:00.000Z"
  }
]
```

---

## 17. Solicitar Upgrade de Plano

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/stores/{id}/upgrade-request` |
| **Descrição do Contrato** | Solicita upgrade do plano da loja. O admin precisa aprovar. Inclui comprovativo de pagamento. |
| **Permissão** | 🔒 Bearer Token (role: `seller`) |

### Payload (Request Body)

```json
{
  "requested_plan_id": 3,
  "payment_proof_url": "https://example.com/comprovativo.pdf"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `requested_plan_id` | number | ✅ | ID do plano desejado (deve ser **superior** ao plano atual) |
| `payment_proof_url` | string | ❌ | URL do comprovativo de pagamento |

> Regra: hierarquia **Normal < Black < Premium**. Só é permitido pedir upgrade para plano
> **estritamente superior** ao atual. Plano igual ou inferior é rejeitado.

### Resposta / Status

#### `201 Created`

```json
{
  "id": "solicitacao-uuid",
  "status": "pending",
  "message": "Solicitação de upgrade enviada. Aguarda aprovação do admin."
}
```

#### `400 Bad Request` — plano igual ao atual

```json
{ "statusCode": 400, "message": "A loja já possui o plano Black. Escolha um plano superior para fazer upgrade." }
```

#### `403 Forbidden` — plano inferior, inexistente ou inativo

```json
{ "statusCode": 403, "message": "Você não tem permissão para usar este plano. O upgrade só é permitido para um plano superior." }
```

---

## 18. Upload Direto (Cloudinary)

### Imagem

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/uploads/image` |
| **Descrição do Contrato** | Upload de imagem para Cloudinary. Máximo 5MB. |
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

### Documento

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/uploads/document` |
| **Descrição do Contrato** | Upload de documento (comprovativo, identidade). Máximo 10MB. |
| **Permissão** | 🔒 Bearer Token |

### Payload (Request Body)

Content-Type: `multipart/form-data`

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `file` | file | ✅ | Ficheiro de documento (max 10MB) |

### Resposta / Status

#### `200 OK`

```json
{
  "message": "Documento enviado com sucesso",
  "url": "https://res.cloudinary.com/xxx/raw/upload/xxx.pdf",
  "file_key": "documents/1700000000000-a1b2c3d4.pdf"
}
```

---

## 19. Upload via Presigned URL (R2)

### Solicitar URL

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/uploads/presigned-url` |
| **Descrição do Contrato** | Gera URL temporária (1h) para upload direto ao Cloudflare R2. Ideal para vídeos, PDFs grandes. |
| **Permissão** | 🔒 Bearer Token |

### Payload (Request Body)

```json
{
  "filename": "video-anuncio.mp4",
  "content_type": "video/mp4",
  "folder": "videos",
  "max_size": 104857600
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `filename` | string | ✅ | Nome do ficheiro |
| `content_type` | string | ✅ | Tipo MIME (ex: video/mp4) |
| `folder` | string | ❌ | Pasta destino (padrão: images) |
| `max_size` | number | ❌ | Tamanho máximo em bytes |

### Resposta / Status

#### `200 OK`

```json
{
  "upload_url": "https://account.r2.cloudflarestorage.com/bucket/...",
  "file_key": "videos/1700000000000-a1b2c3d4.mp4",
  "public_url": "https://cdn.seudominio.com/videos/1700000000000-a1b2c3d4.mp4",
  "expires_in": 3600
}
```

### Confirmar Upload

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **Endpoint** | `/uploads/confirm` |
| **Descrição do Contrato** | Valida que o ficheiro existe no R2 e devolve a URL pública. Chamar DEPOIS do PUT. |
| **Permissão** | 🔒 Bearer Token |

### Payload (Request Body)

```json
{
  "file_key": "videos/1700000000000-a1b2c3d4.mp4",
  "original_name": "video-anuncio.mp4",
  "content_type": "video/mp4",
  "file_size": 52428800
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `file_key` | string | ✅ | Chave do ficheiro no R2 |
| `original_name` | string | ✅ | Nome original do ficheiro |
| `content_type` | string | ✅ | Tipo MIME |
| `file_size` | number | ✅ | Tamanho em bytes |

### Resposta / Status

#### `200 OK`

```json
{
  "url": "https://cdn.seudominio.com/videos/1700000000000-a1b2c3d4.mp4",
  "file_key": "videos/1700000000000-a1b2c3d4.mp4",
  "confirmed": true
}
```

---

## Resumo — App Vendedor

| # | Método | Endpoint | Descrição | Permissão |
|---|--------|----------|-----------|-----------|
| 1 | `POST` | `/stores` | Criar loja | 🔒 seller |
| 2 | `GET` | `/stores/my` | Minhas lojas | 🔒 seller |
| 3 | `GET` | `/stores/{id}` | Ver loja | 🔒 |
| 4 | `PUT` | `/stores/{id}` | Atualizar loja | 🔒 seller |
| 5 | `POST` | `/products` | Criar produto | 🔒 seller |
| 6 | `GET` | `/products/store/{storeId}` | Produtos da loja | 🔓 |
| 7 | `PUT` | `/products/{id}` | Atualizar produto | 🔒 seller |
| 8 | `PATCH` | `/products/{id}/toggle-active` | Ativar/desativar | 🔒 seller |
| 9 | `DELETE` | `/products/{id}` | Eliminar produto | 🔒 seller |
| 10 | `POST` | `/advertisements` | Criar anúncio | 🔒 seller |
| 11 | `GET` | `/advertisements/my/{storeId}` | Meus anúncios | 🔒 seller |
| 12 | `GET` | `/chat/rooms` | Minhas salas | 🔒 |
| 13 | `GET` | `/chat/rooms/{id}/messages` | Mensagens | 🔒 |
| 14 | `POST` | `/chat/rooms/{id}/messages` | Responder | 🔒 |
| 15 | `POST` | `/chat/rooms/{id}/read` | Marcar lidas | 🔒 |
| 16 | `GET` | `/subscriptions/my/{storeId}` | Meus pagamentos | 🔒 seller |
| 17 | `POST` | `/stores/{id}/upgrade-request` | Solicitar upgrade | 🔒 seller |
| 18 | `POST` | `/uploads/image` | Upload imagem | 🔒 |
| 19 | `POST` | `/uploads/document` | Upload documento | 🔒 |
| 20 | `POST` | `/uploads/presigned-url` | Presigned URL | 🔒 |
| 21 | `POST` | `/uploads/confirm` | Confirmar upload | 🔒 |

---

> **Fluxo típico do Vendedor:**
> 1. Registar como seller → `POST /auth/register` (user_type: seller)
> 2. Criar loja → `POST /stores`
> 3. Upload logo → `POST /uploads/image`
> 4. Atualizar loja com logo → `PUT /stores/{id}`
> 5. Adicionar produtos → `POST /products`
> 6. Criar anúncio → `POST /advertisements`
> 7. Responder clientes → `POST /chat/rooms/{id}/messages`
> 8. Solicitar upgrade → `POST /stores/{id}/upgrade-request`
