import { Module } from "@nestjs/common";
import { AmiiboResolver } from "./resolvers/amiibo.resolver";
import { FirebaseModule } from "../firebase/firebase.module";
import { AmiibosService } from "./services/amiibos.service";

@Module({
  imports: [
    FirebaseModule
  ],
  providers: [
    AmiiboResolver,
    AmiibosService
  ]
})
export class AmiibosModule { }