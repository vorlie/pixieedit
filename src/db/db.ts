import Dexie, { type Table } from 'dexie';

export type AdjustmentKey = 'brightness' | 'contrast' | 'saturation' | 'warmth' | 'sharpness';

export interface CropState {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageEditState {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  sharpness: number;
  crop?: CropState;
}

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
  }
}

export const db = new PixieDatabase();
