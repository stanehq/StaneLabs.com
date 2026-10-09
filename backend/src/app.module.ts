import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { ContactService } from './contact.service';
import { validateEnvironment } from './config';
import { resolve } from 'node:path';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment, envFilePath: resolve(__dirname, '../.env') }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
  ],
  controllers: [AppController],
  providers: [ContactService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
