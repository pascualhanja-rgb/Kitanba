# Kitanda Backend API

Backend completo para o marketplace **Kitanda** construído com **NestJS** e **TypeScript**.

## 🛡️ Proteções de Segurança Implementadas

### 1. **Proteção contra SQL Injection**
- TypeORM com query parameters parametrizados
- Nunca usa concatenação de strings em queries
- Validação de inputs nos DTOs

### 2. **Proteção contra DDoS**
- Rate Limiting global via `@nestjs/throttler`
- Configurável via variáveis de ambiente (`THROTTLE_TTL`, `THROTTLE_LIMIT`)
- Helmet para headers de segurança

### 3. **Proteção contra Ataques de Força Bruta**
- Rate limiting por IP
- Mensagens genéricas de erro (não revela se email existe)
- OTPs com expiração de 15 minutos

### 4. **Proteção contra Mass Assignment**
- `whitelist: true` no ValidationPipe
- `forbidNonWhitelisted: true` - rejeita propriedades extras
- Campos não editáveis são excluídos dos DTOs

### 5. **Proteção contra Vazamento de Dados por Exposição de Erros**
- `HttpExceptionFilter` global
- Stack traces nunca são expostos ao cliente
- Mensagens de erro genéricas para erros 500
- Logs detalhados apenas no servidor

### 6. **Outras Proteções**
- **Helmet**: Headers de segurança HTTP
- **CORS**: Configuração restritiva
- **JWT**: Autenticação segura com tokens
- **Bcrypt**: Hash de senhas com 12 rounds
- **Guards**: Controle de acesso por roles (admin, seller, customer)
- **ValidationPipe**: Validação rigorosa de todos os inputs

## 📦 Estrutura do Projeto

```
kitanda-backend/
├── src/
│   ├── main.ts                    # Bootstrap da aplicação
│   ├── app.module.ts              # Módulo principal
│   ├── common/                    # Utilitários compartilhados
│   │   ├── decorators/            # Decorators customizados
│   │   ├── filters/               # Filtros de exceção
│   │   └── guards/                # Guards de segurança
│   ├── auth/                      # Módulo de autenticação
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── dto/                   # Data Transfer Objects
│   │   ├── guards/                # JWT Guard, Roles Guard
│   │   └── strategies/            # Passport strategies
│   ├── users/                     # Módulo de utilizadores
│   │   ├── entities/              # Entidades TypeORM
│   │   ├── dto/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   └── users.service.ts
│   ├── stores/                    # Módulo de lojas
│   ├── products/                  # Módulo de produtos
│   ├── categories/                # Módulo de categorias
│   ├── plans/                     # Módulo de planos
│   ├── advertisements/            # Módulo de publicidade
│   ├── subscriptions/             # Módulo de pagamentos
│   ├── otps/                      # Módulo de OTPs
│   └── email/                     # Módulo de email (Brevo)
├── .env                           # Variáveis de ambiente
├── .env.example                   # Exemplo de variáveis
├── tsconfig.json                  # Configuração TypeScript
├── nest-cli.json                  # Configuração NestJS
└── package.json
```

## 🚀 Instalação

### Pré-requisitos
- Node.js >= 18
- PostgreSQL >= 14
- npm ou yarn

### Passos

1. **Clonar o repositório**
```bash
git clone <repository-url>
cd kitanda-backend
```

2. **Instalar dependências**
```bash
npm install
```

3. **Configurar variáveis de ambiente**
```bash
cp .env.example .env
# Editar .env com as suas credenciais
```

4. **Criar banco de dados**
```bash
# No PostgreSQL, criar o banco 'kitanda'
createdb kitanda
```

5. **Executar as migrations (ou usar synchronize)**
```bash
# Para desenvolvimento, o TypeORM pode criar as tabelas automaticamente
# Em produção, usar migrations
```

6. **Iniciar o servidor**
```bash
# Desenvolvimento
npm run start:dev

# Produção
npm run build
npm run start:prod
```

7. **Acessar a documentação**
```
http://localhost:3000/api/docs
```

## 📡 Endpoints da API

### Autenticação
- `POST /auth/register` - Registar novo utilizador
- `POST /auth/login` - Login
- `GET /auth/profile` - Obter perfil (autenticado)

### Utilizadores
- `GET /users` - Listar todos (Admin)
- `GET /users/:id` - Obter por ID
- `PUT /users/:id` - Atualizar perfil
- `DELETE /users/:id` - Eliminar (Admin)
- `HEAD /users/:id` - Verificar existência

