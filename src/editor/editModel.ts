export type EditStateVersion = 3;
export type Rotation = 0 | 90 | 180 | 270;
export type AdjustmentKey = 'brightness' | 'contrast' | 'saturation' | 'exposure' | 'highlights' | 'shadows' | 'temperature' | 'tint' | 'vibrance' | 'sharpness' | 'vignette';
export type FilterId = 'none' | 'vivid' | 'warm' | 'cool' | 'mono' | 'vintage';
export type MarkupTool = 'circle' | 'rectangle' | 'line' | 'text';

export interface MarkupDrawing {
  type: 'draw';
  tool: MarkupTool;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  color: string;
  strokeWidth: number;
  text?: string;
}

export interface CropState {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageEditState {
  version: EditStateVersion;
  brightness: number;
  contrast: number;
  saturation: number;
  exposure: number;
  highlights: number;
  shadows: number;
  temperature: number;
  tint: number;
  vibrance: number;
  sharpness: number;
  vignette: number;
  rotation: Rotation;
  flipH: boolean;
  flipV: boolean;
  filter: FilterId;
  markup: MarkupDrawing[];
  crop?: CropState;
}

export const DEFAULT_IMAGE_EDITS: Readonly<ImageEditState> = Object.freeze({
  version: 3,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  exposure: 0,
  highlights: 0,
  shadows: 0,
  temperature: 0,
  tint: 0,
  vibrance: 0,
  sharpness: 0,
  vignette: 0,
  rotation: 0,
  flipH: false,
  flipV: false,
  filter: 'none',
  markup: [],
});

const FILTER_IDS: FilterId[] = ['none', 'vivid', 'warm', 'cool', 'mono', 'vintage'];
const ROTATIONS: Rotation[] = [0, 90, 180, 270];

export function createDefaultEdits(): ImageEditState {
  return { ...DEFAULT_IMAGE_EDITS };
}

export function normalizeEdits(value?: (Partial<ImageEditState> & { warmth?: number }) | null): ImageEditState {
  const rotation = ROTATIONS.includes(value?.rotation as Rotation) ? value?.rotation as Rotation : 0;
  const filter = FILTER_IDS.includes(value?.filter as FilterId) ? value?.filter as FilterId : 'none';
  return {
    ...DEFAULT_IMAGE_EDITS,
    ...value,
    version: 3,
    rotation,
    filter,
    flipH: value?.flipH === true,
    flipV: value?.flipV === true,
    temperature: typeof value?.temperature === 'number' ? value.temperature : (value?.warmth ?? 0),
    crop: value?.crop ? { ...value.crop } : undefined,
    markup: Array.isArray(value?.markup) ? value.markup.map((drawing) => ({ ...drawing })) : [],
  };
}
