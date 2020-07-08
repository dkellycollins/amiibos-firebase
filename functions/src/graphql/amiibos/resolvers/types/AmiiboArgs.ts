import { ArgsType, Field } from "@nestjs/graphql";

@ArgsType()
export class AmiiboArgs {
  @Field({ nullable: false })
  public slug!: string;
}