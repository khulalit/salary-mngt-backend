import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';

let cachedServer: any;

async function bootstrap() {
  if (cachedServer) {
    return cachedServer;
  }

  const server = express();

  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    bufferLogs: true,
  });

  app.enableCors({
    origin: '*',
    methods: 'GET,POST,PUT,PATCH,DELETE',
    allowedHeaders: 'Content-Type,Authorization',
    credentials: true,
  });

  app.setGlobalPrefix('api');

  await app.init();

  cachedServer = server;
  return server;
}

export default async function handler(req: any, res: any) {
  const server = await bootstrap();
  return server(req, res);
}
