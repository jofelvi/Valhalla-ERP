import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Permitir payloads hasta 30MB (PDFs en base64 para WhatsApp)
  app.use(json({ limit: '30mb' }));
  app.use(urlencoded({ limit: '30mb', extended: true }));

  // Servir archivos estaticos desde uploads/ (selfies de asistencia, etc.)
  const uploadsDir = path.resolve(
    process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads'),
  );
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.useStaticAssets(uploadsDir, { prefix: '/uploads/' });

  // CORS: los orígenes de la web y del móvil se listan en CORS_ORIGINS (separados por coma).
  // Si el proxy del despliegue ya pone las cabeceras, no se define y no se duplican.
  // ENABLE_CORS=1 abre CORS a cualquier origen: solo para pruebas locales.
  const origenesCors = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (origenesCors.length > 0) {
    app.enableCors({ origin: origenesCors, credentials: true });
  } else if (process.env.ENABLE_CORS === '1') {
    app.enableCors({ origin: true, credentials: true });
  }

  // Validation pipe global - valida DTOs automaticamente
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Swagger / OpenAPI
  const config = new DocumentBuilder()
    .setTitle('POS API')
    .setDescription('API del sistema POS - Backend NestJS + MongoDB')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Autenticacion y usuarios')
    .addTag('users', 'Gestion de usuarios')
    .addTag('categories', 'Categorias de productos')
    .addTag('products', 'Productos del menu')
    .addTag('tables', 'Mesas del restaurante')
    .addTag('customers', 'Clientes')
    .addTag('orders', 'Ordenes y POS')
    .addTag('payments', 'Pagos y verificaciones')
    .addTag('invoices', 'Facturacion')
    .addTag('employees', 'Empleados')
    .addTag('attendance', 'Control de asistencia')
    .addTag('payroll', 'Nomina')
    .addTag('accounts-receivable', 'Cuentas por cobrar')
    .addTag('comisiones', 'Comisiones')
    .addTag('suppliers', 'Proveedores')
    .addTag('purchase-orders', 'Ordenes de compra')
    .addTag('almacen', 'Inventario')
    .addTag('budgets', 'Presupuestos')
    .addTag('analytics', 'Reportes y analitica')
    .addTag('notifications', 'Email y WhatsApp')
    .addTag('exchange', 'Tasas de cambio')
    .addTag('print-queue', 'Cola de impresion')
    .addTag('public', 'Endpoints publicos (sin auth)')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`🚀 POS API running on http://localhost:${port}`);
  console.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
}
bootstrap();
