import { ObjectType, Field, ID } from "@nestjs/graphql";

@ObjectType()
export class AmiiboObject {
  /**
   * Unique identifier of the Amiibo.
   */
  @Field(type => ID)
  public slug: string;

  /**
   * Display name for the Amiibo figure.
   */
  @Field()
  public name: string;

  /**
   * Additional information about the Amiibo figure.
   */
  @Field()
  public description: string;

  /**
   * The name of the series the Amiibo belongs too.
   */
  @Field()
  public series: string;
  
  /**
   * The full url to the image for the Amiibo figure.
   */
  @Field()
  public figureUrl: string;

  /**
   * The date when the Amiibo figure was released.
   */
  @Field()
  public releaseDate: string;

  constructor(slug: string, name: string, description: string, series: string, figureUrl: string, releaseDate: string) {
    this.slug = slug;
    this.name = name;
    this.description = description;
    this.series = series;
    this.figureUrl = figureUrl;
    this.releaseDate = releaseDate;
  }
}