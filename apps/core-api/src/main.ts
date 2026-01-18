import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ConfigModule } from './config/config.module';

async function bootstrap() {
  // Validate configuration before starting the app (fail-fast)
  console.log('🔧 Validating configuration...');

  // This will exit the process if validation fails
  await import('./config/config.module');

  const app = await NestFactory.create(AppModule);

  // Enable global validation pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  // Enable CORS for web clients
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });

  // Setup OpenAPI/Swagger
  const config = new DocumentBuilder()
    .setTitle('NeuronX Core API')
    .setDescription('Sales intelligence and orchestration platform')
    .setVersion('1.0')
    .addTag('leads', 'Lead management endpoints')
    .addTag('workflows', 'Workflow orchestration endpoints')
    .addTag('analytics', 'Sales analytics endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Health check endpoint
  app.getHttpAdapter().get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 NeuronX Core API listening on port ${port}`);
  console.log(`📚 OpenAPI docs available at http://localhost:${port}/api/docs`);
}

bootstrap();
