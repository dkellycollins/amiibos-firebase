import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { ObjectMetadata } from 'firebase-functions/lib/providers/storage';

type App = admin.app.App;

const expectedFileName = 'lineup.model.json';

export const loadAmiibosOnFinalize = functions.storage.object()
  .onFinalize(async (object: any) => {
    if (!canProcessObject(object)) return;

    const app = admin.initializeApp();
    const amiibosData = await extractAmiiboData(app, object);
    const amiibos = processAmiiboData(amiibosData);
    await loadAmiibos(app, amiibos);
  });

function canProcessObject(object: ObjectMetadata): boolean {
  if (!object.name) {
    console.warn(`Undefined name for object.`);
    return false;
  }
  if (!object.name.endsWith(expectedFileName)) {
    console.log(`Object ${object.name} is not expected to contain Amiibo data.`);
    return false;
  };

  return true;
}

async function extractAmiiboData(app: App, object: ObjectMetadata): Promise<any> {
  if (!object.name) {
    throw new Error(`Undefined name for object.`);
  }

  const fileBuffer = await app
    .storage()
    .bucket(object.bucket)
    .file(object.name)
    .download();
  return JSON.parse(fileBuffer.toString());
}

function processAmiiboData(amiibosData: any): Array<any> {
  const { amiiboList } = amiibosData;

  const canProcessAmiiboData = (amiibo: any) => amiibo.type === 'Figure' || amiibo.type === 'Plush';

  const skippedAmiibos = amiiboList
    .filter((amiibo: any) => !canProcessAmiiboData(amiibo))
    .map((amiibo: any) => amiibo.slug);
  console.log(`Skipping ${skippedAmiibos.length} amiibos; ${JSON.stringify(skippedAmiibos)}`);

  return amiiboList
    .filter(canProcessAmiiboData)
    .map((amiibo: any) => ({
      type: 'figure',
      slug: amiibo.slug,
      name: amiibo.amiiboName
        .replace('&#8482;', '')
        .replace('&#174;', ''),
      description: amiibo.overviewDescription,
      series: amiibo.series,
      figureUrl: `https://www.nintendo.com/${amiibo.figureURL}`,
      releaseDate: amiibo.releaseDateMask
    }))
    .sort((a: any, b: any) => a.name.localeCompare(b.name));
}

async function loadAmiibos(app: App, amiibos: Array<any>): Promise<void> {
  console.log(`Loading ${amiibos.length} amiibos...`);

  const amiibosCollection = app
    .firestore()
    .collection('amiibos');
  const results = await Promise.all(amiibos.map(async amiibo => {
    try {
      await amiibosCollection
        .doc(amiibo.slug)
        .set(amiibo);
      return true;
    }
    catch (error) {
      console.log(`Failed to load Amiibo "${amiibo.id}."`);
      return false;
    }
  }));

  console.log(`Successfully loaded ${results.filter(result => result).length} out of ${amiibos.length} amiibos.`);
}