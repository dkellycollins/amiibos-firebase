import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as express from 'express';
import * as functions from 'firebase-functions';
import { AppModule } from './app/app.module';
import { once } from 'lodash';

const initialize = once(async () => {
  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));
  await app.init();

  return server;
});

export const graphql = functions.https.onRequest((req, resp) => {
  initialize()
    .then(server => {
      server(req, resp);
    })
    .catch(e => {
      console.error(e);
      resp.status(500).send();
    });
});