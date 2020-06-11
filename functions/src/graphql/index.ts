import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as express from 'express';
import * as functions from 'firebase-functions';
import { AppModule } from './app/app.module';

async function initialize(instance: express.Express): Promise<void> {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(instance));
  await app.init();
}

const server = express();
initialize(server)
  .then(() => console.log('GraphQL initialized.'))
  .catch((e) => console.error('Failed to initialize GraphQL.', e));

export const graphql = functions.https.onRequest(server);