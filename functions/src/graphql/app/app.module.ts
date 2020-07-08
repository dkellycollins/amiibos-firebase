import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { AmiibosModule } from '../amiibos/amiibos.module';

@Module({
  imports: [
    AmiibosModule,
    GraphQLModule.forRoot({
      autoSchemaFile: true,
      introspection: true,
      path: '/',
      playground: {
        endpoint: '/graphql'
      }
    })
  ],
})
export class AppModule {}