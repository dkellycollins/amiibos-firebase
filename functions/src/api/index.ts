import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as express from 'express';
import * as functions from 'firebase-functions';
import { AppModule } from './app/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { once } from 'lodash';

const initialize = once(async () => {
  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));

  const options = new DocumentBuilder()
    .setTitle('Amiibos API')
    .setVersion('1')
    .build();
  const document = SwaggerModule.createDocument(app, options);

  app.use('/swagger.json', (req: express.Request, res: express.Response) => res.status(200).json(document));
  SwaggerModule.setup('', app, document);

  await app.init();
  console.log('Api initialized.');

  return server;
});

export const api = functions.https.onRequest((req, resp) => {
  initialize()
    .then((server) => {
      server(req, resp);
    })
    .catch((e) => {
      console.error(e);
      resp.status(500).send();
    });
});