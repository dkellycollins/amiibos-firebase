import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { ObjectMetadata } from 'firebase-functions/lib/providers/storage';

type App = admin.app.App;

const expectedFileName = 'lineup.model.json';

export const loadAmiibosOnFinalize = functions.storage.object()
  .onFinalize(async (object: any) => {
    if (!canProcess(object)) return;

    const app = admin.initializeApp();
    const amiibosData = await extractAmiiboData(app, object);
    const amiibos = processAmiiboData(amiibosData);
    await loadAmiibos(app, amiibos);
  });

function canProcess(object: ObjectMetadata): boolean {
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
  return amiiboList
    .filter((amiibo: any) => amiibo.type === 'Figure' || amiibo.type === 'Plush')
    .map((amiibo: any) => ({
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
  const amiibosCollection = app
    .firestore()
    .collection('amiibos');
  await Promise.all(amiibos.map(async amiibo => {
    console.log(`Adding Amiibo "${amiibo.slug}...`);
    try {
      await amiibosCollection
        .doc(amiibo.slug)
        .set(amiibo);
      console.log(`Added Amiibo "${amiibo.slug}".`);
    }
    catch (error) {
      console.log(`Failed to load Amiibo "${amiibo.id}."`);
      throw error;
    }
  }));
}