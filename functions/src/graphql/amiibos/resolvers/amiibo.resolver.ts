import { Resolver, Query, Args } from "@nestjs/graphql";
import { AmiibosService } from "../services/amiibos.service";
import { AmiibosArgs } from "./types/AmiibosArgs";
import { AmiiboArgs } from "./types/AmiiboArgs";
import { AmiiboObject } from "./types/AmiiboObject";

@Resolver(() => AmiiboObject)
export class AmiiboResolver {
  constructor(
    private readonly amiibosService: AmiibosService
  ) { }

  @Query(() => [AmiiboObject])
  public async amiibos(@Args() args: AmiibosArgs): Promise<Array<AmiiboObject>> {
    return await this.amiibosService.list({
      series: args.series
    });
  }

  @Query(() => AmiiboObject)
  public async amiibo(@Args() args: AmiiboArgs): Promise<AmiiboObject> {
    return await this.amiibosService.get(args.slug);
  }

  @Query(() => [String])
  public async amiiboSeries(): Promise<Array<String>> {
    return await this.amiibosService.getSeries();
  }
}