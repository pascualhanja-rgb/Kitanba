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