### OTPs
- `POST /otps/send-activation/:userId` - Enviar OTP de ativação
- `POST /otps/verify-activation/:userId` - Verificar OTP
- `POST /otps/request-password-reset` - Solicitar reset de senha
- `POST /otps/verify-password-reset` - Verificar reset de senha

### Planos
- `GET /plans` - Listar planos disponíveis
- `GET /plans/:id` - Obter plano
- `POST /plans` - Criar plano (Admin)
- `PUT /plans/:id` - Atualizar plano (Admin)
- `DELETE /plans/:id` - Desativar plano (Admin)

### Lojas
- `GET /stores/public/:slug` - Loja pública
- `POST /stores` - Criar loja (Vendedor)
- `GET /stores/my` - Minhas lojas (Vendedor)
- `GET /stores/:id` - Obter loja
- `PUT /stores/:id` - Atualizar loja
- `DELETE /stores/:id` - Eliminar (Admin)
- `HEAD /stores/:id` - Verificar existência
- `GET /stores/admin/all` - Listar todas (Admin)
- `POST /stores/:id/approve` - Aprovar (Admin)
- `POST /stores/:id/reject` - Rejeitar (Admin)
- `POST /stores/:id/suspend` - Suspender (Admin)
- `POST /stores/:id/upgrade-request` - Solicitar upgrade
- `GET /stores/admin/upgrade-requests` - Solicitações pendentes
- `POST /stores/admin/upgrade-requests/:id` - Responder upgrade

### Produtos
- `GET /products` - Listar produtos (público)
- `GET /products/store/:storeId` - Produtos da loja
- `GET /products/:id` - Obter produto
- `POST /products` - Criar produto (Vendedor)
- `PUT /products/:id` - Atualizar produto
- `DELETE /products/:id` - Eliminar produto
- `HEAD /products/:id` - Verificar existência
- `PATCH /products/:id/toggle-active` - Ativar/desativar

### Categorias
- `GET /categories` - Listar categorias (árvore)
- `GET /categories/flat` - Listar categorias (flat)
- `GET /categories/:id` - Obter categoria
- `POST /categories` - Criar (Admin)
- `PUT /categories/:id` - Atualizar (Admin)
- `DELETE /categories/:id` - Eliminar (Admin)
- `GET /categories/:id/attributes` - Atributos
- `POST /categories/:id/attributes` - Criar atributo
- `DELETE /categories/attributes/:id` - Eliminar atributo

### Publicidade
- `GET /advertisements/active` - Anúncios ativos (público)
- `GET /advertisements/plans` - Planos disponíveis
- `POST /advertisements` - Criar anúncio (Vendedor)
- `GET /advertisements/my/:storeId` - Meus anúncios
- `GET /advertisements/admin/all` - Todos (Admin)
- `POST /advertisements/:id/approve` - Aprovar (Admin)
- `POST /advertisements/:id/reject` - Rejeitar (Admin)
- `DELETE /advertisements/:id` - Eliminar (Admin)

### Pagamentos
- `GET /subscriptions/my/:storeId` - Meus pagamentos
- `GET /subscriptions/admin/all` - Todos (Admin)
- `POST /subscriptions/admin/:id/approve` - Aprovar pagamento
- `POST /subscriptions/admin/:id/reject` - Rejeitar pagamento

## 🔧 Configuração

### Variáveis de Ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `DB_HOST` | Host do PostgreSQL | localhost |
| `DB_PORT` | Porta do PostgreSQL | 5432 |
| `DB_USERNAME` | Usuário do PostgreSQL | postgres |
| `DB_PASSWORD` | Senha do PostgreSQL | - |
| `DB_DATABASE` | Nome do banco | kitanda |
| `JWT_SECRET` | Segredo JWT | - |
| `JWT_EXPIRES_IN` | Tempo de expiração JWT | 7d |
| `BREVO_API_KEY` | Chave API Brevo | - |
| `BREVO_FROM` | Email remetente | - |
| `APP_NAME` | Nome da aplicação | Kitanda |
| `APP_PORT` | Porta do servidor | 3000 |
| `APP_URL` | URL da aplicação | http://localhost:3000 |
| `THROTTLE_TTL` | Tempo de rate limit (segundos) | 60 |
| `THROTTLE_LIMIT` | Limite de requisições | 10 |

## 📝 Notas Importantes

1. **Produção**: Desativar `synchronize` e usar migrations
2. **Secrets**: Nunca committar o arquivo `.env`
3. **HTTPS**: Usar proxy reverso (nginx) com HTTPS em produção
4. **Logs**: Configurar logs estruturados para monitoramento
5. **Backup**: Configurar backups regulares do banco de dados

## 📄 Licença

MIT
