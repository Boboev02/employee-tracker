import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './audit/global-exception.filter';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const prismaService = app.get(PrismaService);
  app.useGlobalFilters(new GlobalExceptionFilter(prismaService));

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,        // strip unknown fields
    forbidNonWhitelisted: false, // don't throw on extra fields (backward compat)
    transform: true,        // auto-transform types
    skipMissingProperties: true,
  }));

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://employee-tracker.ru',
      'https://www.employee-tracker.ru',
      'https://seller.wildberries.ru',
      'https://cmp.wildberries.ru',
      'https://seller-portal.wildberries.ru',
      'https://seller-express.wildberries.ru',
      'https://supplier.wildberries.ru',
      'https://seller.ozon.ru',
      'https://seller-portal.ozon.ru',
      ...(process.env.ALLOWED_ORIGINS?.split(',') ?? []),
    ],
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3001);
  console.log('API running on http://localhost:3001');
}
bootstrap();
