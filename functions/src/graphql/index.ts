import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as express from 'express';
import * as functions from 'firebase-functions';
import { AppModule } from './app/app.module';
import { once } from 'lodash';

const server = express();

const initialize = once(async (instance: express.Express) => {
  try {
    const app = await NestFactory.create(AppModule, new ExpressAdapter(instance));
    await app.init();
    console.log('GraphQL initialized.');
  }
  catch (e) {
    console.error('Failed to initialize GraphQL.', e);
  }
});

export const graphql = functions.https.onRequest(async (req, resp) => {
  await initialize(server);
  server(req, resp);
});