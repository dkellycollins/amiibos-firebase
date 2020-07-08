import { Module } from "@nestjs/common";
import { AppFactory } from "./services/app.factory";
import { FirestoreFactory } from "./services/firestore.factory";

@Module({
  providers: [
    AppFactory,
    FirestoreFactory
  ],
  exports: [
    FirestoreFactory
  ]
})
export class FirebaseModule { }