import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { ObjectMetadata } from 'firebase-functions/lib/providers/storage';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as os from 'os';
import * as path from 'path';
import { Amiibo } from './Amiibo';
import { AmiiboListItem } from './AmiiboListItem';

type App = admin.app.App;
type Bucket = ReturnType<admin.storage.Storage['bucket']>

const expectedFileName = 'lineup.model.json';

export const loadAmiibosOnFinalize = functions.storage.object()
  .onFinalize(async (object: any) => {
    if (!canProcessObject(object)) return;

    const app = admin.initializeApp();
    const amiibosData = await extractAmiiboData(app, object);
    const amiibos = processAmiiboData(amiibosData);

    await saveImages(app, amiibos);
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

function canProcessAmiibo(amiiboData: any): amiiboData is AmiiboListItem {
  return  amiiboData.type === 'Figure' || amiiboData.type === 'Plush';
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

  const skippedAmiibos = amiiboList
    .filter((amiibo: any) => !canProcessAmiibo(amiibo))
    .map((amiibo: any) => amiibo.slug);
  console.log(`Skipping ${skippedAmiibos.length} amiibos; ${JSON.stringify(skippedAmiibos)}`);

  return amiiboList
    .filter(canProcessAmiibo)
    .map((amiibo: AmiiboListItem): Amiibo => ({
      type: 'figure',
      slug: amiibo.slug,
      name: amiibo.amiiboName
        .replace('&#8482;', '')
        .replace('&#174;', ''),
      description: amiibo.overviewDescription,
      series: amiibo.series,
      figureUrl: amiibo.figureURL,
      releaseDate: amiibo.releaseDateMask
    }))
    .sort((a: any, b: any) => a.name.localeCompare(b.name));
}

async function saveImages(app: App, amiibos: Array<Amiibo>): Promise<void> {
  console.log(`Processing images for ${amiibos.length} amiibos...`);

  const bucket = app.storage().bucket();
  const savedImages = [];

  for (const amiibo of amiibos) {
    try {
      const dest = `amiibos/${amiibo.slug}/figure`;
      const [exists] = await bucket.file(dest).exists(); 
      if (!exists) {
        await saveImage(bucket, amiibo.figureUrl, dest);
        savedImages.push(amiibo.figureUrl);
      }
    }
    catch (error) {
      console.error(`Failed to save image for amiibo ${amiibo.slug}.`);
      console.error(error);
    }
  }

  console.log(`Saved ${savedImages.length} images: [${savedImages.join(', ')}]`);
}

async function saveImage(bucket: Bucket, src: string, dest: string): Promise<string> {
  console.log(`Downloading image "${src}"`);
  const [tempFilePath, contentType] = await new Promise((resolve, reject) => {
    const client = src.startsWith('https') ? https : http;
    client
      .get(src, response => {
        const statusCode = response.statusCode || 0;
        if (statusCode < 200 || statusCode >= 300) {
          reject(new Error(`Request failed with status code ${statusCode}`));
          return;
        }

        const _contentType = response.headers['content-type'];
        const _tempFilePath = path.join(os.tmpdir(), dest);
        const tempFile = fs.createWriteStream(_tempFilePath, {
          autoClose: true
        });
        response
          .pipe(tempFile)
          .on('finish', () => resolve([_tempFilePath, _contentType]))
          .on('error', reject);
      })
      .on('error', reject);
  });

  console.log(`Uploading image "${tempFilePath}" to "${dest}"`);
  try {
    await bucket.upload(tempFilePath, { 
      destination: dest, 
      public: true, 
      contentType: contentType 
    });
  }
  finally {
    await new Promise(resolve => fs.unlink(tempFilePath, resolve));
  }
  return `${bucket.baseUrl}/${dest}`;
}

async function loadAmiibos(app: App, amiibos: Array<Amiibo>): Promise<void> {
  console.log(`Loading ${amiibos.length} amiibos...`);

  const bucket = app.storage().bucket();
  const amiibosCollection = app
    .firestore()
    .collection('amiibos');
  const results = await Promise.all(amiibos.map(async amiibo => {
    try {
      await amiibosCollection
        .doc(amiibo.slug)
        .set({
          ...amiibo,
          figureUrl: await bucket.file(`amiibos/${amiibo.slug}/figure`)
            .getSignedUrl({
              action: 'read',
              expires: '03-09-2491'
            })
        });
      return true;
    }
    catch (error) {
      console.log(`Failed to load Amiibo "${amiibo.slug}."`);
      return false;
    }
  }));

  console.log(`Successfully loaded ${results.filter(result => result).length} out of ${amiibos.length} amiibos.`);
}