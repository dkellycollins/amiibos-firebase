import { ArgsType, Field } from "@nestjs/graphql";

@ArgsType()
export class AmiibosArgs {
  @Field({ nullable: true })
  public series?: string;
}