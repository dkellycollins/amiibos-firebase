import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as express from 'express';
import * as functions from 'firebase-functions';
import { AppModule } from './app/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { once } from 'lodash';

const server = express();
const initialize = once(async (instance: express.Express) => {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(instance));

  const options = new DocumentBuilder()
    .setTitle('Amiibos API')
    .setVersion('1')
    .build();
  const document = SwaggerModule.createDocument(app, options);

  app.use('/swagger.json', (req: express.Request, res: express.Response) => res.status(200).json(document));
  SwaggerModule.setup('', app, document);

  await app.init();
});

initialize(server)
  .then(() => console.log('Api initialized.'))
  .catch((e) => console.error('Failed to initialize api.', e));

export const api = functions.https.onRequest(server);