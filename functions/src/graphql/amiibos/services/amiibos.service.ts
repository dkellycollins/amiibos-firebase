import { Injectable, Inject } from "@nestjs/common";
import { AmiiboModel } from "../models/amiibo.model";
import * as admin from 'firebase-admin';
import { FirestoreFactory } from "../../firebase/services/firestore.factory";

type Firestore = admin.firestore.Firestore;

@Injectable()
export class AmiibosService {

  constructor(
    @Inject(FirestoreFactory.provide) private readonly firestore: Firestore
  ) { }

  public async list(args: ListAmiibosArgs): Promise<Array<AmiiboModel>> {
    const snapshotPromise = !!args.series
      ? this.getAmiibosCollection().where('series', '==', args.series).get()
      : this.getAmiibosCollection().get();
    const snapshot = await snapshotPromise;

    return snapshot.docs.map(doc => {
      return {
        slug: doc.get('slug'),
        name: doc.get('name'),
        description: doc.get('description'),
        series: doc.get('series'),
        figureUrl: doc.get('figureUrl'),
        releaseDate: doc.get('releaseDate')
      };
    });
  }

  public async get(slug: string): Promise<AmiiboModel> {
    const doc = await this.getAmiibosCollection().doc(slug).get();
    return {
      slug: doc.get('slug'),
      name: doc.get('name'),
      description: doc.get('description'),
      series: doc.get('series'),
      figureUrl: doc.get('figureUrl'),
      releaseDate: doc.get('releaseDate')
    };
  }

  public async getSeries(): Promise<Array<string>> {
    const snapshot = await this.getAmiibosCollection()
      .select('series')
      .get();

    return snapshot.docs
      .map(doc => doc.get('series'))
      .filter(value => !!value)
      .filter((value, index, array) => array.indexOf(value) === index);
  }

  private getAmiibosCollection(): admin.firestore.CollectionReference {
    return this.firestore.collection('amiibos');
  }
}

export interface ListAmiibosArgs {
  series?: string;
}