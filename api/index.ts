import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';

let app: any;

async function createApp() {
  if (!app) {
    app = await NestFactory.create(AppModule);

    app.enableCors({
      origin: '*',
    });

    await app.init();
  }

  return app;
}

export default async function handler(req: any, res: any) {
  const app = await createApp();
  const instance = app.getHttpAdapter().getInstance();

  return instance(req, res);
}
