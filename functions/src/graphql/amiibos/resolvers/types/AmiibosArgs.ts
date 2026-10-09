import { ArgsType, Field } from "@nestjs/graphql";

@ArgsType()
export class AmiibosArgs {
  @Field({ nullable: true })
  public series?: string;

  /**
   * Only return Amiibos of this kind, either "figure" or "card".
   */
  @Field({ nullable: true })
  public type?: string;
}