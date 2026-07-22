import type { CropState, FilterId, ImageEditState, MarkupDrawing, Rotation } from './editModel';

export type CropDragType = 'move' | 'corner-tl' | 'corner-tr' | 'corner-bl' | 'corner-br' | 'side-l' | 'side-r' | 'side-t' | 'side-b';

export interface FilterDefinition {
  id: FilterId;
  label: string;
  parameters: FilterParameters;
}

export interface FilterParameters {
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
  grayscale: number;
  sepia: number;
}

export interface RenderSpec {
  adjustments: Pick<ImageEditState, 'brightness' | 'contrast' | 'saturation' | 'exposure' | 'highlights' | 'shadows' | 'temperature' | 'tint' | 'vibrance' | 'sharpness' | 'vignette'>;
  filter: FilterId;
  crop?: CropState;
  rotation: Rotation;
  flipH: boolean;
  flipV: boolean;
  markup: MarkupDrawing[];
}

const NEUTRAL_FILTER: FilterParameters = { brightness: 1, contrast: 1, saturation: 1, exposure: 0, highlights: 0, shadows: 0, temperature: 0, tint: 0, vibrance: 0, sharpness: 0, vignette: 0, grayscale: 0, sepia: 0 };

export const FILTERS: readonly FilterDefinition[] = [
  { id: 'none', label: 'None', parameters: NEUTRAL_FILTER },
  { id: 'vivid', label: 'Vivid', parameters: { ...NEUTRAL_FILTER, contrast: 1.12, saturation: 1.3 } },
  { id: 'warm', label: 'Warm', parameters: { ...NEUTRAL_FILTER, saturation: 1.12, temperature: 0.12, sepia: 0.12 } },
  { id: 'cool', label: 'Cool', parameters: { ...NEUTRAL_FILTER, saturation: 1.08, temperature: -0.12 } },
  { id: 'mono', label: 'Mono', parameters: { ...NEUTRAL_FILTER, contrast: 1.08, grayscale: 1 } },
  { id: 'vintage', label: 'Vintage', parameters: { ...NEUTRAL_FILTER, contrast: 0.92, saturation: 0.82, sepia: 0.38 } },
] as const;

export function createRenderSpec(edits: ImageEditState): RenderSpec {
  return {
    adjustments: {
      brightness: edits.brightness, contrast: edits.contrast, saturation: edits.saturation,
      exposure: edits.exposure, highlights: edits.highlights, shadows: edits.shadows,
      temperature: edits.temperature, tint: edits.tint, vibrance: edits.vibrance,
      sharpness: edits.sharpness, vignette: edits.vignette,
    },
    filter: edits.filter, crop: edits.crop, rotation: edits.rotation, flipH: edits.flipH, flipV: edits.flipV,
    markup: edits.markup.map((drawing) => ({ ...drawing })),
  };
}

export function getRenderParameters(spec: RenderSpec): FilterParameters {
  const preset = FILTERS.find((filter) => filter.id === spec.filter)?.parameters ?? NEUTRAL_FILTER;
  return {
    brightness: spec.adjustments.brightness / 100 * preset.brightness,
    contrast: spec.adjustments.contrast / 100 * preset.contrast,
    saturation: spec.adjustments.saturation / 100 * preset.saturation,
    exposure: spec.adjustments.exposure / 100,
    highlights: spec.adjustments.highlights / 100,
    shadows: spec.adjustments.shadows / 100,
    temperature: spec.adjustments.temperature / 100 * 0.5 + preset.temperature,
    tint: spec.adjustments.tint / 100,
    vibrance: spec.adjustments.vibrance / 100,
    sharpness: spec.adjustments.sharpness / 100,
    vignette: spec.adjustments.vignette / 100,
    grayscale: preset.grayscale,
    sepia: preset.sepia,
  };
}

export function screenDeltaToImagePercent(
  dx: number,
  dy: number,
  width: number,
  height: number,
  rotation: Rotation,
  flipH: boolean,
  flipV: boolean,
): { x: number; y: number } {
  const radians = rotation * Math.PI / 180;
  const rotatedX = Math.cos(radians) * dx + Math.sin(radians) * dy;
  const rotatedY = -Math.sin(radians) * dx + Math.cos(radians) * dy;
  const localX = flipH ? -rotatedX : rotatedX;
  const localY = flipV ? -rotatedY : rotatedY;
  return { x: localX / width * 100, y: localY / height * 100 };
}

export function updateCrop(crop: CropState, type: CropDragType, dx: number, dy: number): CropState {
  let { x, y, width, height } = crop;
  const min = 5;
  if (type === 'move') return { ...crop, x: clamp(x + dx, 0, 100 - width), y: clamp(y + dy, 0, 100 - height) };
  if (['corner-tl', 'corner-bl', 'side-l'].includes(type)) { const next = clamp(x + dx, 0, x + width - min); width += x - next; x = next; }
  if (['corner-tr', 'corner-br', 'side-r'].includes(type)) width = clamp(width + dx, min, 100 - x);
  if (['corner-tl', 'corner-tr', 'side-t'].includes(type)) { const next = clamp(y + dy, 0, y + height - min); height += y - next; y = next; }
  if (['corner-bl', 'corner-br', 'side-b'].includes(type)) height = clamp(height + dy, min, 100 - y);
  return { x, y, width, height };
}

export function getCropPixels(crop: CropState | undefined, width: number, height: number) {
  const value = crop ?? { x: 0, y: 0, width: 100, height: 100 };
  return {
    x: value.x / 100 * width,
    y: value.y / 100 * height,
    width: value.width / 100 * width,
    height: value.height / 100 * height,
  };
}

export function getOutputSize(width: number, height: number, rotation: Rotation) {
  return rotation % 180 === 0 ? { width, height } : { width: height, height: width };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
