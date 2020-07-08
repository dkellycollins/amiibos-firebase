import { AmiibosService } from "../services/amiibos.service";
import { AmiibosArgs } from "./types/AmiibosArgs";
import { AmiiboArgs } from "./types/AmiiboArgs";
import { AmiiboObject } from "./types/AmiiboObject";
export declare class AmiiboResolver {
    private readonly amiibosService;
    constructor(amiibosService: AmiibosService);
    amiibos(args: AmiibosArgs): Promise<Array<AmiiboObject>>;
    amiibo(args: AmiiboArgs): Promise<AmiiboObject>;
    amiiboSeries(): Promise<Array<String>>;
}
