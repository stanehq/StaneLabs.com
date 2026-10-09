import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { json, static as serveStatic } from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { SafeExceptionFilter } from './safe-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false, logger: ['error', 'warn', 'log'] });
  const config = app.get(ConfigService);
  app.disable('x-powered-by');
  const proxy = config.get<string>('TRUST_PROXY');
  if (proxy) app.set('trust proxy', proxy.split(',').map(value => value.trim()).filter(Boolean));
  app.use(helmet({ contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    imgSrc: ["'self'", 'data:'],
    connectSrc: ["'self'"],
    objectSrc: ["'none'"],
    frameAncestors: ["'none'"],
    upgradeInsecureRequests: config.get<string>('NODE_ENV') === 'production' ? [] : null,
  } } }));
  app.use(json({ limit: '16kb', strict: true }));
  app.setGlobalPrefix('api');
  app.enableCors({ origin: config.get<string>('FRONTEND_ORIGIN'), methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type'], credentials: false, maxAge: 600 });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true, transform: true, validationError: { target: false, value: false } }));
  app.useGlobalFilters(new SafeExceptionFilter());
  const webRoot = resolve(config.get<string>('WEB_ROOT') || resolve(__dirname, '../public'));
  if (existsSync(webRoot)) app.use(serveStatic(webRoot, { index: 'index.html', dotfiles: 'allow', redirect: true, fallthrough: true }));
  app.enableShutdownHooks();
  await app.listen(config.get<number>('PORT') || 3001, config.get<string>('HOST') || '0.0.0.0');
}

bootstrap().catch(() => { console.error('El backend no pudo iniciar. Revisa la configuración del entorno.'); process.exit(1); });
