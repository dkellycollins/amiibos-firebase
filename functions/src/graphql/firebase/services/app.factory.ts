import * as admin from 'firebase-admin';
import { FactoryProvider } from '@nestjs/common';

type App = admin.app.App;

export const AppFactory: FactoryProvider<App> = {
  provide: 'FIREBASE_APP',
  useFactory: () => admin.initializeApp()
}