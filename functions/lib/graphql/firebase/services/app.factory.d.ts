import * as admin from 'firebase-admin';
import { FactoryProvider } from '@nestjs/common';
declare type App = admin.app.App;
export declare const AppFactory: FactoryProvider<App>;
export {};
