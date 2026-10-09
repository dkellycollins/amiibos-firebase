import * as admin from 'firebase-admin';
import { FactoryProvider } from '@nestjs/common';
type Firestore = admin.firestore.Firestore;
export declare const FirestoreFactory: FactoryProvider<Firestore>;
export {};
