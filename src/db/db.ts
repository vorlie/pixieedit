import Dexie, { type Table } from 'dexie';
import { normalizeEdits, type ImageEditState } from '../editor/editModel';
export type { AdjustmentKey, CropState, EditStateVersion, FilterId, ImageEditState, Rotation } from '../editor/editModel';

export interface PixieImage {
  id?: number;
  originalBlob: Blob;
  thumbnailBlob: Blob;
  edits: ImageEditState;
  timestamp: number;
}

export class PixieDatabase extends Dexie {
  images!: Table<PixieImage>;

  constructor() {
    super('PixieEditDB');
    this.version(1).stores({
      images: '++id, timestamp' // Indexed fields
    });
    this.version(2).stores({
      images: '++id, timestamp'
    }).upgrade(async (transaction) => {
      await transaction.table<PixieImage>('images').toCollection().modify((image) => {
        image.edits = normalizeEdits(image.edits);
      });
    });
    this.version(3).stores({
      images: '++id, timestamp'
    }).upgrade(async (transaction) => {
      await transaction.table<PixieImage>('images').toCollection().modify((image) => {
        image.edits = normalizeEdits(image.edits);
      });
    });
  }
}

export const db = new PixieDatabase();
