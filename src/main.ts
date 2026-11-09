import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';

const logger = new Logger('Bootstrap');
const isProduction = process.env.NODE_ENV === 'production';

/** Falha cedo em produção se faltar configuração crítica. */
function validateProductionEnv() {
  if (!isProduction) return;

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error(
      'JWT_SECRET em falta ou demasiado curto (mínimo 32 caracteres) — abortar arranque em produção.',
    );
  }
  if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
    throw new Error(
      'DATABASE_URL (ou DB_HOST) não configurado — abortar arranque em produção.',
    );
  }
}

async function bootstrap() {
  validateProductionEnv();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Em produção não expor logs de debug
    logger: isProduction
      ? ['error', 'warn', 'log']
      : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Performance: compressão gzip/brotli das respostas JSON
  app.use(compression());

  // Security: Helmet - proteção contra ataques comuns
  app.use(helmet());

  // Security: CORS restritivo. Aceita lista separada por vírgulas.
  // Origens sem Origin (apps móveis, curl, health checks) são permitidas.
  const allowedOrigins = (
    process.env.CORS_ORIGINS ||
    process.env.APP_URL ||
    'http://localhost:3000'
  )
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const normalized = origin.replace(/\/$/, '');
      if (
        allowedOrigins.includes('*') ||
        allowedOrigins.includes(normalized)
      ) {
        return callback(null, true);
      }
      return callback(new Error('Origem não permitida pelo CORS'));
    },
    methods: ['GET', 'PUT', 'PATCH', 'DELETE', 'POST', 'HEAD', 'OPTIONS'],
    credentials: true,
    maxAge: 86400,
  });

  // Security: Global validation pipe - previne mass assignment
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,            // Remove propriedades não declaradas no DTO
      forbidNonWhitelisted: true, // Lança erro se propriedades extras existirem
      transform: true,            // Transforma payloads para tipos corretos
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Security: Exception filter global - esconde detalhes internos
  app.useGlobalFilters(new HttpExceptionFilter());

  // Security: Trust proxy (para rate limiting correto atrás de proxy)
  // Em produção (Render, Heroku, etc.) o app corre atrás de 1 reverse proxy.
  // Sem isto, request.ip = IP interno do Render para TODOS os clientes => throttler
  // bloqueia o servidor inteiro após poucas requisições (HTTP 429 global).
  app.set('trust proxy', 1);

  // Limites de payload (upload de ficheiros usa rotas/multer próprias)
  app.useBodyParser('json', { limit: process.env.BODY_LIMIT || '2mb' });
  app.useBodyParser('urlencoded', {
    limit: process.env.BODY_LIMIT || '2mb',
    extended: true,
  });

  // Swagger: desativado em produção salvo pedido explícito
  if (!isProduction || process.env.ENABLE_SWAGGER === 'true') {
    const config = new DocumentBuilder()
      .setTitle('Kitanda API')
      .setDescription('API do Kitanda - Marketplace')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Encerramento gracioso (Render envia SIGTERM em cada deploy)
  app.enableShutdownHooks();

  // Render injeta PORT; mantém APP_PORT para desenvolvimento local
  const port = Number(process.env.PORT || process.env.APP_PORT || 3000);
  await app.listen(port, '0.0.0.0');

  // O proxy do Render fecha ligações idle aos 60s; manter keep-alive abaixo disso
  // evita 502 intermitentes em clientes móveis.
  const server = app.getHttpServer();
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  logger.log(`🚀 Kitanda API running on port ${port} (${process.env.NODE_ENV || 'development'})`);
  if (!isProduction || process.env.ENABLE_SWAGGER === 'true') {
    logger.log(`📚 Swagger docs em /api/docs`);
  }
}

bootstrap().catch((error) => {
  logger.error('Falha ao arrancar a API', error instanceof Error ? error.stack : error);
  process.exit(1);
});
