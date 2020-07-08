import { AmiiboModel } from "../models/amiibo.model";
import * as admin from 'firebase-admin';
declare type Firestore = admin.firestore.Firestore;
export declare class AmiibosService {
    private readonly firestore;
    constructor(firestore: Firestore);
    list(args: ListAmiibosArgs): Promise<Array<AmiiboModel>>;
    get(slug: string): Promise<AmiiboModel>;
    getSeries(): Promise<Array<string>>;
    private getAmiibosCollection;
}
export interface ListAmiibosArgs {
    series?: string;
}
export {};
