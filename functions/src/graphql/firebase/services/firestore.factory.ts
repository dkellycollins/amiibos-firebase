import * as admin from 'firebase-admin';
import { FactoryProvider } from '@nestjs/common';
import { AppFactory } from './app.factory';

type App = admin.app.App;
type Firestore = admin.firestore.Firestore;

export const FirestoreFactory: FactoryProvider<Firestore> = {
  provide: 'FIREBASE_FIRESTORE',
  inject: [AppFactory.provide],
  useFactory: (app: App) => app.firestore()
};