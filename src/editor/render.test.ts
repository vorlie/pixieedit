import { describe, expect, it } from 'vitest';
import { createDefaultEdits, normalizeEdits } from './editModel';
import { createRenderSpec, getCropPixels, getOutputSize, getRenderParameters, screenDeltaToImagePercent, updateCrop } from './render';

describe('edit model', () => {
  it('normalizes a legacy edit record without changing adjustments', () => {
    const edits = normalizeEdits({ brightness: 125, contrast: 80 });
    expect(edits).toMatchObject({ version: 3, brightness: 125, contrast: 80, temperature: 0, exposure: 0, rotation: 0, filter: 'none', markup: [] });
  });

  it('creates independent defaults', () => {
    expect(createDefaultEdits()).not.toBe(createDefaultEdits());
  });
});

describe('crop and transform calculations', () => {
  it('clamps crop movement and resizing to the image', () => {
    expect(updateCrop({ x: 10, y: 10, width: 80, height: 80 }, 'move', 30, -30)).toEqual({ x: 20, y: 0, width: 80, height: 80 });
    expect(updateCrop({ x: 10, y: 10, width: 80, height: 80 }, 'corner-tl', 100, 100)).toEqual({ x: 85, y: 85, width: 5, height: 5 });
  });

  it('maps screen movement back through rotation and flips', () => {
    expect(screenDeltaToImagePercent(0, 20, 200, 100, 90, false, false)).toEqual({ x: 10, y: expect.closeTo(0) });
    expect(screenDeltaToImagePercent(20, 0, 200, 100, 0, true, false)).toEqual({ x: -10, y: 0 });
  });

  it('calculates crop pixels and rotated output dimensions', () => {
    expect(getCropPixels({ x: 10, y: 20, width: 50, height: 40 }, 1000, 500)).toEqual({ x: 100, y: 100, width: 500, height: 200 });
    expect(getOutputSize(500, 200, 90)).toEqual({ width: 200, height: 500 });
  });

  it('combines manual adjustments with a selected filter', () => {
    const value = getRenderParameters(createRenderSpec(normalizeEdits({ brightness: 120, filter: 'mono' })));
    expect(value.brightness).toBe(1.2);
    expect(value.grayscale).toBe(1);
  });
});
