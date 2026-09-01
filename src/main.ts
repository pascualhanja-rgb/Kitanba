import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security: Helmet - proteção contra ataques comuns
  app.use(helmet());

  // Security: CORS configurado restritivamente
  app.enableCors({
    origin: process.env.APP_URL || 'http://localhost:3000',
    methods: ['GET', 'PUT', 'PATCH', 'DELETE', 'POST', 'HEAD', 'OPTIONS'],
    credentials: true,
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
  // Nota: Em produção, configurar conforme o proxy utilizado

  // Swagger (API Documentation)
  const config = new DocumentBuilder()
    .setTitle('Kitanda API')
    .setDescription('API do Kitanda - Marketplace')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.APP_PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Kitanda API running on port ${port}`);
  console.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
}
bootstrap();
