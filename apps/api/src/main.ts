import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') }); // compiled: dist/ → root
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') }); // watch mode: apps/api → root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });       // fallback: local .env

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableCors({ origin: '*' });
  await app.listen(3001);
  console.log('API listening on :3001');
}

bootstrap();
