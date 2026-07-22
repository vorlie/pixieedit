import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { PixieDatabase } from './db';

describe('PixieEditDB migration', () => {
  afterEach(async () => {
    await Dexie.delete('PixieEditDB');
  });

  it('upgrades legacy records in place and preserves blobs and adjustments', async () => {
    const legacy = new Dexie('PixieEditDB');
    legacy.version(1).stores({ images: '++id, timestamp' });
    await legacy.open();
    // fake-indexeddb does not clone jsdom Blobs faithfully, so binary payloads
    // stand in for the two blob fields while exercising the real migration.
    const originalBlob = new Uint8Array([1, 2, 3, 4]);
    const id = await legacy.table('images').add({
      originalBlob,
      thumbnailBlob: new Uint8Array([5, 6]),
      edits: { brightness: 123, contrast: 90, saturation: 100, warmth: 17, sharpness: 0 },
      timestamp: 1,
    });
    legacy.close();

    const upgraded = new PixieDatabase();
    await upgraded.open();
    const image = await upgraded.images.get(id);

    try {
      expect(image?.originalBlob).toMatchObject({ 0: 1, 1: 2, 2: 3, 3: 4 });
      expect(image?.edits).toMatchObject({ version: 3, brightness: 123, contrast: 90, temperature: 17, exposure: 0, rotation: 0, filter: 'none', markup: [] });
    } finally {
      upgraded.close();
    }
  });
});
